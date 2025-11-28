/**
 * ChrisStudio Cloudflare Worker
 * 
 * Routes:
 * - POST / : TTS via ElevenLabs
 * - POST /upload-audio : Upload audio vers R2 (si configuré) ou services externes
 * - GET /audio/:key : Récupérer un audio depuis R2
 * 
 * Pour activer R2:
 * 1. wrangler r2 bucket create chrisstudio-audio
 * 2. Ajouter dans wrangler.json: [[r2_buckets]] binding = "AUDIO_BUCKET" bucket_name = "chrisstudio-audio"
 * 
 * Déployer avec: wrangler deploy
 */

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Route: GET /audio/:key - Servir audio depuis R2
    if (url.pathname.startsWith('/audio/') && request.method === 'GET') {
      try {
        if (!env.AUDIO_BUCKET) {
          return new Response(
            JSON.stringify({ error: 'R2 not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const key = url.pathname.replace('/audio/', '');
        const object = await env.AUDIO_BUCKET.get(key);

        if (!object) {
          return new Response('Audio not found', { status: 404, headers: corsHeaders });
        }

        return new Response(object.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=86400', // Cache 24h
          }
        });
      } catch (e) {
        return new Response(
          JSON.stringify({ error: e.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Route: Upload audio
    if (url.pathname === '/upload-audio' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { audio, filename } = body;

        if (!audio) {
          return new Response(
            JSON.stringify({ error: 'Missing audio data' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Décoder le base64 en binaire
        const binaryString = atob(audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Option 1: Cloudflare R2 (RECOMMANDÉ - gratuit jusqu'à 10GB/mois)
        if (env.AUDIO_BUCKET) {
          try {
            const key = filename || `voiceover_${Date.now()}.mp3`;
            await env.AUDIO_BUCKET.put(key, bytes, {
              httpMetadata: { contentType: 'audio/mpeg' }
            });
            
            // URL publique via ce Worker
            const audioUrl = `${url.origin}/audio/${key}`;
            console.log('✅ Audio uploadé vers R2:', audioUrl);
            
            return new Response(
              JSON.stringify({ url: audioUrl, success: true, storage: 'r2' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } catch (r2Error) {
            console.error('R2 upload failed:', r2Error);
          }
        }

        // Option 2: filebin.net (accepte gros fichiers)
        try {
          const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
          const binId = `chrisstudio-${Date.now()}`;
          const fname = filename || 'voiceover.mp3';
          
          const filebinResponse = await fetch(`https://filebin.net/${binId}/${fname}`, {
            method: 'POST',
            headers: { 'Content-Type': 'audio/mpeg' },
            body: bytes
          });

          if (filebinResponse.ok) {
            const audioUrl = `https://filebin.net/${binId}/${fname}`;
            return new Response(
              JSON.stringify({ url: audioUrl, success: true, storage: 'filebin' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (e) {
          console.error('filebin.net failed:', e);
        }

        // Option 3: 0x0.st (fichiers < 512MB)
        try {
          const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
          const formData = new FormData();
          formData.append('file', audioBlob, filename || 'voiceover.mp3');

          const uploadResponse = await fetch('https://0x0.st', {
            method: 'POST',
            body: formData
          });

          if (uploadResponse.ok) {
            const audioUrl = await uploadResponse.text();
            return new Response(
              JSON.stringify({ url: audioUrl.trim(), success: true, storage: '0x0' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (e) {
          console.error('0x0.st failed:', e);
        }

        return new Response(
          JSON.stringify({ error: 'All upload services failed. Configure R2 for reliable uploads.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (e) {
        return new Response(
          JSON.stringify({ error: e.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Route: TTS ElevenLabs
    if (request.method === 'POST' && (url.pathname === '/' || url.pathname === '')) {
      try {
        const { text, voiceId } = await request.json();

        if (!text) {
          return new Response(
            JSON.stringify({ error: 'Missing text' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const ELEVENLABS_API_KEY = env.ELEVENLABS_API_KEY;
        if (!ELEVENLABS_API_KEY) {
          return new Response(
            JSON.stringify({ error: 'ElevenLabs API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const voice = voiceId || 'pNInz6obpgDQGcFmaJgB'; // Adam
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
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
                similarity_boost: 0.75
              }
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          return new Response(
            JSON.stringify({ error: `ElevenLabs error: ${response.status}`, details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const audioBuffer = await response.arrayBuffer();
        return new Response(audioBuffer, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
          }
        });

      } catch (e) {
        return new Response(
          JSON.stringify({ error: e.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Route par défaut
    return new Response(
      JSON.stringify({ 
        service: 'ChrisStudio Worker',
        routes: ['POST / (TTS)', 'POST /upload-audio (Audio upload)']
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
