/**
 * Image Generation Service - Recherche d'images optimisée
 * 
 * Utilise Pexels directement avec des mots-clés intelligents
 * AUCUN token Gemini = 0€ pour les images
 */

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;

/**
 * Recherche une image sur Pexels
 */
async function searchPexelsImage(query: string): Promise<string | null> {
  if (!PEXELS_API_KEY) return null;
  
  const keywords = query
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['cinematic', 'quality', 'professional', 'dramatic', 'lighting', 'style', 'film', 'grain', 'widescreen', 'aspect', 'ratio', 'high', 'scene', 'showing', 'depicting', 'with', 'from', 'that', 'this'].includes(w))
    .slice(0, 5)
    .join(' ');
  
  if (!keywords || keywords.length < 3) return null;
  
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=10&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.photos?.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(5, data.photos.length));
        return data.photos[randomIndex]?.src?.large2x || data.photos[randomIndex]?.src?.large || data.photos[0]?.src?.large;
      }
    }
  } catch (e) {
    console.warn('Pexels search failed:', e);
  }
  
  return null;
}

/**
 * Traduction FR → EN des termes courants
 */
function translateToEnglish(text: string): string {
  const translations: Record<string, string> = {
    'jésus': 'jesus christ religious', 'croix': 'cross crucifixion', 'bible': 'bible ancient',
    'église': 'church cathedral', 'prière': 'prayer spiritual', 'dieu': 'god divine light',
    'apôtre': 'apostle disciple', 'miracle': 'miracle divine', 'résurrection': 'resurrection light',
    'tombeau': 'tomb ancient stone', 'jerusalem': 'jerusalem ancient city', 'jérusalem': 'jerusalem ancient city',
    'égypte': 'egypt ancient pyramid', 'pyramide': 'pyramid giza', 'pharaon': 'pharaoh egyptian',
    'sphinx': 'sphinx egypt', 'nil': 'nile river egypt', 'momie': 'mummy ancient',
    'océan': 'ocean sea waves', 'mer': 'sea ocean water', 'montagne': 'mountain landscape',
    'forêt': 'forest trees nature', 'désert': 'desert sand dunes', 'ciel': 'sky clouds',
    'nuit': 'night dark stars', 'soleil': 'sun sunset golden', 'lune': 'moon night sky',
    'mystère': 'mystery dark fog', 'secret': 'secret hidden shadow',
    'peur': 'fear dark shadow', 'espoir': 'hope light sunrise',
    'mort': 'death dark somber', 'vie': 'life nature vibrant',
    'voyage': 'journey travel road', 'découverte': 'discovery exploration',
    'guerre': 'war battle soldiers', 'paix': 'peace serene calm',
    'ancien': 'ancient historical ruins', 'moderne': 'modern city technology',
    'roi': 'king royal throne', 'reine': 'queen royal elegant',
    'soldat': 'soldier warrior armor', 'prêtre': 'priest religious church',
    'romain': 'roman empire ancient', 'rome': 'rome ancient empire',
    'temple': 'temple ancient sacred', 'sacrifice': 'sacrifice ancient ritual',
  };
  
  const lowerText = text.toLowerCase();
  for (const [fr, en] of Object.entries(translations)) {
    if (lowerText.includes(fr)) return en;
  }
  
  return text.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 4).slice(0, 4).join(' ');
}

/**
 * Query contextuelle basée sur le thème détecté
 */
function getContextualQuery(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('jésus') || lowerText.includes('christ') || lowerText.includes('croix')) {
    return 'ancient jerusalem holy land religious';
  }
  if (lowerText.includes('égypte') || lowerText.includes('pyramide') || lowerText.includes('pharaon')) {
    return 'egypt pyramid ancient desert';
  }
  if (lowerText.includes('océan') || lowerText.includes('mer') || lowerText.includes('bateau')) {
    return 'ocean sea waves dramatic';
  }
  if (lowerText.includes('espace') || lowerText.includes('étoile') || lowerText.includes('galaxie')) {
    return 'space galaxy stars cosmos';
  }
  if (lowerText.includes('guerre') || lowerText.includes('bataille')) {
    return 'war soldiers battle historical';
  }
  if (lowerText.includes('mystère') || lowerText.includes('secret')) {
    return 'mystery fog dark atmospheric';
  }
  if (lowerText.includes('nature') || lowerText.includes('forêt') || lowerText.includes('montagne')) {
    return 'nature landscape mountain dramatic';
  }
  
  return 'dramatic cinematic landscape';
}

/**
 * Génère une image pour une scène - 100% Pexels = 0 tokens
 */
export async function generateSceneImage(prompt: string, sceneText: string): Promise<string> {
  console.log('🔍 Recherche image Pexels pour:', prompt.substring(0, 50) + '...');
  
  // Essayer avec le prompt d'image (déjà en anglais)
  let image = await searchPexelsImage(prompt);
  if (image) {
    console.log('✅ Image trouvée avec prompt');
    return image;
  }
  
  // Essayer avec le texte de la scène traduit
  const translatedText = translateToEnglish(sceneText);
  console.log('🔄 Essai avec traduction:', translatedText);
  image = await searchPexelsImage(translatedText);
  if (image) {
    console.log('✅ Image trouvée avec traduction');
    return image;
  }
  
  // Fallback générique basé sur le contexte
  const genericQuery = getContextualQuery(sceneText);
  console.log('🔄 Essai avec query contextuelle:', genericQuery);
  image = await searchPexelsImage(genericQuery);
  if (image) {
    console.log('✅ Image trouvée avec query contextuelle');
    return image;
  }
  
  // Dernier recours
  console.warn('⚠️ Fallback image générique');
  return 'https://images.pexels.com/photos/3408744/pexels-photo-3408744.jpeg?auto=compress&cs=tinysrgb&w=1920';
}

/**
 * Vérifie si le service d'images est disponible
 */
export function isGeminiImagenAvailable(): boolean {
  return !!PEXELS_API_KEY;
}
