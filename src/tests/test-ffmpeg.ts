import { VideoComposer } from '../services/video-composer.js';
import { Asset } from '../types/index.js';

async function testFFmpeg() {
  console.log('🧪 Testing FFmpeg Video Composition\n');
  
  const composer = new VideoComposer('./output/tests');
  
  // Mock assets (you'll need to download some test images)
  const testAssets: Asset[] = [
    {
      type: 'image',
      url: 'https://example.com/image1.jpg',
      localPath: './assets/test/image1.jpg',
      duration: 5
    },
    {
      type: 'image',
      url: 'https://example.com/image2.jpg',
      localPath: './assets/test/image2.jpg',
      duration: 5
    }
  ];
  
  // You'll need a test audio file
  const audioPath = './output/tests/test-what-if.mp3';
  
  console.log('⚠️  Note: This test requires:');
  console.log('  1. Test images in ./assets/test/');
  console.log('  2. Audio file from test-edge-tts.ts');
  console.log('\nRun npm run test:tts first!\n');
  
  try {
    await composer.composeVideo(
      { title: 'Test', hook: '', sections: [], conclusion: '', duration: 10 },
      audioPath,
      testAssets,
      'test-video.mp4'
    );
    console.log('✅ Video composition test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFFmpeg().catch(console.error);
