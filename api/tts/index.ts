/**
 * Azure Function - Text-to-Speech Proxy
 * Contourne CORS en utilisant Google Cloud TTS (gratuit jusqu'à 1M chars/mois)
 * ou Azure Speech (500K chars/mois gratuits)
 */

import { AzureFunction, Context, HttpRequest } from "@azure/functions";

const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY;
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'westeurope';

interface TTSRequest {
  text: string;
  voice?: string;
  lang?: string;
}

/**
 * Google Cloud TTS - 1 million caractères/mois GRATUITS
 */
async function googleTTS(text: string, voice: string = 'fr-FR-Wavenet-B'): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: 'fr-FR',
          name: voice,
          ssmlGender: 'MALE'
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Google TTS error: ${response.status}`);
  }

  const data = await response.json();
  // Google retourne l'audio en base64
  const audioContent = data.audioContent;
  const binaryString = atob(audioContent);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Azure Speech - 500K caractères/mois GRATUITS
 */
async function azureTTS(text: string, voice: string = 'fr-FR-HenriNeural'): Promise<ArrayBuffer> {
  // Obtenir un token
  const tokenResponse = await fetch(
    `https://${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY!,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  const token = await tokenResponse.text();

  // Synthétiser
  const ssml = `
    <speak version='1.0' xml:lang='fr-FR'>
      <voice xml:lang='fr-FR' name='${voice}'>
        ${text}
      </voice>
    </speak>
  `;

  const response = await fetch(
    `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
      },
      body: ssml
    }
  );

  if (!response.ok) {
    throw new Error(`Azure TTS error: ${response.status}`);
  }

  return response.arrayBuffer();
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  // CORS headers
  context.res = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    context.res.status = 204;
    return;
  }

  try {
    const body: TTSRequest = req.body;
    
    if (!body?.text) {
      context.res.status = 400;
      context.res.body = { error: 'Text is required' };
      return;
    }

    let audioBuffer: ArrayBuffer;

    // Essayer Google TTS d'abord (meilleure qualité gratuite)
    if (GOOGLE_TTS_API_KEY) {
      try {
        audioBuffer = await googleTTS(body.text, body.voice);
        context.log('✅ Google TTS success');
      } catch (e) {
        context.log('⚠️ Google TTS failed, trying Azure...');
        if (AZURE_SPEECH_KEY) {
          audioBuffer = await azureTTS(body.text, body.voice);
          context.log('✅ Azure TTS success');
        } else {
          throw e;
        }
      }
    } else if (AZURE_SPEECH_KEY) {
      audioBuffer = await azureTTS(body.text, body.voice);
      context.log('✅ Azure TTS success');
    } else {
      context.res.status = 500;
      context.res.body = { error: 'No TTS service configured' };
      return;
    }

    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*'
      },
      body: Buffer.from(audioBuffer),
      isRaw: true
    };

  } catch (error) {
    context.log.error('TTS Error:', error);
    context.res.status = 500;
    context.res.body = { error: error instanceof Error ? error.message : 'TTS failed' };
  }
};

export default httpTrigger;
