/**
 * Shotstack Video Rendering Service
 * API cloud pour génération vidéo rapide et haute qualité
 * https://shotstack.io
 * 
 * Avantages:
 * - Génération en ~30 secondes (vs 15+ minutes navigateur)
 * - Export MP4 H.264 natif (optimal YouTube)
 * - 1080p/4K
 * - Transitions professionnelles
 * - Ken Burns, zoom, pan
 */

const SHOTSTACK_API_KEY = import.meta.env.VITE_SHOTSTACK_API_KEY;
const SHOTSTACK_ENV = import.meta.env.VITE_SHOTSTACK_ENV || 'sandbox';
// sandbox = tests gratuits, v1 = production
const SHOTSTACK_API_URL = SHOTSTACK_ENV === 'production' 
  ? 'https://api.shotstack.io/v1'
  : 'https://api.shotstack.io/stage';

interface ShotstackClip {
  asset: {
    type: 'image' | 'video' | 'audio' | 'title';
    src?: string;
    text?: string;
    style?: string;
    effect?: string;
  };
  start: number;
  length: number;
  effect?: string;
  transition?: {
    in?: string;
    out?: string;
  };
  fit?: 'crop' | 'cover' | 'contain';
}

interface ShotstackTrack {
  clips: ShotstackClip[];
}

interface ShotstackTimeline {
  soundtrack?: {
    src: string;
    effect?: string;
  };
  background?: string;
  tracks: ShotstackTrack[];
}

interface ShotstackEdit {
  timeline: ShotstackTimeline;
  output: {
    format: 'mp4' | 'webm' | 'gif';
    resolution: 'hd' | 'sd' | '1080' | '4k';
    fps?: number;
    quality?: 'low' | 'medium' | 'high';
  };
}

interface ShotstackRenderResponse {
  success: boolean;
  message: string;
  response: {
    id: string;
    status: string;
  };
}

interface ShotstackStatusResponse {
  success: boolean;
  response: {
    id: string;
    status: 'queued' | 'fetching' | 'rendering' | 'saving' | 'done' | 'failed';
    url?: string;
    error?: string;
  };
}

/**
 * Vérifie si Shotstack est configuré
 */
export function isShotstackAvailable(): boolean {
  const available = !!SHOTSTACK_API_KEY;
  console.log('🎬 Shotstack disponible:', available, '| ENV:', SHOTSTACK_ENV, '| API URL:', SHOTSTACK_API_URL);
  return available;
}

/**
 * Crée une timeline Shotstack à partir des scènes
 * PRIORITÉ: Vidéos Pexels > Images statiques
 */
export function createTimeline(
  scenes: Array<{ imageUrl: string; videoUrl?: string; text: string; duration: number }>,
  audioUrl?: string
): ShotstackEdit {
  let currentTime = 0;
  
  // Track pour les médias (vidéos préférées, images en fallback)
  const mediaClips: ShotstackClip[] = scenes.map((scene, index) => {
    // Préférer les vidéos si disponibles
    const hasVideo = scene.videoUrl && scene.videoUrl.length > 0;
    
    const clip: ShotstackClip = {
      asset: {
        type: hasVideo ? 'video' : 'image',
        src: hasVideo ? scene.videoUrl : scene.imageUrl,
      },
      start: currentTime,
      length: scene.duration,
      effect: hasVideo ? undefined : 'zoomIn', // Ken Burns uniquement pour images
      fit: 'cover',
      transition: {
        in: index === 0 ? 'fade' : 'slideLeft',
        out: 'fade'
      }
    };
    
    console.log(`📹 Scène ${index + 1}: ${hasVideo ? 'VIDÉO' : 'IMAGE'} (${scene.duration}s)`);
    
    currentTime += scene.duration;
    return clip;
  });

  // Track pour les sous-titres - diviser chaque scène en plusieurs sous-titres courts
  currentTime = 0;
  const titleClips: ShotstackClip[] = [];
  
  scenes.forEach((scene) => {
    // Diviser le texte en phrases courtes (max 80 caractères)
    const sentences = scene.text.match(/[^.!?]+[.!?]+/g) || [scene.text];
    const shortSentences: string[] = [];
    
    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.length <= 80) {
        shortSentences.push(trimmed);
      } else {
        // Couper les phrases trop longues au milieu
        const words = trimmed.split(' ');
        let current = '';
        words.forEach(word => {
          if ((current + ' ' + word).length <= 80) {
            current = current ? current + ' ' + word : word;
          } else {
            if (current) shortSentences.push(current);
            current = word;
          }
        });
        if (current) shortSentences.push(current);
      }
    });
    
    // Durée par sous-titre
    const durationPerSubtitle = scene.duration / Math.max(1, shortSentences.length);
    
    shortSentences.forEach((text) => {
      titleClips.push({
        asset: {
          type: 'title',
          text: text,
          style: 'minimal', // Style plus lisible
        },
        start: currentTime,
        length: durationPerSubtitle,
      });
      currentTime += durationPerSubtitle;
    });
  });
  
  // Reset currentTime pour les images
  currentTime = 0;

  const timeline: ShotstackTimeline = {
    background: '#000000',
    tracks: [
      { clips: titleClips },  // Track 0: sous-titres (au-dessus)
      { clips: mediaClips },  // Track 1: vidéos/images (en-dessous)
    ]
  };

  // Ajouter l'audio si disponible
  if (audioUrl) {
    timeline.soundtrack = {
      src: audioUrl,
      effect: 'fadeOut'
    };
  }

  return {
    timeline,
    output: {
      format: 'mp4',
      resolution: '1080',
      fps: 25,
      quality: 'high'
    }
  };
}

/**
 * Lance le rendu vidéo sur Shotstack
 */
export async function renderVideo(
  edit: ShotstackEdit
): Promise<{ id: string } | { error: string }> {
  if (!SHOTSTACK_API_KEY) {
    return { error: 'Shotstack API key not configured' };
  }

  try {
    const response = await fetch(`${SHOTSTACK_API_URL}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY
      },
      body: JSON.stringify(edit)
    });

    if (!response.ok) {
      const error = await response.text();
      return { error: `Shotstack API error: ${error}` };
    }

    const data: ShotstackRenderResponse = await response.json();
    
    if (!data.success) {
      return { error: data.message };
    }

    return { id: data.response.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Vérifie le statut du rendu
 */
export async function checkRenderStatus(
  renderId: string
): Promise<ShotstackStatusResponse['response']> {
  if (!SHOTSTACK_API_KEY) {
    throw new Error('Shotstack API key not configured');
  }

  const response = await fetch(`${SHOTSTACK_API_URL}/render/${renderId}`, {
    headers: {
      'x-api-key': SHOTSTACK_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Shotstack API error: ${response.status}`);
  }

  const data: ShotstackStatusResponse = await response.json();
  return data.response;
}

/**
 * Attend que le rendu soit terminé (polling)
 */
export async function waitForRender(
  renderId: string,
  onProgress?: (status: string) => void,
  maxWaitSeconds: number = 300
): Promise<string> {
  const startTime = Date.now();
  const pollInterval = 3000; // 3 secondes

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const status = await checkRenderStatus(renderId);
    
    onProgress?.(status.status);

    if (status.status === 'done' && status.url) {
      return status.url;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Render failed');
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Render timeout');
}

/**
 * Génère une vidéo complète via Shotstack
 * PRIORITÉ: Vidéos Pexels > Images statiques
 */
export async function generateVideoWithShotstack(
  scenes: Array<{ imageUrl: string; videoUrl?: string; text: string; duration: number }>,
  audioUrl?: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{ videoUrl: string } | { error: string }> {
  console.log('🎬 generateVideoWithShotstack appelé avec', scenes.length, 'scènes');
  
  // Log combien de scènes ont des vidéos vs images
  const videoCount = scenes.filter(s => s.videoUrl && s.videoUrl.length > 0).length;
  console.log(`   📹 ${videoCount}/${scenes.length} scènes ont des clips vidéo`);
  
  if (!isShotstackAvailable()) {
    return { error: 'Shotstack non configuré. Ajoutez VITE_SHOTSTACK_API_KEY dans .env.local' };
  }

  try {
    onProgress?.(10, 'Préparation du montage Shotstack...');
    
    const edit = createTimeline(scenes, audioUrl);
    console.log('🎬 Timeline créée:', JSON.stringify(edit).substring(0, 500) + '...');
    
    onProgress?.(20, 'Envoi vers Shotstack...');
    
    const renderResult = await renderVideo(edit);
    console.log('🎬 Résultat rendu:', renderResult);
    
    if ('error' in renderResult) {
      return { error: renderResult.error };
    }

    onProgress?.(30, 'Rendu en cours sur le cloud...');
    
    const videoUrl = await waitForRender(
      renderResult.id,
      (status) => {
        const progressMap: Record<string, number> = {
          'queued': 35,
          'fetching': 45,
          'rendering': 60,
          'saving': 85,
          'done': 100
        };
        const progress = progressMap[status] || 50;
        onProgress?.(progress, `Shotstack: ${status}...`);
      }
    );

    onProgress?.(100, 'Vidéo HD prête !');
    
    return { videoUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Erreur Shotstack' };
  }
}

/**
 * Upload un fichier audio vers un service de stockage temporaire
 * (Shotstack a besoin d'une URL publique)
 * Utilise notre Worker Cloudflare comme proxy pour éviter CORS
 */
export async function uploadAudioForShotstack(audioBlob: Blob): Promise<string | null> {
  console.log('🎵 Upload audio pour Shotstack, taille:', (audioBlob.size / 1024 / 1024).toFixed(2), 'MB');
  
  const ttsApiUrl = import.meta.env.VITE_TTS_API_URL;
  
  // L'audio est trop gros pour base64 via JSON si > 5MB
  // On va essayer plusieurs approches
  
  // Option 1: Upload via Worker Cloudflare (R2 ou services externes)
  if (ttsApiUrl && audioBlob.size < 15 * 1024 * 1024) { // Max 15MB pour base64 via Worker
    try {
      console.log('🎵 Essai upload via Worker Cloudflare...');
      
      // Convertir en base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const response = await fetch(`${ttsApiUrl}/upload-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64Audio,
          filename: `voiceover_${Date.now()}.mp3`
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          console.log('✅ Audio uploadé via Worker:', data.url, '| Storage:', data.storage);
          return data.url;
        }
        if (data.error) {
          console.warn('Worker error:', data.error);
        }
      } else {
        const errorText = await response.text();
        console.warn('Worker upload failed:', response.status, errorText);
      }
    } catch (e) {
      console.warn('Worker Cloudflare upload failed:', e);
    }
  }

  // Si l'audio est trop gros ou le Worker échoue, on ne peut pas utiliser Shotstack avec audio
  // L'assemblage navigateur sera utilisé à la place (garde l'audio)
  console.warn('⚠️ Upload audio échoué - L\'assemblage navigateur sera utilisé (avec audio)');
  console.log('💡 Pour Shotstack avec audio, active Cloudflare R2 dans le dashboard');
  return null;
}
