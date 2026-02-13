import axios from 'axios';
import { createWriteStream, existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Asset } from '../types/index.js';
import path from 'path';
import { AssetLibrary } from './asset-library.js';

export class AssetDownloader {
  private outputDir: string;
  private library: AssetLibrary;

  constructor(outputDir: string = './assets/downloads') {
    this.outputDir = outputDir;
    this.library = new AssetLibrary();
  }

  async downloadAssets(assets: Asset[]): Promise<Asset[]> {
    await mkdir(this.outputDir, { recursive: true });
    
    console.log(`\n📥 Downloading ${assets.length} assets...\n`);
    
    const downloadedAssets: Asset[] = [];

    let reusedCount = 0;
    let downloadedCount = 0;
    let indexedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];

      // If the asset already has a valid localPath, reuse it (no network).
      if (asset.localPath && existsSync(asset.localPath)) {
        reusedCount++;
        downloadedAssets.push(asset);
        // Update lastUsedAt/timesUsed in library if possible.
        await this.library.markUsedByPath(asset.localPath).catch(() => undefined);
        console.log(`[${i + 1}/${assets.length}] Reusing local ${asset.type}: ${asset.localPath}`);
        continue;
      }

      console.log(`[${i + 1}/${assets.length}] Downloading ${asset.type}...`);
      
      try {
        const localPath = await this.downloadFile(asset.url, asset.type, i);

        downloadedCount++;

        const enriched: Asset = {
          ...asset,
          localPath,
          source: asset.source || 'pexels'
        };

        // Index into local library for future reuse
        const entry = await this.library.upsertFromDownload(enriched, localPath).catch(() => null);
        if (entry) indexedCount++;
        
        downloadedAssets.push(enriched);
        
        console.log(`✅ Saved: ${localPath}`);
      } catch (error) {
        console.error(`❌ Failed to download ${asset.url}:`, error);
        // Keep the asset without localPath (will be skipped in video composition)
        downloadedAssets.push(asset);
        failedCount++;
      }
    }
    
    console.log(`\n📚 Library reuse: ${reusedCount}`);
    console.log(`⬇️  Downloaded: ${downloadedCount}`);
    console.log(`🧾 Indexed: ${indexedCount}`);
    console.log(`⚠️  Failed: ${failedCount}`);
    console.log(`\n✅ Usable assets: ${downloadedAssets.filter(a => a.localPath && existsSync(a.localPath)).length}/${assets.length}\n`);
    return downloadedAssets;
  }

  /** Reject URLs targeting private/internal networks or non-HTTP(S) schemes. */
  private validateUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Disallowed URL scheme: ${parsed.protocol}`);
    }
    const host = parsed.hostname;
    // Block private/loopback IPs
    const blocked = [
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^0\./,
      /^::1$/,
      /^localhost$/i,
      /^\[::1\]$/
    ];
    if (blocked.some((re) => re.test(host))) {
      throw new Error(`URL targets a private/internal address: ${host}`);
    }
  }

  private async downloadFile(url: string, type: string, index: number): Promise<string> {
    this.validateUrl(url);

    const extension = type === 'video' ? 'mp4' : 'jpg';
    const filename = `${type}-${index}-${Date.now()}.${extension}`;
    const filepath = path.join(this.outputDir, filename);
    
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 60000, // 60 seconds timeout
      maxRedirects: 3,
      headers: {
        'User-Agent': 'ChrisStudio/1.0'
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
