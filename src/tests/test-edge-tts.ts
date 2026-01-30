import { VoiceGeneratorFactory } from '../services/voice-generator-factory.js';
import { channels } from '../config/channels.js';

async function testVoices() {
  console.log('🧪 Testing Voice Generation\n');

  const factory = new VoiceGeneratorFactory('./output/tests');

  // Test text
  const testText = `What if humans could live forever? Imagine a world where aging is just a distant memory, where death is no longer inevitable. This isn't science fiction anymore. Scientists are making breakthrough discoveries that could extend human life far beyond what we thought possible.`;

  console.log('📝 Test text:');
  console.log(testText);
  console.log('\n---\n');

  // Test all three channel voices
  for (const [key, channel] of Object.entries(channels)) {
    console.log(`\n📺 Testing ${channel.name}`);
    console.log(`Provider: ${channel.voice.provider}`);
    console.log(`Voice ID: ${channel.voice.voiceId}`);

    try {
      await factory.generateAudio(
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

testVoices().catch(console.error);
