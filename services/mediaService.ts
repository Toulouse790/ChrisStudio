/**
 * Media Service - Génération d'images et vidéos via APIs externes
 * Utilise Pexels pour les médias stock
 */

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || '0LWSqbSenCvFrMUYpkCcofv1XDYJrf9CzVJTmSQLaI5apfbWxnl6zDQ0';

interface PexelsVideo {
  id: number;
  url: string;
  video_files: Array<{
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }>;
  video_pictures: Array<{
    id: number;
    picture: string;
  }>;
}

interface PexelsPhoto {
  id: number;
  url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
  };
}

/**
 * Recherche des vidéos sur Pexels
 */
export async function searchVideos(query: string, count: number = 5): Promise<PexelsVideo[]> {
  try {
    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          Authorization: PEXELS_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();
    return data.videos || [];
  } catch (error) {
    console.error('Error searching Pexels videos:', error);
    return [];
  }
}

/**
 * Recherche des images sur Pexels
 */
export async function searchImages(query: string, count: number = 5): Promise<PexelsPhoto[]> {
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          Authorization: PEXELS_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();
    return data.photos || [];
  } catch (error) {
    console.error('Error searching Pexels images:', error);
    return [];
  }
}

/**
 * Obtient la meilleure qualité vidéo disponible (HD préféré)
 */
export function getBestVideoUrl(video: PexelsVideo): string {
  const files = video.video_files
    .filter(f => f.file_type === 'video/mp4')
    .sort((a, b) => b.width - a.width);
  
  // Préférer 1080p ou 720p
  const hd = files.find(f => f.width === 1920 || f.width === 1280);
  return hd?.link || files[0]?.link || '';
}

/**
 * Télécharge une vidéo et retourne un Blob
 */
export async function downloadVideo(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  return response.blob();
}

/**
 * Télécharge une image et retourne un Blob
 */
export async function downloadImage(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  return response.blob();
}

/**
 * Génère des clips vidéo pour chaque scène du script
 */
export async function generateSceneMedia(
  scenes: Array<{ id: number; text: string; imagePrompt: string; duration: number }>,
  onProgress?: (progress: number, message: string) => void
): Promise<Array<{ sceneId: number; videoUrl: string; imageUrl: string }>> {
  const results: Array<{ sceneId: number; videoUrl: string; imageUrl: string }> = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const progress = ((i + 1) / scenes.length) * 100;
    onProgress?.(progress, `Recherche média scène ${i + 1}/${scenes.length}...`);

    // Extraire les mots-clés du prompt
    const keywords = scene.imagePrompt
      .split(' ')
      .filter(w => w.length > 4)
      .slice(0, 3)
      .join(' ');

    // Chercher des vidéos correspondantes
    const videos = await searchVideos(keywords || scene.text.substring(0, 50), 3);
    const images = await searchImages(keywords || scene.text.substring(0, 50), 3);

    results.push({
      sceneId: scene.id,
      videoUrl: videos[0] ? getBestVideoUrl(videos[0]) : '',
      imageUrl: images[0]?.src.large2x || images[0]?.src.large || ''
    });

    // Petit délai pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return results;
}
