import ffmpeg from 'fluent-ffmpeg';
import { Asset, Channel, VideoScript } from '../types/index.js';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { promisify } from 'util';
import { execFile, spawn } from 'child_process';
import { VisualEffectsEngine, VisualEffect, ColorGrade, TransitionType } from './visual-effects-engine.js';
import { MusicManager } from './music-manager.js';
import { SoundDesignManager, SFXCue } from './sound-design-manager.js';
import { DynamicPacingEngine, ShotTiming, PacingContext } from './dynamic-pacing-engine.js';
import { ContentType, EmotionalTone, EnhancedSection, EnhancedVideoScript } from './script-generator.js';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export interface ComposeOptions {
  channel?: Channel;
  /** Strategy when a video file is shorter than its target segment duration. */
  shortVideoStrategy?: 'loop' | 'extend_last_frame';
  /** Enable background music mixing */
  enableMusic?: boolean;
  /** Path to music file (auto-selected if not provided) */
  musicPath?: string;
  /** Enable sound effects */
  enableSFX?: boolean;
  /** Enable dynamic visual effects (vs. simple Ken Burns) */
  enableVisualEffects?: boolean;
  /** Enable color grading */
  enableColorGrading?: boolean;
  /** Music volume (0-1, default 0.15) */
  musicVolume?: number;
  /** Use enhanced script data for pacing/effects */
  enhancedScript?: EnhancedVideoScript;
}

interface SegmentMeta {
  localPath: string;
  type: 'image' | 'video';
  targetDuration: number;
  mediaDuration: number;
  isShort: boolean;
  sourceFrames: number;
  effect?: VisualEffect;
  transition?: TransitionType;
  contentType?: ContentType;
  emotionalTone?: EmotionalTone;
  pacing?: ShotTiming;
}

export class VideoComposer {
  private outputDir: string;
  private visualEffects: VisualEffectsEngine;
  private musicManager: MusicManager;
  private soundDesign: SoundDesignManager;
  private pacingEngine: DynamicPacingEngine;

  constructor(outputDir: string = './output/videos') {
    this.outputDir = outputDir;
    this.visualEffects = new VisualEffectsEngine();
    this.musicManager = new MusicManager();
    this.soundDesign = new SoundDesignManager();
    this.pacingEngine = new DynamicPacingEngine();
  }

  async composeVideo(
    script: VideoScript,
    audioPath: string,
    assets: Asset[],
    outputFile: string,
    options: ComposeOptions = {}
  ): Promise<string> {
    await mkdir(this.outputDir, { recursive: true });

    const outputPath = `${this.outputDir}/${outputFile}`;

    logger.info({
      title: script.title,
      assetCount: assets.length,
      audioPath,
      options: {
        enableMusic: options.enableMusic,
        enableSFX: options.enableSFX,
        enableVisualEffects: options.enableVisualEffects,
        enableColorGrading: options.enableColorGrading
      }
    }, 'Starting enhanced video composition');

    const usableAssets = assets.filter(a => !!a.localPath);
    if (usableAssets.length === 0) {
      throw new Error('No usable assets with localPath to compose video');
    }

    // Get audio duration (source of truth)
    const audioDuration = await this.getAudioDurationStrict(audioPath);
    logger.info({ audioDuration: audioDuration.toFixed(2) }, 'Audio duration determined');

    // Prepare segments with enhanced metadata
    const segments = await this.prepareSegments(usableAssets, options, audioDuration);

    // Ensure the visual timeline is NEVER shorter than audio
    const totalPlanned = segments.reduce((sum, s) => sum + s.targetDuration, 0);
    if (totalPlanned + 0.05 < audioDuration) {
      const deficit = audioDuration - totalPlanned;
      logger.info({ deficit: deficit.toFixed(2) }, 'Extending last segment to match audio');
      segments[segments.length - 1].targetDuration += deficit;
    }

    // Prepare audio mixing inputs
    const audioInputs = await this.prepareAudioInputs(audioPath, audioDuration, options);

    // Generate SFX cues if enabled
    let sfxCues: SFXCue[] = [];
    if (options.enableSFX && options.enhancedScript) {
      // Transform enhanced sections to SFX format
      let startTime = 0;
      const sfxSections = options.enhancedScript.sections.map(section => {
        const sfxSection = {
          startTime,
          duration: section.duration || 60,
          type: this.mapContentTypeToSFXType(section.contentType)
        };
        startTime += section.duration || 60;
        return sfxSection;
      });

      sfxCues = this.soundDesign.generateSFXCues(sfxSections, audioDuration);
      logger.info({ sfxCount: sfxCues.length }, 'Generated SFX cues');
    }

    // Build and execute FFmpeg command
    return this.executeFFmpeg(
      segments,
      audioInputs,
      sfxCues,
      audioDuration,
      outputPath,
      options
    );
  }

  private async prepareSegments(
    assets: Asset[],
    options: ComposeOptions,
    audioDuration: number
  ): Promise<SegmentMeta[]> {
    const fps = 30;
    const enhancedScript = options.enhancedScript;
    const channel = options.channel;

    // Get channel theme for visual effects
    const theme = channel?.style?.theme || 'sci-fi';

    const segmentPromises = assets.map(async (asset, index) => {
      const localPath = asset.localPath as string;
      let mediaDuration = Infinity;
      let isShort = false;
      let sourceFrames = 1;

      if (asset.type === 'video') {
        mediaDuration = await this.getMediaDurationSeconds(localPath);
        const target = asset.duration || 6.5;
        isShort = !Number.isFinite(mediaDuration) || mediaDuration <= 0 || target > mediaDuration + 0.1;
        sourceFrames = Number.isFinite(mediaDuration) && mediaDuration > 0
          ? Math.max(1, Math.floor(mediaDuration * fps))
          : 1;
      }

      // Get enhanced section data if available
      const section = enhancedScript?.sections[index] as EnhancedSection | undefined;

      // Calculate dynamic pacing if enhanced script available
      let pacing: ShotTiming | undefined;
      let targetDuration = asset.duration || 6.5;

      if (section && enhancedScript) {
        const pacingContext: PacingContext = {
          contentType: section.contentType || 'exposition',
          emotionalTone: section.emotionalTone || 'curiosity',
          emotionalIntensity: this.getIntensityForSection(index, enhancedScript),
          act: section.act || 1,
          narrationDuration: section.duration || 60,
          isClimaxSection: index === enhancedScript.threeActStructure?.climaxSection,
          isMicroHook: section.isMicroHook || false
        };

        pacing = this.pacingEngine.calculateShotTiming(pacingContext);
        // Use pacing-derived duration, but don't exceed section duration
        targetDuration = Math.min(pacing.duration, section.duration || 60);
      }

      // Select visual effect based on content and pacing
      let effect: VisualEffect = 'ken_burns_zoom_in';
      if (options.enableVisualEffects && section) {
        effect = this.visualEffects.selectEffect(
          section.contentType || 'exposition'
        );
      }

      // Select transition based on pacing feel
      let transition: TransitionType = 'fade';
      if (pacing) {
        const suggestedTransitions: Record<ShotTiming['feel'], TransitionType> = {
          rapid: 'wipe_left',
          quick: 'dissolve',
          moderate: 'fade',
          slow: 'dissolve',
          contemplative: 'dip_to_black'
        };
        transition = suggestedTransitions[pacing.feel];
      }

      return {
        localPath,
        type: asset.type,
        targetDuration,
        mediaDuration,
        isShort,
        sourceFrames,
        effect,
        transition,
        contentType: section?.contentType,
        emotionalTone: section?.emotionalTone,
        pacing
      } as SegmentMeta;
    });

    return Promise.all(segmentPromises);
  }

  private getIntensityForSection(index: number, script: EnhancedVideoScript): number {
    const emotionalArc = script.emotionalArc || [];
    if (emotionalArc.length === 0) return 5;

    // Calculate approximate timestamp for this section
    let timestamp = 0;
    for (let i = 0; i < index && i < script.sections.length; i++) {
      timestamp += script.sections[i].duration || 60;
    }

    // Find intensity at this timestamp
    let intensity = 5;
    for (let i = 0; i < emotionalArc.length - 1; i++) {
      if (emotionalArc[i].timestamp <= timestamp && emotionalArc[i + 1].timestamp >= timestamp) {
        const range = emotionalArc[i + 1].timestamp - emotionalArc[i].timestamp;
        if (range > 0) {
          const progress = (timestamp - emotionalArc[i].timestamp) / range;
          intensity = emotionalArc[i].intensity + (emotionalArc[i + 1].intensity - emotionalArc[i].intensity) * progress;
        }
        break;
      }
    }

    return intensity;
  }

  private async prepareAudioInputs(
    narrationPath: string,
    audioDuration: number,
    options: ComposeOptions
  ): Promise<{ narration: string; music?: string; sfxFiles?: string[] }> {
    const result: { narration: string; music?: string; sfxFiles?: string[] } = {
      narration: narrationPath
    };

    // Select background music if enabled
    if (options.enableMusic) {
      let musicPath = options.musicPath;

      if (!musicPath) {
        // Auto-select music based on channel theme
        const theme = options.channel?.style?.theme || 'sci-fi';
        const selectedMusic = await this.musicManager.selectTrack(theme, audioDuration);
        musicPath = selectedMusic?.path;
      }

      if (musicPath && existsSync(musicPath)) {
        result.music = musicPath;
        logger.info({ musicPath }, 'Background music selected');
      }
    }

    return result;
  }

  private async executeFFmpeg(
    segments: SegmentMeta[],
    audioInputs: { narration: string; music?: string; sfxFiles?: string[] },
    sfxCues: SFXCue[],
    audioDuration: number,
    outputPath: string,
    options: ComposeOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const fps = 30;
      const width = 1920;
      const height = 1080;

      // Build FFmpeg command with complex filter
      const args: string[] = [];

      // Add video inputs
      segments.forEach((segment) => {
        args.push('-i', segment.localPath);
      });

      // Add audio inputs
      args.push('-i', audioInputs.narration);
      const narrationInputIndex = segments.length;

      let musicInputIndex = -1;
      if (audioInputs.music) {
        args.push('-i', audioInputs.music);
        musicInputIndex = segments.length + 1;
      }

      // Build complex filter
      const filters = this.buildEnhancedFilters(
        segments,
        narrationInputIndex,
        musicInputIndex,
        audioDuration,
        options,
        fps,
        width,
        height
      );

      args.push('-filter_complex', filters.join(';'));

      // Output mapping
      args.push('-map', '[outv]');
      args.push('-map', '[outa]');

      // Output settings
      args.push(
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '44100',
        '-r', String(fps),
        '-pix_fmt', 'yuv420p',
        '-t', audioDuration.toFixed(3),
        '-movflags', '+faststart',
        '-y',
        outputPath
      );

      logger.info({ outputPath }, 'Starting FFmpeg render');

      const ffmpegProcess = spawn('ffmpeg', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';

      ffmpegProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
        // Parse progress
        const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = parseInt(timeMatch[3]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          const percent = Math.min(100, (currentTime / audioDuration) * 100);
          logger.debug({ percent: percent.toFixed(1) }, 'Rendering progress');
        }
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          logger.info({ outputPath }, 'Video composition complete');
          resolve(outputPath);
        } else {
          logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg failed');
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      ffmpegProcess.on('error', (err) => {
        logger.error({ error: err.message }, 'FFmpeg spawn error');
        reject(err);
      });
    });
  }

  private buildEnhancedFilters(
    segments: SegmentMeta[],
    narrationInputIndex: number,
    musicInputIndex: number,
    audioDuration: number,
    options: ComposeOptions,
    fps: number,
    width: number,
    height: number
  ): string[] {
    const filters: string[] = [];
    const fadeSeconds = 0.5;
    const channel = options.channel;
    const shortVideoStrategy = options.shortVideoStrategy || 'loop';

    // Get color grade for channel
    let colorGrade: ColorGrade | null = null;
    if (options.enableColorGrading && channel?.style?.theme) {
      colorGrade = this.visualEffects.getColorGrade(channel.style.theme);
    }

    // Build video filters for each segment
    segments.forEach((segment, index) => {
      const dur = segment.targetDuration;
      const fadeOutStart = Math.max(0, dur - fadeSeconds);

      // Base scaling and crop
      let filter = `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;

      if (segment.type === 'image') {
        // Get effect intensity based on pacing
        const effectIntensity = segment.pacing
          ? DynamicPacingEngine.getEffectIntensity(segment.pacing.feel)
          : 0.5;

        // Apply visual effect
        if (options.enableVisualEffects && segment.effect) {
          const effectFilter = this.visualEffects.generateImageEffectFilter(
            segment.effect,
            dur,
            width,
            height,
            fps,
            effectIntensity
          );
          filter += `,${effectFilter}`;
        } else {
          // Default Ken Burns
          const frames = Math.floor(dur * fps);
          filter += `,zoompan=z='min(zoom+0.0015,1.35)':d=${frames}:s=${width}x${height}:fps=${fps}`;
        }

        filter += `,format=yuv420p`;
      } else {
        // Video segment
        if (segment.isShort && shortVideoStrategy === 'extend_last_frame') {
          filter += `,trim=0:${Math.min(segment.mediaDuration || dur, dur)},setpts=PTS-STARTPTS`;
          filter += `,tpad=stop_mode=clone:stop_duration=${Math.max(0, dur - (segment.mediaDuration || 0))}`;
        } else if (segment.isShort && shortVideoStrategy === 'loop') {
          filter += `,fps=${fps}`;
          filter += `,loop=loop=-1:size=${segment.sourceFrames}:start=0`;
          filter += `,trim=0:${dur},setpts=N/${fps}/TB`;
        } else {
          filter += `,trim=0:${dur},setpts=PTS-STARTPTS`;
        }
        filter += `,format=yuv420p`;
      }

      // Apply color grading
      if (colorGrade && options.enableColorGrading) {
        const colorFilter = this.visualEffects.generateColorGradeFilter(colorGrade, 0.7);
        filter += `,${colorFilter}`;
      }

      // Apply fades
      filter += `,fade=t=in:st=0:d=${fadeSeconds},fade=t=out:st=${fadeOutStart}:d=${fadeSeconds}`;

      filter += `[v${index}]`;
      filters.push(filter);
    });

    // Concatenate all video clips
    const concatInputs = segments.map((_, i) => `[v${i}]`).join('');
    filters.push(`${concatInputs}concat=n=${segments.length}:v=1:a=0[cv]`);

    // Trim to audio duration
    filters.push(`[cv]trim=0:${audioDuration.toFixed(3)},setpts=PTS-STARTPTS[vt]`);

    // Apply branding overlays
    const brand = channel?.branding;
    const fontCandidate = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
    const fontfile = existsSync(fontCandidate) ? `:fontfile=${fontCandidate}` : '';

    if (brand?.overlay) {
      const stingText = brand.stingText.replace('{ChannelName}', channel?.name || '');
      const softCtaText = brand.softCtaText;
      const stingStart = brand.overlay.stingStartSeconds;
      const stingEnd = brand.overlay.stingStartSeconds + brand.overlay.stingDurationSeconds;
      const ctaStart = brand.overlay.softCtaStartSeconds;
      const ctaEnd = brand.overlay.softCtaStartSeconds + brand.overlay.softCtaDurationSeconds;

      const finalCtaStart = Math.max(0, audioDuration - 10);
      const finalCtaEnd = audioDuration;
      const finalCtaText = brand.finalCtaText;

      const style = brand.overlayStyle;
      const fontSize = Math.max(24, Math.min(72, style?.fontSize ?? 48));
      const fontColor = style?.fontColor ?? 'white';
      const boxColor = style?.boxColor ?? 'black';
      const boxOpacity = Math.max(0, Math.min(1, style?.boxOpacity ?? 0.45));
      const boxBorderW = Math.max(0, Math.min(40, style?.boxBorderW ?? 18));

      const drawCommon = `:x=(w-text_w)/2:y=h-(text_h*2.2):fontsize=${fontSize}:fontcolor=${fontColor}:box=1:boxcolor=${boxColor}@${boxOpacity}:boxborderw=${boxBorderW}`;

      filters.push(
        `[vt]` +
        `drawtext=text='${this.escapeDrawtext(stingText)}'${fontfile}${drawCommon}:enable='between(t,${stingStart.toFixed(2)},${stingEnd.toFixed(2)})',` +
        `drawtext=text='${this.escapeDrawtext(softCtaText)}'${fontfile}${drawCommon}:enable='between(t,${ctaStart.toFixed(2)},${ctaEnd.toFixed(2)})',` +
        `drawtext=text='${this.escapeDrawtext(finalCtaText)}'${fontfile}${drawCommon}:enable='between(t,${finalCtaStart.toFixed(2)},${finalCtaEnd.toFixed(2)})'[outv]`
      );
    } else {
      filters.push(`[vt]copy[outv]`);
    }

    // Build audio filters
    if (musicInputIndex >= 0 && options.enableMusic) {
      // Mix narration with background music using auto-ducking
      const musicVolume = options.musicVolume ?? 0.15;
      const duckVolume = musicVolume * 0.3; // Duck to 30% when voice active

      filters.push(
        // Prepare narration
        `[${narrationInputIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[narr]`
      );

      filters.push(
        // Prepare music (loop if shorter, trim if longer)
        `[${musicInputIndex}:a]aloop=loop=-1:size=2e+09,atrim=0:${audioDuration.toFixed(3)},` +
        `volume=${musicVolume},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[musicbase]`
      );

      // Apply sidechaincompress for auto-ducking
      filters.push(
        `[musicbase][narr]sidechaincompress=threshold=0.02:ratio=6:attack=50:release=300:level_sc=1[musicducked]`
      );

      // Mix narration and ducked music
      filters.push(
        `[narr][musicducked]amix=inputs=2:duration=first:dropout_transition=2,` +
        `atrim=0:${audioDuration.toFixed(3)}[outa]`
      );
    } else {
      // No music, just use narration
      filters.push(
        `[${narrationInputIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,` +
        `atrim=0:${audioDuration.toFixed(3)}[outa]`
      );
    }

    return filters;
  }

  private async getAudioDurationStrict(audioPath: string): Promise<number> {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-i', audioPath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0']
    );
    const value = parseFloat(stdout.trim());
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Unable to determine audio duration via ffprobe for: ${audioPath}`);
    }
    return value;
  }

  private async getMediaDurationSeconds(filePath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        ['-i', filePath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0']
      );
      const value = parseFloat(stdout.trim());
      return Number.isFinite(value) ? value : NaN;
    } catch {
      return NaN;
    }
  }

  private escapeDrawtext(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '%%')
      .replace(/:/g, '\\:')
      .replace(/'/g, "\\'") 
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}');
  }

  private mapContentTypeToSFXType(contentType?: ContentType): 'hook' | 'section' | 'reveal' | 'conclusion' {
    if (!contentType) return 'section';
    switch (contentType) {
      case 'hook': return 'hook';
      case 'reveal': return 'reveal';
      case 'conclusion': return 'conclusion';
      default: return 'section';
    }
  }
}
