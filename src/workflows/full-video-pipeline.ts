import 'dotenv/config';
import { ScriptGenerator } from '../services/script-generator.js';
import { VoiceGenerator } from '../services/voice-generator.js';
import { AssetCollector } from '../services/asset-collector.js';
import { AssetDownloader } from '../services/asset-downloader.js';
import { VideoComposer } from '../services/video-composer.js';
import { Channel } from '../types/index.js';
import { writeFile } from 'fs/promises';

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
      // Step 1: Generate Script
      console.log('📝 STEP 1/5: Generating script with Claude AI...\n');
      const script = await this.scriptGenerator.generateScript(channel, topic);
      
      console.log(`✅ Script generated: "${script.title}"`);
      console.log(`   Duration: ${Math.floor(script.duration / 60)}:${String(script.duration % 60).padStart(2, '0')}`);
      console.log(`   Sections: ${script.sections.length}`);
      
      // Save script
      const scriptPath = `./output/scripts/${projectId}.json`;
      await writeFile(scriptPath, JSON.stringify(script, null, 2));
      console.log(`   Saved: ${scriptPath}\n`);

      // Step 2: Generate Voice
      console.log('🎤 STEP 2/5: Generating narration with Edge TTS...\n');
      const fullNarration = `${script.hook} ${script.sections.map(s => s.narration).join(' ')} ${script.conclusion}`;
      const audioPath = await this.voiceGenerator.generateAudio(
        fullNarration,
        channel.voice,
        `${projectId}.mp3`
      );
      console.log(`   Characters: ${fullNarration.length}`);
      console.log(`   Audio: ${audioPath}\n`);

      // Step 3: Collect Assets
      console.log('🎨 STEP 3/5: Collecting visual assets from Pexels...\n');
      const assets = await this.assetCollector.collectAssets(script.sections);
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
        `${projectId}.mp4`
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
}
