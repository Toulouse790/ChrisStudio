/**
 * Video Generation Service
 * Generates complete videos using AI (script, images, voiceover)
 * PRODUCTION VERSION - Uses real APIs
 * 
 * Supports:
 * - Shotstack (cloud, fast, high quality) - if configured
 * - Browser Canvas (fallback, slower)
 */

import { GoogleGenAI } from '@google/genai';
import { CalendarItem, Channel } from '../types';
import { generateSceneMedia } from './mediaService';
import { generateVoiceover, isElevenLabsAvailable } from './audioService';
import { assembleVideo, generateThumbnail as createThumbnail } from './videoAssemblyService';
import { isShotstackAvailable, generateVideoWithShotstack, uploadAudioForShotstack } from './shotstackService';

// Get API key
const getApiKey = (): string => {
  const key = import.meta.env.VITE_API_KEY;
  if (!key) {
    throw new Error('VITE_API_KEY not configured');
  }
  return key;
};

// Download video from URL to Blob
const downloadVideoBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  return response.blob();
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
    
    // Log durée estimée
    const totalDuration = video.scenes.reduce((acc, s) => acc + s.duration, 0);
    const minutes = Math.floor(totalDuration / 60);
    const seconds = totalDuration % 60;
    console.log(`📊 Durée vidéo estimée: ${minutes}:${seconds.toString().padStart(2, '0')} (${video.scenes.length} scènes)`);
    onProgress?.({ stage: 'scenes', progress: 19, message: `${video.scenes.length} scènes (~${minutes}:${seconds.toString().padStart(2, '0')})` });
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
    video.status = 'assembling';
    
    // Try Shotstack for fast cloud rendering, but fallback to browser if audio upload fails
    let useShotstack = isShotstackAvailable();
    let audioUrl: string | null = null;
    
    if (useShotstack && video.voiceoverBlob) {
      onProgress?.({ stage: 'assembly', progress: 72, message: 'Tentative upload audio pour Shotstack...' });
      audioUrl = await uploadAudioForShotstack(video.voiceoverBlob);
      
      if (!audioUrl) {
        console.warn('⚠️ Audio upload failed - using browser assembly to preserve audio');
        onProgress?.({ stage: 'assembly', progress: 73, message: '⚠️ Upload audio échoué, utilisation assemblage navigateur...' });
        useShotstack = false; // Force browser assembly to keep audio
      }
    }
    
    if (useShotstack) {
      onProgress?.({ stage: 'assembly', progress: 74, message: '⚡ Rendu cloud Shotstack (ultra-rapide)...' });
      
      try {
        // Prepare media for Shotstack
        const shotstackScenes = video.scenes.map(s => ({
          imageUrl: s.imageUrl || '',
          text: s.text,
          duration: s.duration
        }));
        
        // Generate video with Shotstack
        const result = await generateVideoWithShotstack(
          shotstackScenes,
          audioUrl || undefined,
          (progress, message) => {
            onProgress?.({ 
              stage: 'assembly', 
              progress: 74 + (progress * 0.20), 
              message: `Shotstack: ${message}` 
            });
          }
        );
        
        if ('error' in result) {
          throw new Error(result.error);
        }
        
        onProgress?.({ stage: 'assembly', progress: 95, message: 'Téléchargement de la vidéo HD...' });
        video.videoBlob = await downloadVideoBlob(result.videoUrl);
        video.finalVideoUrl = URL.createObjectURL(video.videoBlob);
        video.progress = 97;
        
      } catch (shotstackError) {
        console.warn('Shotstack failed, falling back to browser assembly:', shotstackError);
        onProgress?.({ stage: 'assembly', progress: 72, message: 'Fallback: assemblage navigateur...' });
        
        // Fallback to browser assembly
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
      }
    } else {
      // Browser-based assembly (slower but works without API key)
      onProgress?.({ stage: 'assembly', progress: 72, message: 'Assemblage navigateur (ajoutez SHOTSTACK pour accélérer)...' });
      
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
    }

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
 * Generate a detailed script for the video - OPTIMISÉ MONETISATION 15-18 MIN
 */
async function generateScript(item: CalendarItem, channel: Channel): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const prompt = `Tu es un scénariste expert YouTube spécialisé dans les vidéos longues à forte rétention.

CHAÎNE: ${channel.name}
THÈME: ${channel.theme}
TITRE: ${item.title}
SUJET: ${item.description}

=== CONTRAINTE ABSOLUE ===
Le script DOIT faire EXACTEMENT entre 2500 et 3000 MOTS.
C'est OBLIGATOIRE pour atteindre 15-18 minutes de vidéo.
Chaque paragraphe doit faire 150-200 mots minimum.
Tu dois écrire 15-20 paragraphes substantiels.

=== STRUCTURE DÉTAILLÉE (15-18 min) ===

PARAGRAPHE 1 - HOOK (150 mots):
Commence par une question choc ou un fait surprenant. Capte immédiatement l'attention.

PARAGRAPHE 2 - TEASER (150 mots):
Promets ce que le spectateur va découvrir. Crée l'attente et l'excitation.

PARAGRAPHES 3-4 - CONTEXTE (300 mots):
Pose le décor historique/scientifique. Donne le background nécessaire pour comprendre.

PARAGRAPHES 5-12 - CONTENU PRINCIPAL (1400 mots):
8 sections détaillées avec cliffhangers entre chaque. Alterne:
- Faits historiques/scientifiques
- Histoires captivantes
- Révélations surprenantes
- Théories alternatives
Utilise "Mais attendez...", "Et c'est là que...", "Ce que personne ne vous dit..."

PARAGRAPHES 13-14 - TWIST (300 mots):
La révélation la plus surprenante gardée pour la fin. Le moment "wow".

PARAGRAPHE 15 - SYNTHÈSE (150 mots):
Récapitule les points clés de façon percutante.

PARAGRAPHE 16 - CTA + OUTRO (150 mots):
Appel à l'action fort. Teaser pour la prochaine vidéo. "Abonnez-vous pour ne rien manquer."

=== STYLE D'ÉCRITURE ===
- Ton narratif captivant, comme un documentaire Netflix
- Phrases courtes et percutantes alternées avec des explications détaillées
- Questions rhétoriques régulières pour maintenir l'engagement
- Vocabulaire accessible mais pas simpliste
- Chaque paragraphe = une scène visuelle distincte
- Sépare les paragraphes par des lignes vides

=== RAPPEL IMPORTANT ===
Le script doit faire 2500-3000 mots MINIMUM.
Ne t'arrête pas avant d'avoir atteint cette longueur.
Développe chaque idée en détail.

Génère maintenant le script complet en français:

`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt
  });

  const script = response.text || '';
  
  // Log word count for debug
  const wordCount = script.split(/\s+/).length;
  console.log(`📝 Script généré: ${wordCount} mots`);
  
  return script;
}

/**
 * Parse script into individual scenes - OPTIMISÉ pour 15-18 min
 */
function parseScriptToScenes(script: string): GeneratedScene[] {
  // Split by paragraphs or scene indicators
  const paragraphs = script.split(/\n\n+/).filter(p => p.trim().length > 30);
  
  // Pour atteindre 15-18 min, on garde jusqu'à 30 scènes
  // Durée moyenne de lecture vocale: ~150 mots/minute = 2.5 mots/seconde
  return paragraphs.slice(0, 30).map((text, index) => {
    const wordCount = text.split(/\s+/).length;
    // Durée basée sur la lecture vocale: 150 mots/min = 2.5 mots/sec
    // Minimum 8 secondes par scène pour lisibilité
    const estimatedDuration = Math.max(8, Math.ceil(wordCount / 2.5));
    
    return {
      id: index + 1,
      text: text.trim(),
      imagePrompt: '',
      duration: estimatedDuration
    };
  });
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
