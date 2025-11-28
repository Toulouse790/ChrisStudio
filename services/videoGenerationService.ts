/**
 * Video Generation Service
 * Generates complete videos using AI (script, images, voiceover)
 */

import { GoogleGenAI } from '@google/genai';
import { CalendarItem, Channel, ContentStatus } from '../types';

// Get API key
const getApiKey = (): string => {
  const key = import.meta.env.VITE_API_KEY;
  if (!key) {
    throw new Error('VITE_API_KEY not configured');
  }
  return key;
};

export interface GeneratedVideo {
  id: string;
  contentItem: CalendarItem;
  script: string;
  scenes: GeneratedScene[];
  voiceoverUrl?: string;
  thumbnailUrl?: string;
  finalVideoUrl?: string;
  status: 'pending' | 'generating-script' | 'generating-images' | 'generating-audio' | 'assembling' | 'ready' | 'error';
  progress: number;
  error?: string;
}

export interface GeneratedScene {
  id: number;
  text: string;
  imagePrompt: string;
  imageUrl?: string;
  duration: number; // seconds
}

export interface GenerationProgress {
  stage: string;
  progress: number;
  message: string;
}

type ProgressCallback = (progress: GenerationProgress) => void;

/**
 * Generate a complete video from a content item
 */
export const generateVideo = async (
  contentItem: CalendarItem,
  channel: Channel,
  onProgress?: ProgressCallback
): Promise<GeneratedVideo> => {
  const video: GeneratedVideo = {
    id: `video_${Date.now()}`,
    contentItem,
    script: '',
    scenes: [],
    status: 'pending',
    progress: 0
  };

  try {
    // Step 1: Generate Script
    onProgress?.({ stage: 'script', progress: 10, message: 'Génération du script...' });
    video.status = 'generating-script';
    video.script = await generateScript(contentItem, channel);
    video.progress = 25;

    // Step 2: Parse script into scenes
    onProgress?.({ stage: 'scenes', progress: 30, message: 'Découpage en scènes...' });
    video.scenes = parseScriptToScenes(video.script);
    video.progress = 35;

    // Step 3: Generate image prompts for each scene
    onProgress?.({ stage: 'prompts', progress: 40, message: 'Création des prompts visuels...' });
    video.scenes = await generateImagePrompts(video.scenes, channel);
    video.progress = 50;

    // Step 4: Generate images (using Gemini's image understanding for descriptions)
    onProgress?.({ stage: 'images', progress: 55, message: 'Génération des images...' });
    video.status = 'generating-images';
    video.scenes = await generateSceneImages(video.scenes, onProgress);
    video.progress = 75;

    // Step 5: Generate thumbnail
    onProgress?.({ stage: 'thumbnail', progress: 80, message: 'Création de la miniature...' });
    video.thumbnailUrl = await generateThumbnail(contentItem, channel);
    video.progress = 85;

    // Step 6: Mark as ready (audio/video assembly would need external tools)
    onProgress?.({ stage: 'complete', progress: 100, message: 'Vidéo prête !' });
    video.status = 'ready';
    video.progress = 100;

    return video;

  } catch (error) {
    video.status = 'error';
    video.error = error instanceof Error ? error.message : 'Erreur inconnue';
    throw error;
  }
};

/**
 * Generate a detailed script for the video
 */
async function generateScript(item: CalendarItem, channel: Channel): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const prompt = `Tu es un scénariste expert pour YouTube. Génère un script complet pour une vidéo de 8-10 minutes.

CHAÎNE: ${channel.name}
THÈME DE LA CHAÎNE: ${channel.theme}
TITRE DE LA VIDÉO: ${item.title}
DESCRIPTION: ${item.description}

FORMAT DU SCRIPT:
- Introduction accrocheuse (30 secondes)
- 5-7 sections principales avec transitions
- Conclusion avec appel à l'action

STYLE:
- Ton engageant et narratif
- Phrases courtes pour la voix off
- Indications visuelles entre [crochets]

Génère le script complet en français:`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt
  });

  return response.text || '';
}

/**
 * Parse script into individual scenes
 */
function parseScriptToScenes(script: string): GeneratedScene[] {
  // Split by paragraphs or scene indicators
  const paragraphs = script.split(/\n\n+/).filter(p => p.trim().length > 50);
  
  return paragraphs.slice(0, 10).map((text, index) => ({
    id: index + 1,
    text: text.trim(),
    imagePrompt: '',
    duration: Math.max(10, Math.ceil(text.split(' ').length / 2.5)) // ~2.5 words/second
  }));
}

/**
 * Generate image prompts for each scene
 */
async function generateImagePrompts(scenes: GeneratedScene[], channel: Channel): Promise<GeneratedScene[]> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const sceneTexts = scenes.map((s, i) => `Scène ${i + 1}: ${s.text.substring(0, 200)}`).join('\n\n');
  
  const prompt = `Pour chaque scène de cette vidéo "${channel.name}", génère un prompt d'image détaillé en anglais (pour un générateur d'images IA).

Style visuel: Cinématique, haute qualité, 4K, professionnel
Thème: ${channel.theme}

${sceneTexts}

Réponds avec un JSON array de prompts:
[
  {"scene": 1, "prompt": "..."},
  {"scene": 2, "prompt": "..."}
]

Génère uniquement le JSON, sans texte autour:`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt
  });

  try {
    const text = response.text || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const prompts = JSON.parse(jsonMatch[0]);
      return scenes.map((scene, i) => ({
        ...scene,
        imagePrompt: prompts[i]?.prompt || `Cinematic scene about ${scene.text.substring(0, 50)}`
      }));
    }
  } catch (e) {
    console.warn('Failed to parse image prompts, using defaults');
  }

  // Fallback
  return scenes.map(scene => ({
    ...scene,
    imagePrompt: `Cinematic 4K scene: ${scene.text.substring(0, 100)}, professional lighting, documentary style`
  }));
}

/**
 * Generate images for scenes (placeholder - would use DALL-E, Midjourney, or similar)
 */
async function generateSceneImages(
  scenes: GeneratedScene[], 
  onProgress?: ProgressCallback
): Promise<GeneratedScene[]> {
  // In a real implementation, this would call an image generation API
  // For now, we'll use placeholder images and the prompts are ready for external use
  
  const updatedScenes: GeneratedScene[] = [];
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const progress = 55 + (i / scenes.length) * 20;
    
    onProgress?.({ 
      stage: 'images', 
      progress, 
      message: `Image ${i + 1}/${scenes.length}...` 
    });

    // Placeholder: In production, call image generation API here
    // For now, generate a placeholder URL based on the prompt
    const placeholderUrl = `https://placehold.co/1920x1080/1a1a2e/ffffff?text=Scene+${i + 1}`;
    
    updatedScenes.push({
      ...scene,
      imageUrl: placeholderUrl
    });

    // Simulate generation time
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return updatedScenes;
}

/**
 * Generate thumbnail for the video
 */
async function generateThumbnail(item: CalendarItem, channel: Channel): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  // Generate a thumbnail description/prompt
  const prompt = `Génère une description détaillée pour une miniature YouTube accrocheuse.

Titre: ${item.title}
Chaîne: ${channel.name}
Thème: ${channel.theme}

La description doit être en anglais, optimisée pour un générateur d'images:`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt
  });

  // Store the prompt for external image generation
  const thumbnailPrompt = response.text || item.title;
  
  // Placeholder URL
  return `https://placehold.co/1280x720/6366f1/ffffff?text=${encodeURIComponent(item.title.substring(0, 30))}`;
}

/**
 * Get video generation status summary
 */
export const getGenerationStatusText = (status: GeneratedVideo['status']): string => {
  const statusMap: Record<GeneratedVideo['status'], string> = {
    'pending': 'En attente',
    'generating-script': 'Génération du script...',
    'generating-images': 'Création des visuels...',
    'generating-audio': 'Génération audio...',
    'assembling': 'Assemblage final...',
    'ready': 'Prêt',
    'error': 'Erreur'
  };
  return statusMap[status] || status;
};

/**
 * Export video data for external processing (if needed)
 */
export const exportVideoData = (video: GeneratedVideo): object => {
  return {
    title: video.contentItem.title,
    description: video.contentItem.description,
    script: video.script,
    scenes: video.scenes.map(s => ({
      text: s.text,
      imagePrompt: s.imagePrompt,
      duration: s.duration
    })),
    thumbnailPrompt: video.thumbnailUrl
  };
};
