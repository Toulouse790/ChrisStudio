import 'dotenv/config';
import { ScriptGenerator, EnhancedVideoScript } from '../services/script-generator.js';
import { VoiceGeneratorFactory } from '../services/voice-generator-factory.js';
import { AssetCollector } from '../services/asset-collector.js';
import { AssetDownloader } from '../services/asset-downloader.js';
import { VideoComposer, ComposeOptions } from '../services/video-composer.js';
import { Channel, VisualRequest, VideoScript } from '../types/index.js';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { promisify } from 'util';
import { execFile } from 'child_process';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export class FullVideoPipeline {
  private scriptGenerator: ScriptGenerator;
  private voiceGeneratorFactory: VoiceGeneratorFactory;
  private assetCollector: AssetCollector;
  private assetDownloader: AssetDownloader;
  private videoComposer: VideoComposer;

  constructor() {
    this.scriptGenerator = new ScriptGenerator();
    this.voiceGeneratorFactory = new VoiceGeneratorFactory();
    this.assetCollector = new AssetCollector();
    this.assetDownloader = new AssetDownloader();
    this.videoComposer = new VideoComposer();
  }

  async generateVideo(channel: Channel, topic: string, projectId?: string): Promise<string> {
    console.log('\n🎬 Full Video Pipeline Started');
    console.log('='.repeat(60));
    console.log(`📺 Channel: ${channel.name}`);
    console.log(`📝 Topic: ${topic}`);
    console.log('='.repeat(60) + '\n');

    const resolvedProjectId = projectId || `${channel.id}-${Date.now()}`;

    const metaDir = './output/meta';
    const metaPath = `${metaDir}/${resolvedProjectId}.json`;

    try {
      // Step 1: Generate Script + Audio with strict duration contract
      console.log('📝 STEP 1/5: Generating script (9–12 min contract) + audio...\n');

      const { script, audioPath, audioDuration, narrationText } = await this.generateScriptAndAudioWithContract(channel, topic, resolvedProjectId);
      
      console.log(`✅ Script generated: "${script.title}"`);
      console.log(`   Script target duration: ${Math.floor(script.duration / 60)}:${String(script.duration % 60).padStart(2, '0')}`);
      console.log(`   Sections: ${script.sections.length}`);
      console.log(`   Audio (ffprobe): ${Math.floor(audioDuration / 60)}:${String(Math.round(audioDuration % 60)).padStart(2, '0')}`);
      
      // Save script
      const scriptPath = `./output/scripts/${resolvedProjectId}.json`;
      await writeFile(scriptPath, JSON.stringify(script, null, 2));
      console.log(`   Saved: ${scriptPath}\n`);

      // Save manifest (used for pre-publish checks)
      await mkdir(metaDir, { recursive: true });
      await writeFile(
        metaPath,
        JSON.stringify(
          {
            projectId: resolvedProjectId,
            channelId: channel.id,
            topic,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            scriptPath,
            audioPath,
            videoPath: null,
            audioDurationSeconds: audioDuration,
            beatsPlanned: null,
            forceImagesOnly: false,
            minClipsRequested: null,
            requests: [],
            collectedAssets: [],
            downloadedAssets: []
          },
          null,
          2
        )
      );

      // Step 3: Collect Assets
      console.log('🎨 STEP 3/5: Collecting visual assets from Pexels...\n');
      const requests = this.buildVisualTimelineRequests(channel, topic, script, audioDuration);
      const avgBeat = requests.length > 0 ? (audioDuration / requests.length) : 0;
      console.log(`   🎞️ Beats: ${requests.length} (avg ${(avgBeat || 0).toFixed(2)}s/shot)`);
      const assets = await this.assetCollector.collectAssetsForTimeline(requests);
      console.log(`   Images: ${assets.filter(a => a.type === 'image').length}`);
      console.log(`   Videos: ${assets.filter(a => a.type === 'video').length}\n`);
      const fromLibrary = assets.filter(a => a.source === 'library' && a.localPath).length;
      const fromPexels = assets.filter(a => a.source === 'pexels').length;
      if (fromLibrary > 0) {
        console.log(`   ♻️  Assets from library: ${fromLibrary}`);
      }
      console.log(`   🌐 Assets from Pexels: ${fromPexels}\n`);

      // Update manifest with timeline + collected assets (before downloads)
      await this.updateProjectManifest(metaPath, (curr) => ({
        ...curr,
        updatedAt: new Date().toISOString(),
        beatsPlanned: requests.length,
        requests,
        collectedAssets: assets
      }));

      // Step 4: Download Assets
      console.log('📥 STEP 4/5: Downloading assets...\n');
      const downloadedAssets = await this.assetDownloader.downloadAssets(assets);
      const successfulDownloads = downloadedAssets.filter(a => a.localPath).length;
      console.log(`   Downloaded: ${successfulDownloads}/${assets.length}\n`);

      await this.updateProjectManifest(metaPath, (curr) => ({
        ...curr,
        updatedAt: new Date().toISOString(),
        downloadedAssets
      }));

      // Step 5: Compose Video with enhanced effects
      console.log('🎬 STEP 5/5: Composing final video with FFmpeg (enhanced)...\n');
      const composeOptions: ComposeOptions = {
        channel,
        shortVideoStrategy: 'loop',
        enableMusic: true,
        enableSFX: true,
        enableVisualEffects: true,
        enableColorGrading: true,
        musicVolume: 0.15,
        enhancedScript: script as EnhancedVideoScript
      };

      const videoPath = await this.videoComposer.composeVideo(
        script,
        audioPath,
        downloadedAssets.filter(a => a.localPath),
        `${resolvedProjectId}.mp4`,
        composeOptions
      );

      await this.updateProjectManifest(metaPath, (curr) => ({
        ...curr,
        updatedAt: new Date().toISOString(),
        videoPath
      }));

      console.log('\n' + '='.repeat(60));
      console.log('🎉 VIDEO GENERATION COMPLETE!');
      console.log('='.repeat(60));
      console.log(`\n📄 Script:  ${scriptPath}`);
      console.log(`🎵 Audio:   ${audioPath}`);
      console.log(`🎬 Video:   ${videoPath}`);
      console.log(`\n✨ Your video is ready to upload to YouTube!\n`);

      // Optional: Cleanup assets to save space
      // await this.assetDownloader.cleanup(downloadedAssets);

      return videoPath;

    } catch (error) {
      console.error('\n❌ Pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Regenerate only visuals (assets + downloads + compose) using the existing script/audio on disk.
   * This is used by pre-publish “fix it” actions.
   */
  async regenerateAssetsAndRecompose(
    channel: Channel,
    topic: string,
    projectId: string,
    options: { forceImagesOnly?: boolean; minClipsRequested?: number } = {}
  ): Promise<string> {
    const metaDir = './output/meta';
    const metaPath = `${metaDir}/${projectId}.json`;

    const scriptPath = `./output/scripts/${projectId}.json`;
    const audioPath = `./output/audio/${projectId}.mp3`;

    const script = JSON.parse(await readFile(scriptPath, 'utf-8')) as VideoScript;
    const audioDuration = await this.probeDurationSeconds(audioPath);

    await mkdir(metaDir, { recursive: true });

    console.log('🎨 REGEN: Collecting visual assets...');
    const requests = this.buildVisualTimelineRequests(channel, topic, script, audioDuration, {
      forceImagesOnly: !!options.forceImagesOnly,
      minClipsRequested: options.minClipsRequested
    });
    const assets = await this.assetCollector.collectAssetsForTimeline(requests);

    await this.updateProjectManifest(metaPath, (curr) => ({
      ...curr,
      projectId,
      channelId: channel.id,
      topic,
      scriptPath,
      audioPath,
      updatedAt: new Date().toISOString(),
      audioDurationSeconds: audioDuration,
      beatsPlanned: requests.length,
      forceImagesOnly: !!options.forceImagesOnly,
      minClipsRequested: options.minClipsRequested ?? null,
      requests,
      collectedAssets: assets
    }));

    console.log('📥 REGEN: Downloading assets...');
    const downloadedAssets = await this.assetDownloader.downloadAssets(assets);

    await this.updateProjectManifest(metaPath, (curr) => ({
      ...curr,
      updatedAt: new Date().toISOString(),
      downloadedAssets
    }));

    console.log('🎬 REGEN: Composing video with enhanced effects...');
    const composeOptions: ComposeOptions = {
      channel,
      shortVideoStrategy: 'loop',
      enableMusic: true,
      enableSFX: true,
      enableVisualEffects: true,
      enableColorGrading: true,
      musicVolume: 0.15,
      enhancedScript: script as EnhancedVideoScript
    };

    const videoPath = await this.videoComposer.composeVideo(
      script,
      audioPath,
      downloadedAssets.filter(a => a.localPath),
      `${projectId}.mp4`,
      composeOptions
    );

    await this.updateProjectManifest(metaPath, (curr) => ({
      ...curr,
      updatedAt: new Date().toISOString(),
      videoPath
    }));

    return videoPath;
  }

  private async updateProjectManifest(
    metaPath: string,
    mutate: (curr: any) => any
  ): Promise<void> {
    try {
      const curr = JSON.parse(await readFile(metaPath, 'utf-8'));
      const next = mutate(curr);
      await writeFile(metaPath, JSON.stringify(next, null, 2));
    } catch {
      const next = mutate({});
      await writeFile(metaPath, JSON.stringify(next, null, 2));
    }
  }

  private async generateScriptAndAudioWithContract(
    channel: Channel,
    topic: string,
    projectId: string
  ): Promise<{ script: VideoScript; audioPath: string; audioDuration: number; narrationText: string }>
  {
    const minSeconds = 9 * 60;
    const maxSeconds = 12 * 60;

    const attempts = 3;
    let mode: 'normal' | 'expand' | 'compress' = 'normal';
    let targetWordCount = { min: 1500, max: 1800 };

    let lastScript: VideoScript | null = null;
    let lastAudioPath: string | null = null;
    let lastDuration = 0;
    let lastNarration = '';

    for (let i = 1; i <= attempts; i++) {
      console.log(`   ↳ Attempt ${i}/${attempts} (${mode})`);
      const script = await this.scriptGenerator.generateScript(channel, topic, { mode, targetWordCount });

      // Build narration with branding injected at safe moments.
      const narrationText = this.buildNarrationWithBranding(channel, script);

      const audioPath = await this.voiceGeneratorFactory.generateAudio(
        narrationText,
        channel.voice,
        `${projectId}.mp3`
      );
      const audioDuration = await this.probeDurationSeconds(audioPath);

      lastScript = script;
      lastAudioPath = audioPath;
      lastDuration = audioDuration;
      lastNarration = narrationText;

      if (audioDuration >= minSeconds && audioDuration <= maxSeconds) {
        // Use actual audio duration as source-of-truth
        script.duration = Math.round(audioDuration);
        return { script, audioPath, audioDuration, narrationText };
      }

      if (audioDuration < minSeconds) {
        mode = 'expand';
        targetWordCount = { min: 1700, max: 2000 };
      } else if (audioDuration > maxSeconds) {
        mode = 'compress';
        targetWordCount = { min: 1350, max: 1550 };
      }
    }

    if (!lastScript || !lastAudioPath) {
      throw new Error('Unable to generate script/audio');
    }

    // Best-effort: return last attempt but still enforce script.duration to audio
    lastScript.duration = Math.round(lastDuration);
    return { script: lastScript, audioPath: lastAudioPath, audioDuration: lastDuration, narrationText: lastNarration };
  }

  private buildNarrationWithBranding(channel: Channel, script: VideoScript): string {
    const sting = channel.branding?.stingText?.replace('{ChannelName}', channel.name);
    const softCta = channel.branding?.softCtaText;
    const outroTeaser = channel.branding?.outroTeaserText;
    const finalCta = channel.branding?.finalCtaText;

    // Hook ~0:00–0:07 (no intro)
    const parts: string[] = [script.hook.trim()];

    // Sting 2–3s after hook
    if (sting) parts.push(sting);

    // Main body: insert soft CTA around ~1:20 by placing after first section
    script.sections.forEach((section, idx) => {
      parts.push(section.narration.trim());
      if (idx === 0 && softCta) {
        parts.push(softCta);
      }
    });

    parts.push(script.conclusion.trim());

    // Outro teaser 10–12s + final CTA
    if (outroTeaser) parts.push(outroTeaser);
    if (finalCta) parts.push(finalCta);

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  private async probeDurationSeconds(mediaPath: string): Promise<number> {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-i', mediaPath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0']
    );
    const value = parseFloat(stdout.trim());
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Unable to determine duration via ffprobe for: ${mediaPath}`);
    }
    return value;
  }

  private buildVisualTimelineRequests(
    channel: Channel,
    topic: string,
    script: VideoScript,
    audioDuration: number,
    overrides: { forceImagesOnly?: boolean; minClipsRequested?: number } = {}
  ): VisualRequest[] {
    // Beats timeline (indispensable): ~6–8s shots => docu monté (pas slideshow).
    const pacing = channel.pacing || { minShotSeconds: 6, maxShotSeconds: 8 };

    // Règle produit: plans ~6–8s pour un montage “docu” (même si un channel préfère plus rapide).
    const minBeat = Math.max(6, pacing.minShotSeconds);
    const maxBeat = Math.max(minBeat, Math.min(8, pacing.maxShotSeconds));

    // Majoritairement images animées + quelques clips.
    const baseMix = channel.visualMix || { image: 0.85, video: 0.15 };
    const visualMix = overrides.forceImagesOnly
      ? { image: 1, video: 0 }
      : baseMix;

    const rng = this.mulberry32(this.hashStringToSeed(`${channel.id}:${topic}:${script.title}`));

    const stingText = channel.branding?.stingText?.replace('{ChannelName}', channel.name)?.trim();
    const softCtaText = channel.branding?.softCtaText?.trim();
    const outroTeaserText = channel.branding?.outroTeaserText?.trim();
    const finalCtaText = channel.branding?.finalCtaText?.trim();

    const stingQuery = channel.id === 'classified-files'
      ? 'classified dossier files archive evidence'
      : channel.id === 'human-odyssey'
        ? 'ancient map parchment artifact archaeology'
        : 'futuristic interface hologram abstract technology';

    const outroQuery = channel.id === 'classified-files'
      ? 'surveillance camera night city evidence board'
      : channel.id === 'human-odyssey'
        ? 'cinematic landscape ruins sunset ancient civilization'
        : 'space galaxy futuristic city night cinematic';

    type Segment = {
      label: string;
      text: string;
      baseQuery: string;
      transition?: VisualRequest['transition'];
      forceType?: VisualRequest['preferredType'];
    };

    const segments: Segment[] = [];

    // Hook first (7–8s typiquement)
    segments.push({
      label: 'hook',
      text: script.hook || topic,
      baseQuery: script.sections[0]?.searchQuery || topic,
      transition: 'fade'
    });

    // Branding sting text exists in narration; give it a dedicated segment to avoid jarring visuals.
    if (stingText) {
      segments.push({
        label: 'sting',
        text: stingText,
        baseQuery: stingQuery,
        transition: 'fade',
        forceType: 'image'
      });
    }

    // Sections: base is section.searchQuery
    script.sections.forEach((section, idx) => {
      segments.push({
        label: `section-${idx + 1}`,
        text: section.narration,
        baseQuery: section.searchQuery || topic,
        transition: section.transition
      });

      // Soft CTA is injected after first section in narration; allocate a small segment so the timeline matches audio better.
      if (idx === 0 && softCtaText) {
        segments.push({
          label: 'soft-cta',
          text: softCtaText,
          baseQuery: section.searchQuery || topic,
          transition: section.transition,
          forceType: 'image'
        });
      }
    });

    // Conclusion
    segments.push({
      label: 'conclusion',
      text: script.conclusion || '',
      baseQuery: `${topic} legacy aftermath`.
        replace(/\s+/g, ' ')
        .trim(),
      transition: 'dissolve'
    });

    if (outroTeaserText) {
      segments.push({
        label: 'outro-teaser',
        text: outroTeaserText,
        baseQuery: outroQuery,
        transition: 'fade',
        forceType: 'image'
      });
    }

    if (finalCtaText) {
      segments.push({
        label: 'final-cta',
        text: finalCtaText,
        baseQuery: outroQuery,
        transition: 'fade',
        forceType: 'image'
      });
    }

    const weights = segments.map(s => Math.max(1, this.wordCount(s.text)));
    const totalWeight = Math.max(1, weights.reduce((a, b) => a + b, 0));

    const requests: VisualRequest[] = [];
    let lastQuery: string | null = null;

    const pickType = (forceType?: VisualRequest['preferredType']): VisualRequest['preferredType'] => {
      if (forceType) return forceType;
      if (overrides.forceImagesOnly) return 'image';
      return rng() < visualMix.video ? 'video' : 'image';
    };

    const pickBeatDuration = (remaining: number): number => {
      if (remaining <= 0.2) return remaining;
      // If the remaining time is small, don't force a 6s+ beat.
      if (remaining < minBeat * 0.75) return remaining;

      const raw = minBeat + (maxBeat - minBeat) * rng();
      return Math.min(remaining, Math.max(minBeat, Math.min(maxBeat, raw)));
    };

    const pickQueryFromPalette = (
      baseQuery: string,
      theme: Channel['style']['theme'],
      preferredType: VisualRequest['preferredType'],
      beatIndex: number
    ): string => {
      const palette = this.buildBeatQueryPalette(baseQuery, theme, preferredType);
      if (palette.length === 0) return baseQuery;
      // Rotate deterministically to keep caching effective (few unique queries per segment).
      let q = palette[beatIndex % palette.length];
      if (lastQuery && q === lastQuery && palette.length > 1) {
        q = palette[(beatIndex + 1) % palette.length];
      }
      lastQuery = q;
      return q;
    };

    segments.forEach((seg, segIdx) => {
      const segSeconds = (weights[segIdx] / totalWeight) * audioDuration;
      let remaining = segSeconds;
      let beat = 0;

      while (remaining > 0.05) {
        beat += 1;
        const dur = pickBeatDuration(remaining);
        remaining -= dur;

        const preferredType = pickType(seg.forceType);
        const searchQuery = pickQueryFromPalette(seg.baseQuery, channel.style.theme, preferredType, beat - 1);

        requests.push({
          label: `${seg.label}-beat-${beat}`,
          preferredType,
          durationSeconds: Math.max(0.1, dur),
          transition: seg.transition,
          searchQuery,
          channelId: channel.id
        });
      }
    });

    // If requested, ensure we hit a minimum number of video beats.
    const minClips = Math.max(0, Math.floor(overrides.minClipsRequested || 0));
    if (!overrides.forceImagesOnly && minClips > 0) {
      const videoEligible = requests
        .map((r, idx) => ({ r, idx }))
        .filter(({ r }) => r.preferredType !== 'video');

      let currentVideos = requests.filter(r => r.preferredType === 'video').length;
      while (currentVideos < minClips && videoEligible.length > 0) {
        // deterministic pick to keep results stable
        const pickIdx = Math.floor(rng() * videoEligible.length);
        const { idx } = videoEligible.splice(pickIdx, 1)[0];
        requests[idx] = { ...requests[idx], preferredType: 'video' };
        currentVideos++;
      }
    }

    // Ensure the visual timeline is never shorter than audio (composer enforces too).
    const sum = requests.reduce((s, r) => s + r.durationSeconds, 0);
    if (sum + 0.05 < audioDuration) {
      requests[requests.length - 1].durationSeconds += (audioDuration - sum);
    }

    return requests;
  }

  private buildBeatQueryPalette(
    baseQuery: string,
    theme: Channel['style']['theme'],
    preferredType: VisualRequest['preferredType']
  ): string[] {
    const base = (baseQuery || '').trim();
    if (!base) return [];

    // Keep palettes small to preserve Pexels caching (avoid 80 unique queries).
    if (theme === 'historical') {
      if (preferredType === 'video') {
        return [
          base,
          `${base} archival footage`,
          `${base} cinematic b-roll`
        ];
      }
      return [
        base,
        `${base} archival photo`,
        `${base} old map`
      ];
    }

    if (theme === 'mysterious') {
      if (preferredType === 'video') {
        return [
          base,
          `${base} surveillance footage`,
          `${base} night b-roll`
        ];
      }
      return [
        base,
        `${base} evidence board`,
        `${base} classified document`
      ];
    }

    // sci-fi
    if (preferredType === 'video') {
      return [
        base,
        `${base} cinematic b-roll`,
        `${base} futuristic city`
      ];
    }
    return [
      base,
      `${base} futuristic interface`,
      `${base} hologram`
    ];
  }

  private wordCount(text: string): number {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  private hashStringToSeed(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private mulberry32(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
}
