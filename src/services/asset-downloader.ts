import axios from 'axios';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Asset } from '../types/index.js';
import path from 'path';

export class AssetDownloader {
  private outputDir: string;

  constructor(outputDir: string = './assets/downloads') {
    this.outputDir = outputDir;
  }

  async downloadAssets(assets: Asset[]): Promise<Asset[]> {
    await mkdir(this.outputDir, { recursive: true });
    
    console.log(`\n📥 Downloading ${assets.length} assets...\n`);
    
    const downloadedAssets: Asset[] = [];
    
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      console.log(`[${i + 1}/${assets.length}] Downloading ${asset.type}...`);
      
      try {
        const localPath = await this.downloadFile(asset.url, asset.type, i);
        
        downloadedAssets.push({
          ...asset,
          localPath
        });
        
        console.log(`✅ Saved: ${localPath}`);
      } catch (error) {
        console.error(`❌ Failed to download ${asset.url}:`, error);
        // Keep the asset without localPath (will be skipped in video composition)
        downloadedAssets.push(asset);
      }
    }
    
    console.log(`\n✅ Downloaded ${downloadedAssets.filter(a => a.localPath).length}/${assets.length} assets\n`);
    return downloadedAssets;
  }

  private async downloadFile(url: string, type: string, index: number): Promise<string> {
    const extension = type === 'video' ? 'mp4' : 'jpg';
    const filename = `${type}-${index}-${Date.now()}.${extension}`;
    const filepath = path.join(this.outputDir, filename);
    
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 60000, // 60 seconds timeout
      headers: {
        'User-Agent': 'YouTube-Creator-Studio/1.0'
      }
    });

    const writer = createWriteStream(filepath);
    await pipeline(response.data, writer);
    
    return filepath;
  }

  async cleanup(assets: Asset[]): Promise<void> {
    const fs = await import('fs/promises');
    
    for (const asset of assets) {
      if (asset.localPath) {
        try {
          await fs.unlink(asset.localPath);
          console.log(`🗑️  Deleted: ${asset.localPath}`);
        } catch (error) {
          // Ignore errors
        }
      }
    }
  }
}
