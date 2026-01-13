import 'dotenv/config';
import { ScriptGenerator } from '../services/script-generator.js';
import { VoiceGenerator } from '../services/voice-generator.js';
import { AssetCollector } from '../services/asset-collector.js';
import { AssetDownloader } from '../services/asset-downloader.js';
import { VideoComposer } from '../services/video-composer.js';
import { Channel, VisualRequest, VideoScript } from '../types/index.js';
import { writeFile } from 'fs/promises';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class FullVideoPipeline {
  private scriptGenerator: ScriptGenerator;
  private voiceGenerator: VoiceGenerator;
  private assetCollector: AssetCollector;
  private assetDownloader: AssetDownloader;
  private videoComposer: VideoComposer;

  constructor() {
    this.scriptGenerator = new ScriptGenerator();
    this.voiceGenerator = new VoiceGenerator();
    this.assetCollector = new AssetCollector();
    this.assetDownloader = new AssetDownloader();
    this.videoComposer = new VideoComposer();
  }

  async generateVideo(channel: Channel, topic: string): Promise<string> {
    console.log('\n🎬 Full Video Pipeline Started');
    console.log('='.repeat(60));
    console.log(`📺 Channel: ${channel.name}`);
    console.log(`📝 Topic: ${topic}`);
    console.log('='.repeat(60) + '\n');

    const timestamp = Date.now();
    const projectId = `${channel.id}-${timestamp}`;

    try {
      // Step 1: Generate Script + Audio with strict duration contract
      console.log('📝 STEP 1/5: Generating script (9–12 min contract) + audio...\n');

      const { script, audioPath, audioDuration, narrationText } = await this.generateScriptAndAudioWithContract(channel, topic, projectId);
      
      console.log(`✅ Script generated: "${script.title}"`);
      console.log(`   Script target duration: ${Math.floor(script.duration / 60)}:${String(script.duration % 60).padStart(2, '0')}`);
      console.log(`   Sections: ${script.sections.length}`);
      console.log(`   Audio (ffprobe): ${Math.floor(audioDuration / 60)}:${String(Math.round(audioDuration % 60)).padStart(2, '0')}`);
      
      // Save script
      const scriptPath = `./output/scripts/${projectId}.json`;
      await writeFile(scriptPath, JSON.stringify(script, null, 2));
      console.log(`   Saved: ${scriptPath}\n`);

      // Step 3: Collect Assets
      console.log('🎨 STEP 3/5: Collecting visual assets from Pexels...\n');
      const requests = this.buildVisualTimelineRequests(channel, topic, script, audioDuration);
      const assets = await this.assetCollector.collectAssetsForTimeline(requests);
      console.log(`   Images: ${assets.filter(a => a.type === 'image').length}`);
      console.log(`   Videos: ${assets.filter(a => a.type === 'video').length}\n`);

      // Step 4: Download Assets
      console.log('📥 STEP 4/5: Downloading assets...\n');
      const downloadedAssets = await this.assetDownloader.downloadAssets(assets);
      const successfulDownloads = downloadedAssets.filter(a => a.localPath).length;
      console.log(`   Downloaded: ${successfulDownloads}/${assets.length}\n`);

      // Step 5: Compose Video
      console.log('🎬 STEP 5/5: Composing final video with FFmpeg...\n');
      const videoPath = await this.videoComposer.composeVideo(
        script,
        audioPath,
        downloadedAssets.filter(a => a.localPath),
        `${projectId}.mp4`,
        { channel, shortVideoStrategy: 'loop' }
      );

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

      const audioPath = await this.voiceGenerator.generateAudio(
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
    const { stdout } = await execAsync(
      `ffprobe -i "${mediaPath}" -show_entries format=duration -v quiet -of csv="p=0"`
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
    audioDuration: number
  ): VisualRequest[] {
    const pacing = channel.pacing || { minShotSeconds: 6, maxShotSeconds: 8 };
    const visualMix = channel.visualMix || { image: 0.85, video: 0.15 };

    const rng = this.mulberry32(this.hashStringToSeed(`${channel.id}:${topic}:${script.title}`));

    // Reserve: hook (~7s) + sting (~3s) + outro (~12s)
    const hookSeconds = 7;
    const stingSeconds = channel.branding?.overlay?.stingDurationSeconds || 3;
    const outroSeconds = 12;
    const reserved = hookSeconds + stingSeconds + outroSeconds;
    const usableSeconds = Math.max(60, audioDuration - reserved);

    const sectionWordWeights = script.sections.map(s => this.wordCount(s.narration));
    const totalWeight = Math.max(1, sectionWordWeights.reduce((a, b) => a + b, 0));

    const requests: VisualRequest[] = [];

    // Hook beat
    requests.push({
      label: 'hook',
      preferredType: rng() < visualMix.video ? 'video' : 'image',
      durationSeconds: hookSeconds,
      searchQuery: script.sections[0]?.searchQuery || topic
    });

    // Sting beat (branding overlay handled in composer)
    const stingQuery = channel.id === 'classified-files'
      ? 'classified dossier files archive evidence'
      : channel.id === 'human-odyssey'
        ? 'ancient map parchment artifact archaeology'
        : 'futuristic interface hologram abstract technology';
    requests.push({
      label: 'sting',
      preferredType: 'image',
      durationSeconds: stingSeconds,
      searchQuery: stingQuery
    });

    // Sections: split into multiple beats
    script.sections.forEach((section, idx) => {
      const weight = this.wordCount(section.narration);
      const sectionSeconds = (weight / totalWeight) * usableSeconds;

      const avgShot = (pacing.minShotSeconds + pacing.maxShotSeconds) / 2;
      const unclampedCount = Math.max(1, Math.round(sectionSeconds / avgShot));
      const beatCount = Math.max(3, Math.min(10, unclampedCount));

      for (let b = 0; b < beatCount; b++) {
        const base = sectionSeconds / beatCount;
        const jitter = (rng() - 0.5) * 1.2; // ±0.6s
        const dur = Math.min(
          pacing.maxShotSeconds,
          Math.max(pacing.minShotSeconds, base + jitter)
        );

        const preferredType = rng() < visualMix.video ? 'video' : 'image';
        requests.push({
          label: `section-${idx + 1}-beat-${b + 1}`,
          preferredType,
          durationSeconds: dur,
          transition: section.transition,
          searchQuery: section.searchQuery
        });
      }
    });

    // Outro beat (teaser + CTA overlay handled in composer)
    const outroQuery = channel.id === 'classified-files'
      ? 'surveillance camera night city evidence board'
      : channel.id === 'human-odyssey'
        ? 'cinematic landscape ruins sunset ancient civilization'
        : 'space galaxy futuristic city night cinematic';
    requests.push({
      label: 'outro',
      preferredType: 'image',
      durationSeconds: outroSeconds,
      searchQuery: outroQuery
    });

    // Convert to Asset durations later; ensure total isn't shorter than audio (composer still enforces)
    const sum = requests.reduce((s, r) => s + r.durationSeconds, 0);
    if (sum + 0.05 < audioDuration) {
      const deficit = audioDuration - sum;
      requests[requests.length - 1].durationSeconds += deficit;
    }

    return requests;
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
