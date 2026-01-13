import { VoiceGenerator } from '../services/voice-generator.js';
import { channels } from '../config/channels.js';

async function testEdgeTTS() {
  console.log('🧪 Testing Edge TTS Voices\n');
  
  const generator = new VoiceGenerator('./output/tests');
  
  // Test text
  const testText = `What if humans could live forever? Imagine a world where aging is just a distant memory, where death is no longer inevitable. This isn't science fiction anymore. Scientists are making breakthrough discoveries that could extend human life far beyond what we thought possible.`;

  console.log('📝 Test text:');
  console.log(testText);
  console.log('\n---\n');

  // Test all three channel voices
  for (const [key, channel] of Object.entries(channels)) {
    console.log(`\n📺 Testing ${channel.name}`);
    console.log(`Voice: ${channel.voice.voice}`);
    console.log(`Language: ${channel.voice.language}`);
    
    try {
      await generator.generateAudio(
        testText,
        channel.voice,
        `test-${key}.mp3`
      );
      console.log(`✅ ${channel.name} voice generated successfully`);
    } catch (error) {
      console.error(`❌ Failed for ${channel.name}:`, error);
    }
  }
  
  console.log('\n🎧 Check the audio files in ./output/tests/');
  console.log('Listen to compare the voices and choose your favorite!');
}

testEdgeTTS().catch(console.error);
