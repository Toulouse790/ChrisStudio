/**
 * Cloudflare Worker - TTS Proxy
 * 
 * Déployez ce worker sur Cloudflare (gratuit):
 * 1. Allez sur https://dash.cloudflare.com/
 * 2. Workers & Pages > Create Application > Create Worker
 * 3. Collez ce code
 * 4. Ajoutez la variable d'environnement GOOGLE_TTS_API_KEY
 * 5. Copiez l'URL du worker dans VITE_TTS_API_URL
 * 
 * Pour obtenir GOOGLE_TTS_API_KEY (gratuit jusqu'à 1M chars/mois):
 * 1. https://console.cloud.google.com/
 * 2. Activez "Cloud Text-to-Speech API"
 * 3. Créez une clé API dans "APIs & Services > Credentials"
 */

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

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
