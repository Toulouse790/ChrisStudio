/**
 * Media Service - Génération de VIDÉOS via Pexels
 * 
 * PRIORITÉ: Vidéos stock Pexels correspondant au contenu du script
 * Les images sont utilisées en fallback uniquement
 */

import { generateSceneImage, isGeminiImagenAvailable } from './imageGenerationService';

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
 * Dictionnaire FR → EN pour les recherches Pexels
 */
const VISUAL_TRANSLATIONS: Record<string, string[]> = {
  // Lieux
  'océan': ['ocean waves', 'sea underwater', 'deep ocean'],
  'mer': ['sea waves', 'ocean view', 'coast aerial'],
  'forêt': ['forest aerial', 'trees mist', 'jungle dense'],
  'montagne': ['mountain aerial', 'peaks snow', 'cliff dramatic'],
  'désert': ['desert sand', 'dunes aerial', 'sahara'],
  'ville': ['city night', 'urban aerial', 'cityscape'],
  'espace': ['space stars', 'galaxy', 'cosmos nebula'],
  'ciel': ['sky clouds', 'sunset dramatic', 'storm clouds'],
  
  // Sujets historiques
  'égypte': ['egypt pyramid', 'ancient ruins desert', 'sphinx'],
  'pyramide': ['pyramid egypt', 'ancient monument', 'giza aerial'],
  'rome': ['rome colosseum', 'ancient ruins', 'roman architecture'],
  'grèce': ['greece ancient', 'parthenon ruins', 'acropolis'],
  'temple': ['ancient temple', 'ruins sacred', 'buddhist temple'],
  'château': ['castle medieval', 'fortress dramatic', 'ancient castle'],
  'guerre': ['war historical', 'military footage', 'soldiers marching'],
  'bataille': ['battle scene', 'war dramatic', 'conflict'],
  
  // Émotions/Atmosphères
  'mystère': ['mystery fog', 'dark atmospheric', 'shadow mysterious'],
  'secret': ['secret hidden', 'shadow mystery', 'dark corridor'],
  'danger': ['danger warning', 'dramatic tension', 'storm approaching'],
  'peur': ['fear dark', 'horror atmosphere', 'suspense'],
  'découverte': ['discovery exploration', 'adventure journey', 'explorer'],
  'mort': ['death somber', 'dark cemetery', 'memorial'],
  'espoir': ['hope sunrise', 'light rays', 'dawn beautiful'],
  
  // Nature/Animaux
  'animal': ['wildlife nature', 'animal documentary', 'nature wild'],
  'lion': ['lion wildlife', 'african safari', 'predator hunting'],
  'requin': ['shark underwater', 'ocean predator', 'deep sea'],
  'oiseau': ['bird flying', 'eagle soaring', 'birds migration'],
  'baleine': ['whale underwater', 'ocean giant', 'marine life'],
  
  // Technologie/Science
  'technologie': ['technology futuristic', 'digital abstract', 'circuit board'],
  'science': ['science laboratory', 'research lab', 'microscope'],
  'ordinateur': ['computer technology', 'digital code', 'cyber'],
  'robot': ['robot technology', 'artificial intelligence', 'futuristic'],
  
  // Personnes
  'foule': ['crowd people', 'gathering mass', 'protest march'],
  'soldat': ['soldier military', 'troops marching', 'warrior'],
  'roi': ['king royal', 'throne room', 'palace grand'],
  'explorateur': ['explorer adventure', 'expedition journey', 'discovery'],
  
  // Concepts abstraits
  'temps': ['time clock', 'hourglass sand', 'passage time'],
  'histoire': ['history documentary', 'archive footage', 'historical'],
  'avenir': ['future technology', 'futuristic city', 'tomorrow'],
  'passé': ['past memories', 'vintage old', 'nostalgic'],
};

/**
 * Extrait les mots-clés visuels du texte de la scène
 * MÉTHODE DIRECTE: Analyse le texte pour trouver des éléments VISUELS
 */
function extractVisualKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const keywords: string[] = [];
  
  // 1. D'abord chercher les correspondances directes dans notre dictionnaire
  for (const [french, englishOptions] of Object.entries(VISUAL_TRANSLATIONS)) {
    if (lowerText.includes(french)) {
      keywords.push(englishOptions[0]); // Prendre la première option (plus pertinente)
    }
  }
  
  if (keywords.length >= 2) {
    return keywords.slice(0, 3);
  }
  
  // 2. Détection thématique intelligente basée sur le contenu
  const themeKeywords = detectThemeKeywords(lowerText);
  if (themeKeywords.length > 0) {
    return [...keywords, ...themeKeywords].slice(0, 3);
  }
  
  // 3. Fallback: mots génériques selon le ton
  if (lowerText.includes('danger') || lowerText.includes('mort') || lowerText.includes('peur')) {
    return ['dark dramatic', 'storm clouds', 'danger'];
  }
  if (lowerText.includes('beauté') || lowerText.includes('magnifique') || lowerText.includes('incroyable')) {
    return ['beautiful landscape', 'nature scenic', 'stunning view'];
  }
  
  return ['documentary footage', 'cinematic scene'];
}

/**
 * Détecte le thème du texte et retourne des mots-clés vidéo appropriés
 */
function detectThemeKeywords(text: string): string[] {
  // OCÉAN / MER
  if (text.match(/océan|mer|maritime|bateau|navire|plage|côte|vague|sous-marin|profondeur/)) {
    return ['ocean waves', 'underwater footage', 'sea dramatic'];
  }
  
  // ESPACE / COSMOS
  if (text.match(/espace|étoile|galaxie|univers|planète|astronaute|nasa|cosmos|soleil|lune/)) {
    return ['space stars', 'galaxy nebula', 'cosmos'];
  }
  
  // HISTOIRE / ANTIQUITÉ
  if (text.match(/égypte|pyramide|pharaon|rome|romain|antique|ancien|civilisation|empire|grec|athènes/)) {
    return ['ancient ruins', 'historical monument', 'archaeological'];
  }
  
  // GUERRE / CONFLIT
  if (text.match(/guerre|bataille|soldat|militaire|armée|combat|conflit|nazi|seconde guerre/)) {
    return ['war historical', 'military footage', 'soldiers'];
  }
  
  // NATURE / FORÊT
  if (text.match(/forêt|jungle|arbre|nature|sauvage|animaux|montagne|désert/)) {
    return ['nature landscape', 'forest aerial', 'wildlife'];
  }
  
  // MYSTÈRE / CRIME
  if (text.match(/mystère|enquête|crime|police|detective|disparition|secret|inexpliqué/)) {
    return ['mystery fog', 'detective investigation', 'dark corridor'];
  }
  
  // VILLE / URBAIN
  if (text.match(/ville|urbain|métropole|gratte-ciel|building|rue|quartier/)) {
    return ['city night', 'urban aerial', 'cityscape timelapse'];
  }
  
  // SCIENCE / TECHNOLOGIE
  if (text.match(/science|technologie|laboratoire|recherche|innovation|découverte|invention/)) {
    return ['science laboratory', 'technology futuristic', 'research'];
  }
  
  // CATASTROPHE
  if (text.match(/catastrophe|accident|crash|explosion|tempête|ouragan|séisme|volcan/)) {
    return ['disaster dramatic', 'storm destruction', 'fire explosion'];
  }
  
  return [];
}

/**
 * Recherche des vidéos sur Pexels avec plusieurs tentatives
 */
export async function searchVideos(query: string, count: number = 10): Promise<PexelsVideo[]> {
  try {
    console.log(`🎬 Recherche vidéo Pexels: "${query}"`);
    
    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape&size=medium`,
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
    console.log(`   → ${data.videos?.length || 0} vidéos trouvées`);
    return data.videos || [];
  } catch (error) {
    console.error('Erreur recherche vidéos Pexels:', error);
    return [];
  }
}

/**
 * Recherche des images sur Pexels (fallback)
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
    console.error('Erreur recherche images Pexels:', error);
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
  
  // Préférer 1080p ou 720p pour équilibrer qualité et performance
  const hd = files.find(f => f.width >= 1280 && f.width <= 1920);
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
 * PRIORITÉ: Vidéos Pexels correspondant au contenu du texte
 */
export async function generateSceneMedia(
  scenes: Array<{ id: number; text: string; imagePrompt: string; duration: number }>,
  onProgress?: (progress: number, message: string) => void
): Promise<Array<{ sceneId: number; videoUrl: string; imageUrl: string }>> {
  const results: Array<{ sceneId: number; videoUrl: string; imageUrl: string }> = [];
  
  console.log(`\n🎬 GÉNÉRATION MÉDIAS - ${scenes.length} scènes`);
  console.log('='.repeat(50));

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const progress = ((i + 1) / scenes.length) * 100;
    
    onProgress?.(progress, `🎬 Recherche vidéo scène ${i + 1}/${scenes.length}...`);
    
    console.log(`\n📍 Scène ${i + 1}: "${scene.text.substring(0, 60)}..."`);
    
    // PRIORITÉ 1: Utiliser imagePrompt généré par Gemini (mots-clés optimisés)
    // PRIORITÉ 2: Extraire des mots-clés du texte
    const geminiKeywords = scene.imagePrompt ? scene.imagePrompt.split(/[\s,]+/).filter(k => k.length > 2) : [];
    const textKeywords = extractVisualKeywords(scene.text);
    
    // Combiner: Gemini d'abord, puis extraction du texte
    const allKeywords = [...new Set([
      scene.imagePrompt, // Prompt Gemini complet en premier
      ...geminiKeywords,
      ...textKeywords
    ])].filter(k => k && k.length > 2);
    
    console.log(`   Prompt Gemini: "${scene.imagePrompt || 'N/A'}"`);
    console.log(`   Mots-clés: ${allKeywords.slice(0, 5).join(', ')}`);
    
    let videoUrl = '';
    let imageUrl = '';
    
    // Essayer chaque mot-clé jusqu'à trouver une vidéo
    for (const keyword of allKeywords) {
      if (videoUrl) break;
      
      const videos = await searchVideos(keyword, 8);
      if (videos.length > 0) {
        // Choisir la PREMIÈRE vidéo (plus pertinente) au lieu d'aléatoire
        const selectedVideo = videos[0];
        videoUrl = getBestVideoUrl(selectedVideo);
        imageUrl = selectedVideo.video_pictures?.[0]?.picture || '';
        console.log(`   ✅ Vidéo trouvée avec "${keyword}"`);
      }
      
      // Petit délai pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    // Fallback: recherche générique basée sur le contexte
    if (!videoUrl) {
      const fallbackQuery = getFallbackVideoQuery(scene.text);
      console.log(`   ⚠️ Fallback: "${fallbackQuery}"`);
      
      const fallbackVideos = await searchVideos(fallbackQuery, 10);
      if (fallbackVideos.length > 0) {
        // Première vidéo = plus pertinente
        const selectedVideo = fallbackVideos[0];
        videoUrl = getBestVideoUrl(selectedVideo);
        imageUrl = selectedVideo.video_pictures?.[0]?.picture || '';
        console.log(`   ✅ Vidéo fallback trouvée`);
      }
    }
    
    // Dernier recours: image statique
    if (!videoUrl && !imageUrl) {
      console.log(`   ⚠️ Utilisation image statique`);
      const images = await searchImages(allKeywords[0] || 'dramatic documentary', 5);
      if (images.length > 0) {
        imageUrl = images[0]?.src?.large2x || images[0]?.src?.large || '';
      } else {
        imageUrl = 'https://images.pexels.com/photos/3408744/pexels-photo-3408744.jpeg?auto=compress&cs=tinysrgb&w=1920';
      }
    }
    
    results.push({
      sceneId: scene.id,
      videoUrl: videoUrl,
      imageUrl: imageUrl
    });

    // Délai entre les scènes
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Médias générés: ${results.filter(r => r.videoUrl).length}/${scenes.length} vidéos`);

  return results;
}

/**
 * Génère une requête de fallback basée sur le contexte global du texte
 */
function getFallbackVideoQuery(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Détecter le thème principal
  if (lowerText.includes('océan') || lowerText.includes('mer') || lowerText.includes('bateau') || lowerText.includes('navire')) {
    return 'ocean waves dramatic';
  }
  if (lowerText.includes('ciel') || lowerText.includes('nuage') || lowerText.includes('avion')) {
    return 'sky clouds aerial';
  }
  if (lowerText.includes('nuit') || lowerText.includes('sombre') || lowerText.includes('mystère')) {
    return 'night dark atmospheric';
  }
  if (lowerText.includes('histoire') || lowerText.includes('ancien') || lowerText.includes('siècle')) {
    return 'historical documentary';
  }
  if (lowerText.includes('nature') || lowerText.includes('terre') || lowerText.includes('planète')) {
    return 'nature landscape aerial';
  }
  if (lowerText.includes('feu') || lowerText.includes('flamme') || lowerText.includes('incendie')) {
    return 'fire flames dramatic';
  }
  if (lowerText.includes('guerre') || lowerText.includes('conflit') || lowerText.includes('bataille')) {
    return 'war military historical';
  }
  if (lowerText.includes('ville') || lowerText.includes('urbain') || lowerText.includes('building')) {
    return 'city urban timelapse';
  }
  if (lowerText.includes('science') || lowerText.includes('recherche') || lowerText.includes('découverte')) {
    return 'science laboratory research';
  }
  if (lowerText.includes('espace') || lowerText.includes('étoile') || lowerText.includes('univers')) {
    return 'space stars cosmos';
  }
  
  // Défaut: plans cinématiques génériques
  return 'cinematic dramatic landscape';
}
