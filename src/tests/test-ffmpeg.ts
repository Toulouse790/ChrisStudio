import { VideoComposer } from '../services/video-composer.js';
import { Asset } from '../types/index.js';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

async function ffprobeDurationSeconds(mediaPath: string): Promise<number> {
  const { stdout } = await execAsync(
    `ffprobe -i "${mediaPath}" -show_entries format=duration -v quiet -of csv="p=0"`
  );
  const value = parseFloat(stdout.trim());
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`ffprobe failed for: ${mediaPath}`);
  }
  return value;
}

async function ensureTestMedia() {
  await mkdir('./output/tests', { recursive: true });
  await mkdir('./assets/test', { recursive: true });

  const audioPath = './output/tests/test-audio.mp3';
  const image1 = './assets/test/image1.jpg';
  const image2 = './assets/test/image2.jpg';
  const shortVideo = './assets/test/short.mp4';

  if (!existsSync(audioPath)) {
    // 20s audio to test audio-first trimming and timeline padding
    await execAsync(
      `ffmpeg -y -f lavfi -i sine=frequency=440:duration=20 -c:a libmp3lame -q:a 2 "${audioPath}"`
    );
  }

  if (!existsSync(image1)) {
    await execAsync(
      `ffmpeg -y -f lavfi -i color=c=0x001a33:s=1920x1080:d=1 -frames:v 1 "${image1}"`
    );
  }

  if (!existsSync(image2)) {
    await execAsync(
      `ffmpeg -y -f lavfi -i color=c=0x2a1a00:s=1920x1080:d=1 -frames:v 1 "${image2}"`
    );
  }

  if (!existsSync(shortVideo)) {
    // 2s short clip (will be looped or extended to ~6s)
    await execAsync(
      `ffmpeg -y -f lavfi -i testsrc=size=1920x1080:rate=30 -t 2 -pix_fmt yuv420p "${shortVideo}"`
    );
  }

  return { audioPath, image1, image2, shortVideo };
}

async function testFFmpeg() {
  console.log('🧪 Testing FFmpeg Video Composition\n');
  
  const composer = new VideoComposer('./output/tests');

  const { audioPath, image1, image2, shortVideo } = await ensureTestMedia();
  
  // Mix images + a too-short video clip to validate loop/extend.
  const testAssets: Asset[] = [
    {
      type: 'image',
      url: 'https://example.com/image1.jpg',
      localPath: image1,
      duration: 6
    },
    {
      type: 'video',
      url: 'https://example.com/short.mp4',
      localPath: shortVideo,
      duration: 6
    },
    {
      type: 'image',
      url: 'https://example.com/image2.jpg',
      localPath: image2,
      duration: 6
    }
  ];
  
  const audioDuration = await ffprobeDurationSeconds(audioPath);
  console.log(`🎵 Audio duration: ${audioDuration.toFixed(3)}s`);
  
  try {
    const videoPath = await composer.composeVideo(
      { title: 'Test', hook: '', sections: [], conclusion: '', duration: 10 },
      audioPath,
      testAssets,
      'test-video.mp4',
      { shortVideoStrategy: 'loop' }
    );

    const videoDuration = await ffprobeDurationSeconds(videoPath);
    console.log(`🎬 Video duration: ${videoDuration.toFixed(3)}s`);

    // Allow a small muxing tolerance
    const delta = Math.abs(videoDuration - audioDuration);
    if (delta > 0.12) {
      throw new Error(`Duration mismatch too high: Δ=${delta.toFixed(3)}s`);
    }
    console.log('✅ Video composition test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFFmpeg().catch(console.error);
