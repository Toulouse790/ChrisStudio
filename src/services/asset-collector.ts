import axios from 'axios';
import { Asset, ScriptSection, VisualRequest } from '../types/index.js';

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

  /**
   * Backward-compatible API: one asset per section.
   * Prefer using collectAssetsForTimeline() for dynamic timelines.
   */
  async collectAssets(sections: ScriptSection[]): Promise<Asset[]> {
    const requests: VisualRequest[] = sections.map((s, idx) => ({
      searchQuery: s.searchQuery,
      preferredType: s.visualType === 'video' ? 'video' : 'image',
      durationSeconds: s.duration,
      transition: s.transition,
      label: `section-${idx + 1}`
    }));
    return this.collectAssetsForTimeline(requests);
  }

  async collectAssetsForTimeline(requests: VisualRequest[]): Promise<Asset[]> {
    const assets: Asset[] = [];

    // Cache Pexels results to avoid 1 API call per beat.
    const cache = new Map<string, { items: Array<Omit<Asset, 'duration'>>; cursor: number }>();
    
    console.log(`\n🎨 Collecting assets for ${requests.length} timeline beats...\n`);
    
    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      console.log(`[${i + 1}/${requests.length}] Searching (${req.preferredType}): "${req.searchQuery}"`);
      
      try {
        const key = `${req.preferredType}:${req.searchQuery}`;

        // Ensure cache is populated
        if (!cache.has(key)) {
          const needed = Math.min(30, this.estimateNeededForQuery(requests, req));
          if (req.preferredType === 'video') {
            try {
              const items = await this.searchVideos(req.searchQuery, needed);
              cache.set(key, { items, cursor: 0 });
            } catch {
              // Fallback bucket: images
              const imgKey = `image:${req.searchQuery}`;
              if (!cache.has(imgKey)) {
                const items = await this.searchImages(req.searchQuery, needed);
                cache.set(imgKey, { items, cursor: 0 });
              }
              cache.set(key, cache.get(imgKey)!);
            }
          } else {
            const items = await this.searchImages(req.searchQuery, needed);
            cache.set(key, { items, cursor: 0 });
          }
        }

        const bucket = cache.get(key)!;
        const item = bucket.items[bucket.cursor % bucket.items.length];
        bucket.cursor++;

        const asset: Asset = {
          ...item,
          duration: req.durationSeconds
        };
        
        assets.push(asset);
        console.log(`✅ Found ${asset.type}: ${asset.url.substring(0, 60)}...`);
        
        // Gentle pacing (still keeps us well under Pexels limits with caching)
        await this.sleep(80);
      } catch (error) {
        console.error(`❌ Failed to find ${req.preferredType} for "${req.searchQuery}":`, error);
        
        // Hard fallback: always return an IMAGE placeholder (never a fake video URL)
        assets.push({
          type: 'image',
          url: 'https://via.placeholder.com/1920x1080',
          duration: req.durationSeconds,
          attribution: 'Placeholder fallback'
        });
      }
    }
    
    console.log(`\n✅ Collected ${assets.length} assets\n`);
    return assets;
  }

  private estimateNeededForQuery(requests: VisualRequest[], req: VisualRequest): number {
    const key = `${req.preferredType}:${req.searchQuery}`;
    return requests.filter(r => `${r.preferredType}:${r.searchQuery}` === key).length;
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

  private async searchImages(query: string, count: number): Promise<Array<Omit<Asset, 'duration'>>> {
    if (!this.apiKey) {
      throw new Error('Pexels API key required');
    }

    const perPage = Math.max(1, Math.min(30, count));
    const response = await axios.get(`${this.baseUrl}/search`, {
      headers: { Authorization: this.apiKey },
      params: {
        query,
        per_page: perPage,
        orientation: 'landscape'
      }
    });

    const photos: PexelsPhoto[] = response.data.photos;
    if (!photos || photos.length === 0) {
      throw new Error(`No images found for: ${query}`);
    }

    return photos.map((photo) => ({
      type: 'image' as const,
      url: photo.src.large2x,
      attribution: `Photo by ${photo.photographer} on Pexels`
    }));
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

  private async searchVideos(query: string, count: number): Promise<Array<Omit<Asset, 'duration'>>> {
    if (!this.apiKey) {
      throw new Error('Pexels API key required');
    }

    const perPage = Math.max(1, Math.min(30, count));
    const response = await axios.get(`${this.videoUrl}/search`, {
      headers: { Authorization: this.apiKey },
      params: {
        query,
        per_page: perPage,
        orientation: 'landscape'
      }
    });

    const videos: PexelsVideo[] = response.data.videos;
    if (!videos || videos.length === 0) {
      throw new Error(`No videos found for: ${query}`);
    }

    return videos.map((video) => {
      const hdFile =
        video.video_files.find(f => f.width === 1920 && f.height === 1080) ||
        video.video_files.find(f => f.quality === 'hd') ||
        video.video_files[0];

      return {
        type: 'video' as const,
        url: hdFile.link,
        attribution: `Video by ${video.user.name} on Pexels`
      };
    });
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
