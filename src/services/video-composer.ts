import ffmpeg from 'fluent-ffmpeg';
import { Asset, Channel, VideoScript } from '../types/index.js';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface ComposeOptions {
  channel?: Channel;
  /** Strategy when a video file is shorter than its target segment duration. */
  shortVideoStrategy?: 'loop' | 'extend_last_frame';
}

export class VideoComposer {
  private outputDir: string;

  constructor(outputDir: string = './output/videos') {
    this.outputDir = outputDir;
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
    
    console.log('🎬 Starting video composition (audio-first strict)...');
    console.log(`📝 Title: ${script.title}`);
    console.log(`🎞️ Assets: ${assets.length} items`);
    console.log(`🎵 Audio: ${audioPath}`);

    const usableAssets = assets.filter(a => !!a.localPath);
    if (usableAssets.length === 0) {
      throw new Error('No usable assets with localPath to compose video');
    }
    
    // Get audio duration (source of truth)
    const audioDuration = await this.getAudioDurationStrict(audioPath);
    console.log(`⏱️ Audio duration (ffprobe): ${audioDuration.toFixed(2)}s`);

    // Normalize segment durations. If durations missing, default to ~6.5s.
    const normalized = usableAssets.map(a => ({
      ...a,
      duration: typeof a.duration === 'number' && a.duration > 0 ? a.duration : 6.5
    }));

    // Ensure the visual timeline is NEVER shorter than audio.
    const totalPlanned = normalized.reduce((sum, a) => sum + (a.duration || 0), 0);
    if (totalPlanned + 0.05 < audioDuration) {
      const deficit = audioDuration - totalPlanned;
      console.log(`🧩 Extending last segment by ${deficit.toFixed(2)}s to match audio`);
      normalized[normalized.length - 1].duration = (normalized[normalized.length - 1].duration || 0) + deficit;
    }
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      const shortVideoStrategy = options.shortVideoStrategy || 'loop';
      const fps = 30;

      // Add all image/video inputs (usable only)
      const inputMetaPromises = normalized.map(async (asset) => {
        const localPath = asset.localPath as string;
        if (asset.type === 'video') {
          const mediaDuration = await this.getMediaDurationSeconds(localPath);
          const target = asset.duration || 0;
          // Be conservative: if duration can't be probed, treat as short to guarantee segment duration.
          const isShort = !Number.isFinite(mediaDuration) || mediaDuration <= 0 || target > mediaDuration + 0.1;
          const sourceFrames = Number.isFinite(mediaDuration) && mediaDuration > 0
            ? Math.max(1, Math.floor(mediaDuration * fps))
            : 1;
          return { localPath, type: asset.type, targetDuration: target, mediaDuration, isShort, sourceFrames };
        }
        return { localPath, type: asset.type, targetDuration: asset.duration || 0, mediaDuration: Infinity, isShort: false, sourceFrames: 1 };
      });

      Promise.all(inputMetaPromises)
        .then((inputs) => {
          inputs.forEach((input) => {
            command.input(input.localPath);
          });
      
          // Add audio LAST
          command.input(audioPath);

          // Complex filter: build per-segment durations, concat, then trim to audioDuration.
          const filters = this.buildFiltersV11(normalized, inputs, audioDuration, options.channel, fps, shortVideoStrategy);
          const audioIndex = inputs.length; // audio is last input

          command
            .complexFilter(filters)
            .outputOptions([
              '-map [outv]',
              `-map ${audioIndex}:a`,
              '-c:v libx264',
              '-preset medium',
              '-crf 23',
              '-c:a aac',
              '-b:a 192k',
              '-ar 44100',
              `-r ${fps}`,
              '-pix_fmt yuv420p',
              // Output duration must match audio exactly
              `-t ${audioDuration.toFixed(3)}`,
              '-movflags +faststart'
            ])
            .on('start', () => {
              console.log('FFmpeg started...');
            })
            .on('progress', (progress) => {
              if (progress.percent) {
                console.log(`Processing: ${progress.percent.toFixed(1)}%`);
              }
            })
            .on('end', () => {
              console.log(`✅ Video created: ${outputPath}`);
              resolve(outputPath);
            })
            .on('error', (err) => {
              console.error('❌ FFmpeg error:', err);
              reject(err);
            })
            .save(outputPath);
        })
        .catch((err) => reject(err));
    });
  }

  private async getAudioDurationStrict(audioPath: string): Promise<number> {
    const { stdout } = await execAsync(
      `ffprobe -i "${audioPath}" -show_entries format=duration -v quiet -of csv="p=0"`
    );
    const value = parseFloat(stdout.trim());
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Unable to determine audio duration via ffprobe for: ${audioPath}`);
    }
    return value;
  }

  private async getMediaDurationSeconds(filePath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -i "${filePath}" -show_entries format=duration -v quiet -of csv="p=0"`
      );
      const value = parseFloat(stdout.trim());
      return Number.isFinite(value) ? value : NaN;
    } catch {
      return NaN;
    }
  }

  private buildFiltersV11(
    segments: Asset[],
    inputMeta: Array<{ localPath: string; type: 'image' | 'video'; targetDuration: number; mediaDuration: number; isShort: boolean; sourceFrames: number }>,
    audioDuration: number,
    channel: Channel | undefined,
    fps: number,
    shortVideoStrategy: 'loop' | 'extend_last_frame'
  ): string[] {
    const filters: string[] = [];

    const fadeSeconds = 0.5;
    const width = 1920;
    const height = 1080;

    inputMeta.forEach((meta, index) => {
      const dur = Math.max(0.1, segments[index].duration || meta.targetDuration || 6.5);
      const fadeOutStart = Math.max(0, dur - fadeSeconds);

      if (meta.type === 'image') {
        const frames = Math.floor(dur * fps);
        filters.push(
          `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},` +
          `zoompan=z='min(zoom+0.0015,1.35)':d=${frames}:s=${width}x${height}:fps=${fps},` +
          `format=yuv420p,fade=t=in:st=0:d=${fadeSeconds},fade=t=out:st=${fadeOutStart}:d=${fadeSeconds},setsar=1[v${index}]`
        );
        return;
      }

      // Video segment
      const base =
        `[${index}:v]` +
        `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},` +
        `setsar=1,`;

      if (meta.isShort && shortVideoStrategy === 'extend_last_frame') {
        filters.push(
          `${base}trim=0:${Math.min(meta.mediaDuration || dur, dur)},setpts=PTS-STARTPTS,` +
          `tpad=stop_mode=clone:stop_duration=${Math.max(0, dur - (meta.mediaDuration || 0))},` +
          `fade=t=in:st=0:d=${fadeSeconds},fade=t=out:st=${fadeOutStart}:d=${fadeSeconds},format=yuv420p[v${index}]`
        );
        return;
      }

      if (meta.isShort && shortVideoStrategy === 'loop') {
        // Loop the clip in-filter to ensure we can safely reach the target duration.
        filters.push(
          `${base}fps=${fps},` +
          `loop=loop=-1:size=${meta.sourceFrames}:start=0,` +
          `trim=0:${dur},setpts=N/${fps}/TB,` +
          `fade=t=in:st=0:d=${fadeSeconds},fade=t=out:st=${fadeOutStart}:d=${fadeSeconds},format=yuv420p[v${index}]`
        );
        return;
      }

      // Normal video: just trim
      filters.push(
        `${base}trim=0:${dur},setpts=PTS-STARTPTS,` +
        `fade=t=in:st=0:d=${fadeSeconds},fade=t=out:st=${fadeOutStart}:d=${fadeSeconds},format=yuv420p[v${index}]`
      );
    });

    // Concatenate all clips
    const concatInputs = inputMeta.map((_, i) => `[v${i}]`).join('');
    filters.push(`${concatInputs}concat=n=${inputMeta.length}:v=1:a=0[cv]`);

    // Trim visuals to audio duration EXACTLY
    filters.push(`[cv]trim=0:${audioDuration.toFixed(3)},setpts=PTS-STARTPTS[vt]`);

    // Optional branding overlays (short + non-intrusive)
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

    return filters;
  }

  private escapeDrawtext(text: string): string {
    // Escape characters that commonly break drawtext.
    return text
      .replace(/\\/g, '\\\\')
      .replace(/:/g, '\\:')
      .replace(/'/g, "\\'")
      .replace(/\n/g, ' ');
  }
}
