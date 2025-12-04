/**
 * Audio Service - Synthèse vocale
 * 
 * STRATÉGIE TTS (par ordre de priorité):
 * 1. ElevenLabs - Haute qualité (si crédits disponibles)
 * 2. API Proxy TTS - Google/Azure via backend (GRATUIT, contourne CORS)
 * 3. Audio silencieux - Fallback ultime
 * 
 * Pour activer le TTS gratuit, configurez VITE_TTS_API_URL dans .env.local
 */

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const TTS_API_URL = import.meta.env.VITE_TTS_API_URL; // URL du proxy TTS (Cloudflare Worker)

/**
 * Génère l'audio via ElevenLabs API (haute qualité)
 * Gère les textes longs en les découpant en chunks
 */
export async function generateSpeechElevenLabs(
  text: string,
  voiceId: string = 'pNInz6obpgDQGcFmaJgB', // Adam - voix masculine
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  // ElevenLabs limite à 10000 caractères par requête
  const MAX_CHARS = 9500; // Marge de sécurité
  
  // Nettoyer le texte (enlever les marqueurs de paragraphe mais garder le contenu)
  const cleanText = text
    .replace(/\*\*PARAGRAPHE \d+ - [^:]+:\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/PARAGRAPHE \d+ - [^:]+:/g, '')
    .trim();
  
  const wordCount = cleanText.split(/\s+/).length;
  console.log(`🎙️ ElevenLabs: ${wordCount} mots à lire, ${cleanText.length} caractères`);
  console.log(`📝 Texte complet pour ElevenLabs:\n---\n${cleanText}\n---`);
  
  // Si le texte est court, une seule requête
  if (cleanText.length <= MAX_CHARS) {
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
          text: cleanText,
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

  // Texte long: découper en chunks
  console.log(`📝 ElevenLabs: texte long (${cleanText.length} chars), découpage en chunks...`);
  
  const chunks: string[] = [];
  let remaining = cleanText;
  
  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHARS) {
      chunks.push(remaining);
      break;
    }
    
    // Trouver un bon point de coupure (fin de phrase)
    let splitIndex = remaining.lastIndexOf('. ', MAX_CHARS);
    if (splitIndex === -1 || splitIndex < MAX_CHARS * 0.5) {
      splitIndex = remaining.lastIndexOf('! ', MAX_CHARS);
    }
    if (splitIndex === -1 || splitIndex < MAX_CHARS * 0.5) {
      splitIndex = remaining.lastIndexOf('? ', MAX_CHARS);
    }
    if (splitIndex === -1 || splitIndex < MAX_CHARS * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', MAX_CHARS);
    }
    if (splitIndex === -1) splitIndex = MAX_CHARS;
    
    chunks.push(remaining.substring(0, splitIndex + 1).trim());
    remaining = remaining.substring(splitIndex + 1).trim();
  }
  
  console.log(`🎵 ElevenLabs: ${chunks.length} chunks à générer`);
  
  const audioBlobs: Blob[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(20 + (i / chunks.length) * 60, `ElevenLabs chunk ${i + 1}/${chunks.length}...`);
    
    try {
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
            text: chunks[i],
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

      audioBlobs.push(await response.blob());
      
      // Petit délai entre les requêtes
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.error(`ElevenLabs chunk ${i} failed:`, error);
      throw error;
    }
  }
  
  // Combiner tous les blobs audio
  return new Blob(audioBlobs, { type: 'audio/mpeg' });
}

/**
 * Génère un fichier audio silencieux avec la durée appropriée
 * Utilisé quand aucun TTS n'est disponible
 */
function generateSilentAudio(durationSeconds: number): Blob {
  // Créer un fichier WAV silencieux
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // ByteRate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); // BlockAlign
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Audio data (silence = all zeros, already initialized)

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Génère l'audio via le proxy TTS (Cloudflare Worker / Azure Function)
 * Utilise Google Cloud TTS ou Azure Speech en backend (GRATUIT)
 */
async function generateSpeechProxy(
  text: string,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  if (!TTS_API_URL) {
    throw new Error('TTS API URL not configured');
  }

  // Nettoyer le texte
  const cleanText = text
    .replace(/\*\*PARAGRAPHE \d+ - [^:]+:\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/PARAGRAPHE \d+ - [^:]+:/g, '')
    .trim();

  // Découper en chunks de 5000 chars max (limite Google TTS)
  const MAX_CHUNK = 4500;
  const chunks: string[] = [];
  let remaining = cleanText;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK) {
      chunks.push(remaining);
      break;
    }
    
    let splitIndex = remaining.lastIndexOf('. ', MAX_CHUNK);
    if (splitIndex === -1 || splitIndex < MAX_CHUNK * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', MAX_CHUNK);
    }
    if (splitIndex === -1) splitIndex = MAX_CHUNK;
    
    chunks.push(remaining.substring(0, splitIndex + 1).trim());
    remaining = remaining.substring(splitIndex + 1).trim();
  }

  console.log(`🎵 Proxy TTS: ${chunks.length} chunks à générer`);
  
  const audioBlobs: Blob[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(30 + (i / chunks.length) * 50, `TTS Proxy chunk ${i + 1}/${chunks.length}...`);
    
    try {
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: chunks[i],
          voice: 'fr-FR-Wavenet-B' // Voix Google masculine française
        })
      });

      if (!response.ok) {
        throw new Error(`Proxy TTS error: ${response.status}`);
      }

      const blob = await response.blob();
      if (blob.size > 0) {
        audioBlobs.push(blob);
      }

      // Délai entre les requêtes
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (error) {
      console.error(`Proxy TTS chunk ${i} failed:`, error);
      throw error;
    }
  }

  if (audioBlobs.length === 0) {
    throw new Error('Proxy TTS: no audio generated');
  }

  console.log(`✅ Proxy TTS: ${audioBlobs.length}/${chunks.length} chunks générés`);
  return new Blob(audioBlobs, { type: 'audio/mpeg' });
}

/**
 * Génère la voix off complète pour un script
 * Priorité: ElevenLabs > Proxy TTS (Google/Azure gratuit) > Audio silencieux
 */
export async function generateVoiceover(
  script: string,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  onProgress?.(10, 'Préparation de la synthèse vocale...');
  
  // Log du texte reçu pour debug
  const wordCount = script.split(/\s+/).length;
  console.log(`🎤 generateVoiceover reçu: ${wordCount} mots, ${script.length} caractères`);

  // Méthode 1: ElevenLabs (haute qualité)
  if (ELEVENLABS_API_KEY) {
    onProgress?.(20, 'Génération avec ElevenLabs (haute qualité)...');
    
    try {
      const blob = await generateSpeechElevenLabs(script, 'pNInz6obpgDQGcFmaJgB', onProgress);
      const size = blob.size;
      console.log(`✅ ElevenLabs audio généré: ${(size / 1024 / 1024).toFixed(2)} MB`);
      onProgress?.(100, 'Audio ElevenLabs généré avec succès');
      return blob;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.warn('⚠️ ElevenLabs failed:', errorMsg);
      
      if (errorMsg.includes('quota_exceeded')) {
        console.error('❌ ElevenLabs: Crédits insuffisants');
        onProgress?.(25, '❌ Crédits ElevenLabs épuisés, essai TTS gratuit...');
      } else {
        onProgress?.(25, '⚠️ ElevenLabs indisponible, essai TTS gratuit...');
      }
    }
  }

  // Méthode 2: Proxy TTS (Google Cloud / Azure - GRATUIT)
  if (TTS_API_URL) {
    onProgress?.(30, 'Génération avec TTS gratuit (Google Cloud)...');
    
    try {
      const blob = await generateSpeechProxy(script, onProgress);
      const size = blob.size;
      console.log(`✅ Proxy TTS audio généré: ${(size / 1024 / 1024).toFixed(2)} MB`);
      onProgress?.(100, 'Audio généré avec succès (TTS gratuit)');
      return blob;
    } catch (error) {
      console.error('❌ Proxy TTS failed:', error);
      onProgress?.(50, '❌ TTS gratuit échoué');
    }
  } else {
    console.warn('⚠️ VITE_TTS_API_URL non configurée - TTS gratuit désactivé');
  }

  // Fallback: Générer un audio silencieux
  const fallbackWordCount = script.split(/\s+/).length;
  const estimatedDuration = (fallbackWordCount / 150) * 60;
  
  console.log(`⚠️ Génération audio silencieux (${Math.round(estimatedDuration)}s)`);
  console.log('💡 Configurez VITE_TTS_API_URL pour le TTS gratuit');
  
  onProgress?.(50, '⚠️ Création audio silencieux...');
  
  const silentBlob = generateSilentAudio(estimatedDuration);
  
  onProgress?.(100, '⚠️ Vidéo sans voix off');
  
  return silentBlob;
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
