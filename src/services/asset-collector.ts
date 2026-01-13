import axios from 'axios';
import { Asset, ScriptSection, VisualRequest } from '../types/index.js';
import { AssetLibrary } from './asset-library.js';

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
  private library: AssetLibrary;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PEXELS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  No Pexels API key found. Asset collection will be limited.');
    }

    this.library = new AssetLibrary();
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

    const usedLocalPaths = new Set<string>();
    const usedLibraryIds = new Set<string>();
    const usedUrls = new Set<string>();

    const preferLocal = this.library.isPreferLocalEnabled();
    if (preferLocal) {
      await this.library.ensureLoaded();
      const stats = this.library.getStats();
      console.log(`📚 Local library enabled: ${stats.total} assets (${stats.images} images, ${stats.videos} videos)`);
    }

    let fromLibrary = 0;
    let fromPexels = 0;
    
    console.log(`\n🎨 Collecting assets for ${requests.length} timeline beats...\n`);
    
    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      console.log(`[${i + 1}/${requests.length}] Searching (${req.preferredType}): "${req.searchQuery}"`);

      const channelId = req.channelId;
      const tags = this.deriveTags(req.searchQuery);
      
      try {
        // 1) Reuse-first from local library (never repeat within same video)
        if (preferLocal) {
          const local = await this.library.findBestLocalAssets({
            query: req.searchQuery,
            preferredType: req.preferredType,
            count: 1,
            channelId,
            excludeIds: usedLibraryIds,
            excludeLocalPaths: usedLocalPaths
          });

          let chosenLocal = local[0];

          // If video requested but no local video found, fallback to local image before Pexels.
          if (!chosenLocal && req.preferredType === 'video') {
            const localImg = await this.library.findBestLocalAssets({
              query: req.searchQuery,
              preferredType: 'image',
              count: 1,
              channelId,
              excludeIds: usedLibraryIds,
              excludeLocalPaths: usedLocalPaths
            });
            chosenLocal = localImg[0];
          }

          if (chosenLocal?.localPath) {
            const libId = chosenLocal.libraryId;
            if (libId) usedLibraryIds.add(libId);
            usedLocalPaths.add(chosenLocal.localPath);

            assets.push({
              ...chosenLocal,
              duration: req.durationSeconds,
              source: 'library',
              channelId: channelId || chosenLocal.channelId,
              searchQuery: req.searchQuery,
              tags: chosenLocal.tags?.length ? chosenLocal.tags : tags,
              attribution: chosenLocal.attribution || 'From local library'
            });
            fromLibrary++;
            if (libId) {
              await this.library.markUsedById(libId).catch(() => undefined);
            }
            console.log(`♻️  Reused ${chosenLocal.type} from library: ${chosenLocal.localPath}`);
            await this.sleep(10);
            continue;
          }
        }

        // 2) Fallback: Pexels (with caching) + strict video→image fallback
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
        // Try to avoid repeating exact same URL within the same generation.
        let item: Omit<Asset, 'duration'> | undefined;
        for (let tries = 0; tries < bucket.items.length; tries++) {
          const candidate = bucket.items[bucket.cursor % bucket.items.length];
          bucket.cursor++;
          if (!usedUrls.has(candidate.url)) {
            item = candidate;
            break;
          }
        }
        if (!item) {
          item = bucket.items[(bucket.cursor++) % bucket.items.length];
        }

        const asset: Asset = {
          ...item,
          duration: req.durationSeconds,
          source: 'pexels',
          channelId,
          searchQuery: req.searchQuery,
          tags
        };
        
        assets.push(asset);
        usedUrls.add(asset.url);
        fromPexels++;
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
    
    console.log(`\n✅ Collected ${assets.length} assets (library: ${fromLibrary}, pexels: ${fromPexels})\n`);
    return assets;
  }

  private deriveTags(searchQuery: string): string[] {
    return Array.from(
      new Set(
        (searchQuery || '')
          .toLowerCase()
          .split(/[^a-z0-9]+/g)
          .map(s => s.trim())
          .filter(Boolean)
          .filter(s => s.length > 2)
          .filter(s => !STOPWORDS.has(s))
      )
    );
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

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'over', 'under',
  'about', 'your', 'you', 'are', 'was', 'were', 'has', 'have', 'had', 'will',
  'its', 'our', 'their', 'they', 'them', 'his', 'her', 'she', 'him', 'who',
  'what', 'when', 'where', 'why', 'how', 'a', 'an', 'to', 'of', 'in', 'on',
  'at', 'by', 'as', 'or', 'is', 'it', 'be', 'we', 'us', 'not', 'no', 'yes'
]);
