/**
 * Audio Service - Synthèse vocale
 * Utilise Web Speech API (gratuit) ou ElevenLabs (optionnel)
 */

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;

interface VoiceConfig {
  voiceId?: string; // Pour ElevenLabs
  lang?: string;    // Pour Web Speech
  rate?: number;
  pitch?: number;
}

/**
 * Génère l'audio via Web Speech API (gratuit, dans le navigateur)
 * Retourne un Blob audio
 */
export async function generateSpeechWebAPI(
  text: string,
  config: VoiceConfig = {}
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.lang || 'fr-FR';
    utterance.rate = config.rate || 0.9;
    utterance.pitch = config.pitch || 1;

    // Trouver une voix française
    const voices = speechSynthesis.getVoices();
    const frenchVoice = voices.find(v => 
      v.lang.startsWith('fr') && v.name.includes('Male')
    ) || voices.find(v => v.lang.startsWith('fr')) || voices[0];
    
    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    // Web Speech API ne permet pas d'enregistrer directement
    // On utilise MediaRecorder avec le contexte audio
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const mediaRecorder = new MediaRecorder(destination.stream, {
      mimeType: 'audio/webm'
    });
    
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      resolve(blob);
    };

    mediaRecorder.start();
    speechSynthesis.speak(utterance);

    utterance.onend = () => {
      setTimeout(() => mediaRecorder.stop(), 500);
    };

    utterance.onerror = (e) => reject(new Error(`Speech error: ${e.error}`));
  });
}

/**
 * Génère l'audio via ElevenLabs API (haute qualité)
 */
export async function generateSpeechElevenLabs(
  text: string,
  voiceId: string = 'pNInz6obpgDQGcFmaJgB' // Adam - voix masculine
): Promise<Blob> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${error}`);
  }

  return response.blob();
}

/**
 * Génère la voix off complète pour un script
 */
export async function generateVoiceover(
  script: string,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  onProgress?.(10, 'Préparation de la synthèse vocale...');

  // Diviser le script en segments plus petits si nécessaire
  const segments = script.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const audioBlobs: Blob[] = [];

  // Si ElevenLabs est configuré, l'utiliser
  if (ELEVENLABS_API_KEY) {
    onProgress?.(20, 'Génération avec ElevenLabs...');
    
    // ElevenLabs peut gérer des textes longs, on envoie tout
    try {
      const blob = await generateSpeechElevenLabs(script);
      onProgress?.(100, 'Audio généré avec succès');
      return blob;
    } catch (error) {
      console.error('ElevenLabs error, falling back to Web Speech:', error);
    }
  }

  // Fallback: Web Speech API
  onProgress?.(20, 'Génération avec synthèse navigateur...');
  
  // Attendre que les voix soient chargées
  await new Promise<void>(resolve => {
    if (speechSynthesis.getVoices().length > 0) {
      resolve();
    } else {
      speechSynthesis.onvoiceschanged = () => resolve();
    }
  });

  for (let i = 0; i < segments.length; i++) {
    const progress = 20 + (i / segments.length) * 70;
    onProgress?.(progress, `Synthèse segment ${i + 1}/${segments.length}...`);
    
    try {
      const blob = await generateSpeechWebAPI(segments[i]);
      audioBlobs.push(blob);
    } catch (error) {
      console.error(`Error generating segment ${i}:`, error);
    }
  }

  // Combiner tous les segments audio
  onProgress?.(95, 'Assemblage audio...');
  const combinedBlob = new Blob(audioBlobs, { type: 'audio/webm' });
  onProgress?.(100, 'Audio terminé');
  
  return combinedBlob;
}

/**
 * Calcule la durée d'un Blob audio
 */
export function getAudioDuration(audioBlob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
    };
    audio.onerror = reject;
    audio.src = URL.createObjectURL(audioBlob);
  });
}

/**
 * Vérifie si ElevenLabs est disponible
 */
export function isElevenLabsAvailable(): boolean {
  return !!ELEVENLABS_API_KEY;
}
