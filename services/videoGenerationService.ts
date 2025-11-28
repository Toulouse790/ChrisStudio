/**
 * Video Generation Service
 * Generates complete videos using AI (script, images, voiceover)
 * PRODUCTION VERSION - Uses real APIs
 */

import { GoogleGenAI } from '@google/genai';
import { CalendarItem, Channel } from '../types';
import { generateSceneMedia, searchImages } from './mediaService';
import { generateVoiceover, isElevenLabsAvailable } from './audioService';
import { assembleVideo, generateThumbnail as createThumbnail } from './videoAssemblyService';

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
  voiceoverBlob?: Blob;
  thumbnailBlob?: Blob;
  videoBlob?: Blob;
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
  videoUrl?: string;
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
    onProgress?.({ stage: 'script', progress: 5, message: 'Génération du script...' });
    video.status = 'generating-script';
    video.script = await generateScript(contentItem, channel);
    video.progress = 15;

    // Step 2: Parse script into scenes
    onProgress?.({ stage: 'scenes', progress: 18, message: 'Découpage en scènes...' });
    video.scenes = parseScriptToScenes(video.script);
    video.progress = 20;

    // Step 3: Generate image prompts for each scene
    onProgress?.({ stage: 'prompts', progress: 22, message: 'Création des prompts visuels...' });
    video.scenes = await generateImagePrompts(video.scenes, channel);
    video.progress = 25;

    // Step 4: Fetch real images/videos from Pexels
    onProgress?.({ stage: 'images', progress: 28, message: 'Recherche des médias sur Pexels...' });
    video.status = 'generating-images';
    video.scenes = await generateSceneImages(video.scenes, (p, m) => {
      onProgress?.({ stage: 'images', progress: 28 + (p * 0.22), message: m });
    });
    video.progress = 50;

    // Step 5: Generate voiceover
    onProgress?.({ stage: 'audio', progress: 52, message: `Génération voix off (${isElevenLabsAvailable() ? 'ElevenLabs' : 'Navigateur'})...` });
    video.status = 'generating-audio';
    const voiceText = video.scenes.map(s => s.text).join('\n\n');
    video.voiceoverBlob = await generateVoiceover(voiceText, (p, m) => {
      onProgress?.({ stage: 'audio', progress: 52 + (p * 0.15), message: m });
    });
    video.voiceoverUrl = URL.createObjectURL(video.voiceoverBlob);
    video.progress = 67;

    // Step 6: Generate thumbnail
    onProgress?.({ stage: 'thumbnail', progress: 68, message: 'Création de la miniature...' });
    const thumbnailImageUrl = video.scenes[0]?.imageUrl || '';
    video.thumbnailBlob = await createThumbnail(thumbnailImageUrl, contentItem.title);
    video.thumbnailUrl = URL.createObjectURL(video.thumbnailBlob);
    video.progress = 70;

    // Step 7: Assemble final video
    onProgress?.({ stage: 'assembly', progress: 72, message: 'Assemblage de la vidéo...' });
    video.status = 'assembling';
    const videoScenes = video.scenes.map(s => ({
      imageUrl: s.imageUrl || '',
      videoUrl: s.videoUrl,
      text: s.text,
      duration: s.duration
    }));
    video.videoBlob = await assembleVideo(videoScenes, video.voiceoverBlob, {}, (p, m) => {
      onProgress?.({ stage: 'assembly', progress: 72 + (p * 0.25), message: m });
    });
    video.finalVideoUrl = URL.createObjectURL(video.videoBlob);
    video.progress = 97;

    // Step 8: Complete
    onProgress?.({ stage: 'complete', progress: 100, message: 'Vidéo prête à publier !' });
    video.status = 'ready';
    video.progress = 100;

    return video;

  } catch (error) {
    video.status = 'error';
    video.error = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('Video generation error:', error);
    throw error;
  }
};

/**
 * Generate a detailed script for the video - OPTIMISÉ MONETISATION
 */
async function generateScript(item: CalendarItem, channel: Channel): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const prompt = `Tu es un scénariste expert YouTube spécialisé dans les vidéos à forte rétention et monétisation.

CHAÎNE: ${channel.name}
THÈME: ${channel.theme}
TITRE: ${item.title}
SUJET: ${item.description}

OBJECTIF: Créer un script de 8-10 minutes qui MAXIMISE la rétention et l'engagement.

STRUCTURE OPTIMISÉE YOUTUBE:
1. HOOK (0-30s): Question choc ou fait surprenant pour captiver immédiatement
2. TEASER (30s-1min): Promettre ce que le spectateur va apprendre, créer l'attente
3. CONTENU PRINCIPAL (1-8min): 5-6 sections avec cliffhangers entre chaque
4. TWIST/RÉVÉLATION (8-9min): Information la plus surprenante gardée pour la fin
5. CTA + OUTRO (9-10min): Appel à l'action et teaser prochaine vidéo

TECHNIQUES DE RÉTENTION:
- Phrases courtes et percutantes
- Questions rhétoriques régulières
- "Mais attendez, ce n'est pas tout..."
- "Et c'est là que ça devient vraiment intéressant..."
- Créer de la curiosité à chaque transition

STYLE:
- Ton narratif captivant, comme un documentaire Netflix
- Vocabulaire accessible mais pas simpliste
- Indications visuelles entre [crochets] pour chaque scène
- Chaque paragraphe = une scène visuelle distincte

FORMAT DE SORTIE:
Génère le script complet en français avec des paragraphes bien séparés.
Chaque paragraphe sera une scène de la vidéo.

SCRIPT:`;

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
 * Generate images for scenes using Pexels API
 */
async function generateSceneImages(
  scenes: GeneratedScene[], 
  onProgress?: (progress: number, message: string) => void
): Promise<GeneratedScene[]> {
  const mediaResults = await generateSceneMedia(scenes, onProgress);
  
  return scenes.map((scene, index) => {
    const media = mediaResults.find(m => m.sceneId === scene.id) || mediaResults[index];
    return {
      ...scene,
      imageUrl: media?.imageUrl || '',
      videoUrl: media?.videoUrl || ''
    };
  });
}

/**
 * Get video generation status summary
 */
export const getGenerationStatusText = (status: GeneratedVideo['status']): string => {
  const statusMap: Record<GeneratedVideo['status'], string> = {
    'pending': 'En attente',
    'generating-script': 'Génération du script...',
    'generating-images': 'Recherche médias Pexels...',
    'generating-audio': 'Synthèse vocale...',
    'assembling': 'Assemblage vidéo...',
    'ready': 'Prêt à publier',
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
      imageUrl: s.imageUrl,
      videoUrl: s.videoUrl,
      duration: s.duration
    })),
    hasVideo: !!video.videoBlob,
    hasThumbnail: !!video.thumbnailBlob,
    hasVoiceover: !!video.voiceoverBlob
  };
};

/**
 * Download the generated video
 */
export const downloadGeneratedVideo = (video: GeneratedVideo): void => {
  if (!video.videoBlob) {
    throw new Error('No video available to download');
  }
  
  const url = URL.createObjectURL(video.videoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${video.contentItem.title.replace(/[^a-zA-Z0-9]/g, '_')}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Get the video file for YouTube upload
 */
export const getVideoFile = (video: GeneratedVideo): File | null => {
  if (!video.videoBlob) return null;
  
  return new File(
    [video.videoBlob], 
    `${video.contentItem.title.replace(/[^a-zA-Z0-9]/g, '_')}.webm`,
    { type: 'video/webm' }
  );
};

/**
 * Get the thumbnail file for YouTube upload
 */
export const getThumbnailFile = (video: GeneratedVideo): File | null => {
  if (!video.thumbnailBlob) return null;
  
  return new File(
    [video.thumbnailBlob],
    `thumbnail_${video.id}.jpg`,
    { type: 'image/jpeg' }
  );
};
