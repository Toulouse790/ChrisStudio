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
 * Améliore les recherches Pexels avec des mots-clés pertinents
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

    // Améliorer la recherche avec des mots-clés simples en anglais
    let searchQuery = extractKeywords(scene.imagePrompt || scene.text);
    
    // Chercher des images (plus fiable que les vidéos)
    let images = await searchImages(searchQuery, 5);
    
    // Si pas de résultats, essayer avec des termes plus génériques
    if (images.length === 0) {
      const fallbackQuery = getGenericQuery(scene.text);
      images = await searchImages(fallbackQuery, 5);
    }
    
    // Chercher des vidéos aussi
    const videos = await searchVideos(searchQuery, 3);

    // Prendre une image aléatoire parmi les résultats pour varier
    const randomIndex = Math.floor(Math.random() * Math.min(3, images.length));
    
    results.push({
      sceneId: scene.id,
      videoUrl: videos[0] ? getBestVideoUrl(videos[0]) : '',
      imageUrl: images[randomIndex]?.src.large2x || images[randomIndex]?.src.large || images[0]?.src.large || ''
    });

    // Petit délai pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

/**
 * Extrait des mots-clés simples en anglais pour Pexels
 */
function extractKeywords(text: string): string {
  // Traductions françaises vers anglais pour les termes courants
  const translations: Record<string, string> = {
    'mystère': 'mystery', 'mystérieux': 'mystery', 'mystérieuse': 'mystery',
    'disparition': 'missing person', 'disparu': 'missing',
    'océan': 'ocean', 'mer': 'ocean sea', 'plage': 'beach',
    'nuit': 'night dark', 'sombre': 'dark shadow',
    'forêt': 'forest', 'jungle': 'jungle',
    'avion': 'airplane aircraft', 'bateau': 'ship boat',
    'montagne': 'mountain', 'désert': 'desert',
    'ville': 'city urban', 'rue': 'street',
    'ciel': 'sky clouds', 'étoiles': 'stars night sky',
    'tempête': 'storm lightning', 'orage': 'storm',
    'feu': 'fire flames', 'eau': 'water',
    'ancien': 'ancient old', 'antique': 'ancient ruins',
    'pyramide': 'pyramid egypt', 'temple': 'temple ancient',
    'guerre': 'war military', 'bataille': 'battle war',
    'science': 'science laboratory', 'technologie': 'technology',
    'espace': 'space cosmos', 'univers': 'universe galaxy',
    'histoire': 'history historical', 'historique': 'historical',
    'crime': 'crime detective', 'enquête': 'investigation detective',
    'document': 'documents papers', 'archives': 'archive documents',
    'secret': 'secret mystery', 'caché': 'hidden secret',
    'découverte': 'discovery exploration', 'exploration': 'exploration adventure',
    'noël': 'christmas winter', 'père noël': 'santa christmas',
    'hiver': 'winter snow', 'neige': 'snow winter',
    'extraterrestre': 'alien ufo', 'ovni': 'ufo alien',
    'fantôme': 'ghost haunted', 'hanté': 'haunted ghost',
    'paranormal': 'paranormal supernatural', 'surnaturel': 'supernatural',
  };

  let query = text.toLowerCase();
  
  // Appliquer les traductions
  for (const [fr, en] of Object.entries(translations)) {
    if (query.includes(fr)) {
      return en;
    }
  }
  
  // Extraire les noms propres et mots importants
  const words = text
    .replace(/[^\w\sàâäéèêëïîôùûüç]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, 3);
  
  return words.join(' ') || 'dramatic cinematic scene';
}

/**
 * Génère une recherche générique basée sur le contexte
 */
function getGenericQuery(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('bermud') || lowerText.includes('océan') || lowerText.includes('mer') || lowerText.includes('bateau')) {
    return 'ocean sea storm ship';
  }
  if (lowerText.includes('avion') || lowerText.includes('crash') || lowerText.includes('aérien')) {
    return 'airplane sky clouds';
  }
  if (lowerText.includes('crime') || lowerText.includes('enquête') || lowerText.includes('police')) {
    return 'detective investigation documents';
  }
  if (lowerText.includes('guerre') || lowerText.includes('nazi') || lowerText.includes('militaire')) {
    return 'war military historical';
  }
  if (lowerText.includes('égypte') || lowerText.includes('pharaon') || lowerText.includes('pyramide')) {
    return 'pyramid egypt ancient';
  }
  if (lowerText.includes('noël') || lowerText.includes('père noël') || lowerText.includes('santa')) {
    return 'christmas winter snow';
  }
  if (lowerText.includes('espace') || lowerText.includes('étoile') || lowerText.includes('galaxie')) {
    return 'space galaxy stars cosmos';
  }
  if (lowerText.includes('forêt') || lowerText.includes('nature') || lowerText.includes('sauvage')) {
    return 'forest nature wilderness';
  }
  
  return 'dramatic documentary cinematic';
}
