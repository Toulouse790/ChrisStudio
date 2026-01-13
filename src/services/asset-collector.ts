import axios from 'axios';
import { Asset, ScriptSection } from '../types/index.js';

interface PexelsPhoto {
  id: number;
  url: string;
  photographer: string;
  src: {
    original: string;
    large2x: string;
    large: string;
  };
}

interface PexelsVideo {
  id: number;
  url: string;
  user: { name: string };
  video_files: Array<{
    id: number;
    quality: string;
    width: number;
    height: number;
    link: string;
  }>;
}

export class AssetCollector {
  private apiKey: string;
  private baseUrl = 'https://api.pexels.com/v1';
  private videoUrl = 'https://api.pexels.com/videos';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PEXELS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  No Pexels API key found. Asset collection will be limited.');
    }
  }

  async collectAssets(sections: ScriptSection[]): Promise<Asset[]> {
    const assets: Asset[] = [];
    
    console.log(`\n🎨 Collecting assets for ${sections.length} sections...\n`);
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      console.log(`[${i + 1}/${sections.length}] Searching: "${section.searchQuery}"`);
      
      try {
        let asset: Asset;
        
        if (section.visualType === 'video') {
          asset = await this.searchVideo(section.searchQuery, section.duration);
        } else {
          asset = await this.searchImage(section.searchQuery, section.duration);
        }
        
        assets.push(asset);
        console.log(`✅ Found ${asset.type}: ${asset.url.substring(0, 60)}...`);
        
        // Rate limiting - Pexels allows 200 requests/hour
        await this.sleep(300);
      } catch (error) {
        console.error(`❌ Failed to find ${section.visualType} for "${section.searchQuery}":`, error);
        
        // Fallback: use a generic asset
        assets.push({
          type: section.visualType,
          url: 'https://via.placeholder.com/1920x1080',
          duration: section.duration
        });
      }
    }
    
    console.log(`\n✅ Collected ${assets.length} assets\n`);
    return assets;
  }

  private async searchImage(query: string, duration: number): Promise<Asset> {
    if (!this.apiKey) {
      throw new Error('Pexels API key required');
    }

    const response = await axios.get(`${this.baseUrl}/search`, {
      headers: { Authorization: this.apiKey },
      params: {
        query,
        per_page: 5,
        orientation: 'landscape'
      }
    });

    const photos: PexelsPhoto[] = response.data.photos;
    
    if (!photos || photos.length === 0) {
      throw new Error(`No images found for: ${query}`);
    }

    // Get the first photo
    const photo = photos[0];
    
    return {
      type: 'image',
      url: photo.src.large2x,
      duration,
      attribution: `Photo by ${photo.photographer} on Pexels`
    };
  }

  private async searchVideo(query: string, duration: number): Promise<Asset> {
    if (!this.apiKey) {
      throw new Error('Pexels API key required');
    }

    const response = await axios.get(`${this.videoUrl}/search`, {
      headers: { Authorization: this.apiKey },
      params: {
        query,
        per_page: 5,
        orientation: 'landscape'
      }
    });

    const videos: PexelsVideo[] = response.data.videos;
    
    if (!videos || videos.length === 0) {
      throw new Error(`No videos found for: ${query}`);
    }

    const video = videos[0];
    
    // Find HD video file (1920x1080)
    const hdFile = video.video_files.find(f => f.width === 1920 && f.height === 1080) ||
                   video.video_files.find(f => f.quality === 'hd') ||
                   video.video_files[0];

    return {
      type: 'video',
      url: hdFile.link,
      duration,
      attribution: `Video by ${video.user.name} on Pexels`
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Alternative: Unsplash for images (backup)
  async searchUnsplashImage(query: string, duration: number): Promise<Asset> {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    
    if (!accessKey) {
      throw new Error('Unsplash access key required');
    }

    const response = await axios.get('https://api.unsplash.com/search/photos', {
      headers: { Authorization: `Client-ID ${accessKey}` },
      params: {
        query,
        per_page: 5,
        orientation: 'landscape'
      }
    });

    const photos = response.data.results;
    
    if (!photos || photos.length === 0) {
      throw new Error(`No images found on Unsplash for: ${query}`);
    }

    const photo = photos[0];
    
    return {
      type: 'image',
      url: photo.urls.full,
      duration,
      attribution: `Photo by ${photo.user.name} on Unsplash`
    };
  }
}
