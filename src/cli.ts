import 'dotenv/config';
import { ScriptGenerator } from './services/script-generator.js';
import { VoiceGenerator } from './services/voice-generator.js';
import { FullVideoPipeline } from './workflows/full-video-pipeline.js';
import { channels } from './config/channels.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'full':
      // Full pipeline: script + audio + assets + video
      const fullChannelId = args[1] || 'what-if';
      const fullTopic = args.slice(2).join(' ') || 'What if AI became conscious tomorrow?';
      
      const fullChannel = channels[fullChannelId];
      if (!fullChannel) {
        console.error('❌ Unknown channel:', fullChannelId);
        console.error('Available channels:', Object.keys(channels).join(', '));
        process.exit(1);
      }
      
      console.log('\n🎬 Full Video Generation Pipeline');
      console.log('This will generate: Script → Audio → Assets → Video\n');
      
      const pipeline = new FullVideoPipeline();
      await pipeline.generateVideo(fullChannel, fullTopic);
      break;
      
    case 'generate':
      const channelId = args[1] || 'what-if';
      const topic = args.slice(2).join(' ') || 'What if humans could live forever?';
      
      console.log(`\n🎬 YouTube Creator Studio`);
      console.log(`${'='.repeat(50)}\n`);
      console.log(`📺 Channel: ${channelId}`);
      console.log(`📝 Topic: ${topic}\n`);
      
      const channel = channels[channelId];
      if (!channel) {
        console.error('❌ Unknown channel:', channelId);
        console.error('Available channels:', Object.keys(channels).join(', '));
        process.exit(1);
      }
      
      // Generate script
      const scriptGen = new ScriptGenerator();
      console.log('📝 Generating script with Claude...');
      const script = await scriptGen.generateScript(channel, topic);
      console.log(`✅ Script generated: "${script.title}"`);
      console.log(`📊 Duration: ${script.duration}s (${Math.floor(script.duration / 60)}min ${script.duration % 60}s)`);
      console.log(`📄 Sections: ${script.sections.length}\n`);
      
      // Save script to file
      const fs = await import('fs/promises');
      const scriptPath = `./output/scripts/${channelId}-${Date.now()}.json`;
      await fs.mkdir('./output/scripts', { recursive: true });
      await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));
      console.log(`💾 Script saved: ${scriptPath}\n`);
      
      // Generate voice
      const voiceGen = new VoiceGenerator();
      const fullNarration = `${script.hook} ${script.sections.map(s => s.narration).join(' ')} ${script.conclusion}`;
      console.log(`📊 Narration length: ${fullNarration.length} characters\n`);
      
      const audioPath = await voiceGen.generateAudio(
        fullNarration,
        channel.voice,
        `${channelId}-${Date.now()}.mp3`
      );
      
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🎉 Generation complete!\n`);
      console.log(`📄 Script: ${scriptPath}`);
      console.log(`🎵 Audio: ${audioPath}`);
      console.log(`\nNext steps:`);
      console.log(`1. Download images/videos for visual sections`);
      console.log(`2. Run video composition with FFmpeg`);
      console.log(`3. Upload to YouTube\n`);
      break;
      
    case 'voices':
      const voiceGen2 = new VoiceGenerator();
      await voiceGen2.listAvailableVoices();
      break;
      
    default:
      console.log('\n🎬 YouTube Creator Studio CLI\n');
      console.log('Commands:');
      console.log('  npm run generate:full [channel] [topic]  - Full pipeline (script→audio→assets→video)');
      console.log('  npm run generate [channel] [topic]       - Generate script & audio only');
      console.log('  npm run voices                           - List available voices');
      console.log('  npm run test:tts                         - Test voice generation');
      console.log('  npm run test:assets                      - Test asset collection');
      console.log('  npm run test:video                       - Test video composition');
      console.log('\nChannels:');
      Object.entries(channels).forEach(([id, channel]) => {
        console.log(`  ${id.padEnd(20)} - ${channel.name}`);
      });
      console.log('\nExamples:');
      console.log('  npm run generate:full what-if "What if AI became conscious tomorrow?"');
      console.log('  npm run generate what-if "What if gravity suddenly stopped?"\n');
  }
}

main().catch(console.error);
