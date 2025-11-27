/**
 * OAuth Callback Handler Component
 * Processes the OAuth2 redirect from Google
 */
import React, { useEffect, useState } from 'react';
import { exchangeCodeForTokens } from '../services/youtubeService';

interface OAuthCallbackProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const OAuthCallback: React.FC<OAuthCallbackProps> = ({ onSuccess, onError }) => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Connexion à YouTube en cours...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Erreur d'authentification: ${error}`);
      onError?.(error);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Code d\'autorisation manquant');
      onError?.('No authorization code');
      return;
    }

    let channelId = '';
    try {
      if (state) {
        const stateData = JSON.parse(decodeURIComponent(state));
        channelId = stateData.channelId;
      }
    } catch {
      setStatus('error');
      setMessage('État invalide');
      onError?.('Invalid state');
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens(code, channelId);
      
      if (tokens) {
        setStatus('success');
        setMessage('Connexion réussie ! Vous pouvez fermer cette fenêtre.');
        
        // Notify opener window
        if (window.opener) {
          window.opener.postMessage({
            type: 'youtube-oauth-success',
            channelId: channelId,
          }, window.location.origin);
          
          // Close popup after short delay
          setTimeout(() => window.close(), 1500);
        }
        
        onSuccess?.();
      } else {
        throw new Error('Token exchange failed');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Échec de la connexion. Veuillez réessayer.');
      onError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="bg-[#161616] rounded-xl border border-gray-800 p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Connexion en cours</h2>
            <p className="text-gray-400">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connecté !</h2>
            <p className="text-gray-400">{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Erreur</h2>
            <p className="text-gray-400 mb-4">{message}</p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Fermer
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
