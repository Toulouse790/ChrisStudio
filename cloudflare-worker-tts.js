/**
 * Cloudflare Worker - TTS Proxy + Audio Upload
 * 
 * Routes:
 * - POST / : TTS (text to speech)
 * - POST /upload : Upload audio, returns public URL
 * - GET /audio/:id : Serve uploaded audio
 */

// Store audio temporarily (in-memory, resets on worker restart)
const audioStore = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route: GET /audio/:id - Serve uploaded audio
    if (request.method === 'GET' && url.pathname.startsWith('/audio/')) {
      const id = url.pathname.replace('/audio/', '');
      const audioData = audioStore.get(id);
      
      if (!audioData) {
        return new Response('Audio not found', { status: 404, headers: corsHeaders });
      }
      
      return new Response(audioData, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // Route: POST /upload - Upload audio file
    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        const audioData = await request.arrayBuffer();
        const id = crypto.randomUUID();
        
        // Store audio (limit to 10MB)
        if (audioData.byteLength > 10 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: 'File too large (max 10MB)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        audioStore.set(id, new Uint8Array(audioData));
        
        // Clean old entries (keep max 10)
        if (audioStore.size > 10) {
          const firstKey = audioStore.keys().next().value;
          audioStore.delete(firstKey);
        }
        
        const audioUrl = `${url.origin}/audio/${id}`;
        
        return new Response(JSON.stringify({ url: audioUrl, id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Route: POST / - TTS
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    try {
      const { text, voice = 'fr-FR-Wavenet-B' } = await request.json();

      if (!text) {
        return new Response(JSON.stringify({ error: 'Text is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Appeler Google Cloud TTS
      const googleResponse = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`,
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

      if (!googleResponse.ok) {
        const error = await googleResponse.text();
        console.error('Google TTS error:', error);
        return new Response(JSON.stringify({ error: 'TTS failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const data = await googleResponse.json();
      
      // Décoder le base64 en binaire
      const audioContent = data.audioContent;
      const binaryString = atob(audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return new Response(bytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg'
        }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
