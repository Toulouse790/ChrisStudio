/**
 * YouTube Connection Component
 * Handles OAuth connection status and upload actions
 */
import React, { useState, useEffect } from 'react';
import { Channel } from '../types';
import {
  isYouTubeConfigured,
  isChannelConnected,
  getAuthUrl,
  disconnectChannel,
  getChannelInfo,
  getValidAccessToken,
  YouTubeChannelInfo
} from '../services/youtubeService';

interface YouTubeConnectionProps {
  channel: Channel;
  onConnectionChange: (channelId: string, connected: boolean) => void;
}

// YouTube Icon
const YouTubeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

// Link Icon
const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

// Unlink Icon
const UnlinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

// Check Icon
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const YouTubeConnectionButton: React.FC<YouTubeConnectionProps> = ({
  channel,
  onConnectionChange
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [channelInfo, setChannelInfo] = useState<YouTubeChannelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    setIsConfigured(isYouTubeConfigured());
    checkConnectionStatus();
  }, [channel.id]);

  const checkConnectionStatus = async () => {
    const connected = isChannelConnected(channel.id);
    setIsConnected(connected);
    
    if (connected) {
      const token = await getValidAccessToken(channel.id);
      if (token) {
        const info = await getChannelInfo(token);
        setChannelInfo(info);
      }
    }
  };

  const handleConnect = () => {
    const authUrl = getAuthUrl(channel.id);
    if (authUrl) {
      // Open in popup for better UX
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        authUrl,
        'youtube-auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      // Listen for OAuth callback message
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'youtube-oauth-success' && event.data?.channelId === channel.id) {
          setIsConnected(true);
          onConnectionChange(channel.id, true);
          checkConnectionStatus();
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
    }
  };

  const handleDisconnect = () => {
    if (confirm(`Déconnecter YouTube de "${channel.name}" ?`)) {
      disconnectChannel(channel.id);
      setIsConnected(false);
      setChannelInfo(null);
      onConnectionChange(channel.id, false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <YouTubeIcon className="w-4 h-4 text-gray-600" />
        <span>API YouTube non configurée</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <YouTubeIcon className="w-4 h-4 text-red-500" />
          <span className="text-xs text-green-400">Connecté</span>
          {channelInfo && (
            <span className="text-xs text-gray-500">
              ({channelInfo.subscriberCount.toLocaleString()} abonnés)
            </span>
          )}
        </div>
        <button
          onClick={handleDisconnect}
          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
          title="Déconnecter YouTube"
          aria-label={`Déconnecter YouTube de ${channel.name}`}
        >
          <UnlinkIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors"
      aria-label={`Connecter YouTube à ${channel.name}`}
    >
      <YouTubeIcon className="w-4 h-4" />
      {isLoading ? 'Connexion...' : 'Connecter YouTube'}
    </button>
  );
};

// Upload Button Component
interface UploadButtonProps {
  channelId: string;
  videoBlob?: Blob;
  metadata?: {
    title: string;
    description: string;
    tags: string[];
  };
  thumbnailBlob?: Blob;
  disabled?: boolean;
  onUploadComplete?: (videoId: string) => void;
  onUploadError?: (error: string) => void;
}

export const YouTubeUploadButton: React.FC<UploadButtonProps> = ({
  channelId,
  videoBlob,
  metadata,
  thumbnailBlob,
  disabled,
  onUploadComplete,
  onUploadError
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setIsConnected(isChannelConnected(channelId));
  }, [channelId]);

  const handleUpload = async () => {
    if (!videoBlob || !metadata) {
      onUploadError?.('Aucune vidéo à uploader');
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const { uploadVideo } = await import('../services/youtubeService');
      
      const result = await uploadVideo(
        {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          videoFile: videoBlob,
          thumbnailFile: thumbnailBlob,
          channelId: channelId,
          privacyStatus: 'private', // Start as private for safety
        },
        (progressInfo) => {
          setProgress(progressInfo.percentage);
        }
      );

      if (result.success && result.videoId) {
        onUploadComplete?.(result.videoId);
      } else {
        onUploadError?.(result.error || 'Erreur inconnue');
      }
    } catch (error) {
      onUploadError?.(error instanceof Error ? error.message : 'Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-xs text-gray-500 flex items-center gap-2">
        <YouTubeIcon className="w-4 h-4" />
        <span>Connectez d'abord YouTube</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleUpload}
      disabled={disabled || isUploading || !videoBlob}
      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors relative overflow-hidden"
      aria-label="Uploader sur YouTube"
    >
      {isUploading && (
        <div 
          className="absolute inset-0 bg-red-400/30"
          style={{ width: `${progress}%` }}
        />
      )}
      <YouTubeIcon className="w-5 h-5 relative z-10" />
      <span className="relative z-10">
        {isUploading ? `${progress}%` : 'Uploader sur YouTube'}
      </span>
    </button>
  );
};

export default YouTubeConnectionButton;
