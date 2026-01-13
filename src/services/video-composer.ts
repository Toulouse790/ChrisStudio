import ffmpeg from 'fluent-ffmpeg';
import { VideoScript, Asset } from '../types/index.js';
import { mkdir } from 'fs/promises';

export class VideoComposer {
  private outputDir: string;

  constructor(outputDir: string = './output/videos') {
    this.outputDir = outputDir;
  }

  async composeVideo(
    script: VideoScript,
    audioPath: string,
    assets: Asset[],
    outputFile: string
  ): Promise<string> {
    await mkdir(this.outputDir, { recursive: true });
    
    const outputPath = `${this.outputDir}/${outputFile}`;
    
    console.log('🎬 Starting video composition...');
    console.log(`📝 Title: ${script.title}`);
    console.log(`🎞️ Assets: ${assets.length} items`);
    console.log(`🎵 Audio: ${audioPath}`);
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      
      // Add all image/video inputs
      assets.forEach(asset => {
        if (asset.localPath) {
          command.input(asset.localPath);
        }
      });
      
      // Add audio
      command.input(audioPath);
      
      // Complex filter for transitions and Ken Burns effect
      const filters = this.buildFilters(assets);
      
      command
        .complexFilter(filters)
        .outputOptions([
          '-c:v libx264',
          '-preset medium',
          '-crf 23',
          '-c:a aac',
          '-b:a 192k',
          '-ar 44100',
          '-r 30', // 30 fps
          '-pix_fmt yuv420p'
        ])
        .size('1920x1080')
        .on('start', (cmd) => {
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
    });
  }

  private buildFilters(assets: Asset[]): string[] {
    const filters: string[] = [];
    
    assets.forEach((asset, index) => {
      const duration = asset.duration || 5;
      
      // Ken Burns effect for images (zoom and pan)
      if (asset.type === 'image') {
        filters.push(
          `[${index}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.0015,1.5)':d=${duration * 30}:s=1920x1080:fps=30[v${index}]`
        );
      } else {
        // Video clips with fade
        filters.push(
          `[${index}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fade=in:0:30,fade=out:${(duration * 30) - 30}:30[v${index}]`
        );
      }
    });
    
    // Concatenate all clips
    const concatInputs = assets.map((_, i) => `[v${i}]`).join('');
    filters.push(`${concatInputs}concat=n=${assets.length}:v=1:a=0[outv]`);
    
    return filters;
  }
}
