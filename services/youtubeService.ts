/**
 * YouTube Data API v3 Service
 * Handles OAuth2 authentication and video uploads
 */

// YouTube API Configuration
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const OAUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Scopes needed for video upload and channel management
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl'
].join(' ');

// Storage keys
const TOKEN_STORAGE_KEY = 'chrisstudio_youtube_tokens';
const CHANNEL_TOKENS_KEY = 'chrisstudio_channel_tokens';

export interface YouTubeTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  channel_id?: string;
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  thumbnailUrl: string;
  subscriberCount: number;
}

export interface VideoUploadParams {
  title: string;
  description: string;
  tags: string[];
  categoryId?: string; // Default: 22 (People & Blogs)
  privacyStatus?: 'private' | 'unlisted' | 'public';
  videoFile: Blob;
  thumbnailFile?: Blob;
  channelId: string;
  playlistId?: string;
  scheduledPublishAt?: Date;
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  status: 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
  videoId?: string;
  error?: string;
}

// Get OAuth2 client credentials from environment
const getClientCredentials = () => {
  const clientId = import.meta.env.VITE_YOUTUBE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_YOUTUBE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.warn('YouTube API credentials not configured. Set VITE_YOUTUBE_CLIENT_ID and VITE_YOUTUBE_CLIENT_SECRET in .env.local');
    return null;
  }
  
  return { clientId, clientSecret };
};

// Generate OAuth2 authorization URL
export const getAuthUrl = (channelInternalId: string): string | null => {
  const credentials = getClientCredentials();
  if (!credentials) return null;
  
  const redirectUri = `${window.location.origin}/oauth/callback`;
  const state = encodeURIComponent(JSON.stringify({ channelId: channelInternalId }));
  
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: state
  });
  
  return `${OAUTH_ENDPOINT}?${params.toString()}`;
};

// Exchange authorization code for tokens
export const exchangeCodeForTokens = async (
  code: string, 
  channelInternalId: string
): Promise<YouTubeTokens | null> => {
  const credentials = getClientCredentials();
  if (!credentials) return null;
  
  const redirectUri = `${window.location.origin}/oauth/callback`;
  
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Token exchange failed:', error);
      return null;
    }
    
    const data = await response.json();
    const tokens: YouTubeTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000),
    };
    
    // Get channel info to store channel ID
    const channelInfo = await getChannelInfo(tokens.access_token);
    if (channelInfo) {
      tokens.channel_id = channelInfo.id;
    }
    
    // Store tokens for this channel
    saveChannelTokens(channelInternalId, tokens);
    
    return tokens;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    return null;
  }
};

// Refresh access token
export const refreshAccessToken = async (channelInternalId: string): Promise<string | null> => {
  const credentials = getClientCredentials();
  if (!credentials) return null;
  
  const tokens = getChannelTokens(channelInternalId);
  if (!tokens?.refresh_token) return null;
  
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: tokens.refresh_token,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!response.ok) {
      console.error('Token refresh failed');
      return null;
    }
    
    const data = await response.json();
    const updatedTokens: YouTubeTokens = {
      ...tokens,
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in * 1000),
    };
    
    saveChannelTokens(channelInternalId, updatedTokens);
    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
};

// Get valid access token (refresh if needed)
export const getValidAccessToken = async (channelInternalId: string): Promise<string | null> => {
  const tokens = getChannelTokens(channelInternalId);
  if (!tokens) return null;
  
  // Check if token is expired (with 5 minute buffer)
  if (tokens.expires_at < Date.now() + 300000) {
    return await refreshAccessToken(channelInternalId);
  }
  
  return tokens.access_token;
};

// Get channel info from YouTube API
export const getChannelInfo = async (accessToken: string): Promise<YouTubeChannelInfo | null> => {
  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&mine=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;
    
    const channel = data.items[0];
    return {
      id: channel.id,
      title: channel.snippet.title,
      thumbnailUrl: channel.snippet.thumbnails?.default?.url || '',
      subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
    };
  } catch (error) {
    console.error('Error fetching channel info:', error);
    return null;
  }
};

// Upload video to YouTube
export const uploadVideo = async (
  params: VideoUploadParams,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ success: boolean; videoId?: string; error?: string }> => {
  const accessToken = await getValidAccessToken(params.channelId);
  if (!accessToken) {
    return { success: false, error: 'Not authenticated. Please connect your YouTube account.' };
  }
  
  onProgress?.({
    bytesUploaded: 0,
    totalBytes: params.videoFile.size,
    percentage: 0,
    status: 'preparing',
  });
  
  try {
    // Prepare video metadata
    const metadata = {
      snippet: {
        title: params.title.substring(0, 100), // YouTube max title length
        description: params.description.substring(0, 5000), // YouTube max description
        tags: params.tags.slice(0, 500), // YouTube max tags
        categoryId: params.categoryId || '22', // People & Blogs
      },
      status: {
        privacyStatus: params.privacyStatus || 'private',
        selfDeclaredMadeForKids: false,
        ...(params.scheduledPublishAt && {
          publishAt: params.scheduledPublishAt.toISOString(),
          privacyStatus: 'private', // Must be private for scheduled
        }),
      },
    };
    
    // Create resumable upload session
    const initResponse = await fetch(
      `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': params.videoFile.size.toString(),
          'X-Upload-Content-Type': params.videoFile.type || 'video/mp4',
        },
        body: JSON.stringify(metadata),
      }
    );
    
    if (!initResponse.ok) {
      const error = await initResponse.json();
      return { 
        success: false, 
        error: error.error?.message || 'Failed to initialize upload' 
      };
    }
    
    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      return { success: false, error: 'No upload URL received' };
    }
    
    // Upload video file
    onProgress?.({
      bytesUploaded: 0,
      totalBytes: params.videoFile.size,
      percentage: 0,
      status: 'uploading',
    });
    
    const uploadResponse = await uploadWithProgress(
      uploadUrl,
      params.videoFile,
      accessToken,
      onProgress
    );
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      return { 
        success: false, 
        error: error.error?.message || 'Upload failed' 
      };
    }
    
    const videoData = await uploadResponse.json();
    const videoId = videoData.id;
    
    onProgress?.({
      bytesUploaded: params.videoFile.size,
      totalBytes: params.videoFile.size,
      percentage: 100,
      status: 'processing',
      videoId,
    });
    
    // Upload thumbnail if provided
    if (params.thumbnailFile && videoId) {
      await uploadThumbnail(videoId, params.thumbnailFile, accessToken);
    }
    
    // Add to playlist if specified
    if (params.playlistId && videoId) {
      await addVideoToPlaylist(videoId, params.playlistId, accessToken);
    }
    
    onProgress?.({
      bytesUploaded: params.videoFile.size,
      totalBytes: params.videoFile.size,
      percentage: 100,
      status: 'complete',
      videoId,
    });
    
    return { success: true, videoId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    onProgress?.({
      bytesUploaded: 0,
      totalBytes: params.videoFile.size,
      percentage: 0,
      status: 'error',
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
};

// Upload with XMLHttpRequest for progress tracking
const uploadWithProgress = (
  url: string,
  file: Blob,
  accessToken: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<Response> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          bytesUploaded: event.loaded,
          totalBytes: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
          status: 'uploading',
        });
      }
    });
    
    xhr.addEventListener('load', () => {
      const response = new Response(xhr.response, {
        status: xhr.status,
        statusText: xhr.statusText,
      });
      resolve(response);
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });
    
    xhr.open('PUT', url);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.responseType = 'text';
    xhr.send(file);
  });
};

// Upload thumbnail
const uploadThumbnail = async (
  videoId: string,
  thumbnailFile: Blob,
  accessToken: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/thumbnails/set?videoId=${videoId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': thumbnailFile.type || 'image/png',
        },
        body: thumbnailFile,
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Thumbnail upload failed:', error);
    return false;
  }
};

// Add video to playlist
const addVideoToPlaylist = async (
  videoId: string,
  playlistId: string,
  accessToken: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/playlistItems?part=snippet`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId,
            },
          },
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Failed to add video to playlist:', error);
    return false;
  }
};

// Get channel playlists
export const getChannelPlaylists = async (
  channelInternalId: string
): Promise<Array<{ id: string; title: string }>> => {
  const accessToken = await getValidAccessToken(channelInternalId);
  if (!accessToken) return [];
  
  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/playlists?part=snippet&mine=true&maxResults=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
    }));
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return [];
  }
};

// Token storage helpers
const saveChannelTokens = (channelInternalId: string, tokens: YouTubeTokens): void => {
  const allTokens = getAllChannelTokens();
  allTokens[channelInternalId] = tokens;
  localStorage.setItem(CHANNEL_TOKENS_KEY, JSON.stringify(allTokens));
};

const getChannelTokens = (channelInternalId: string): YouTubeTokens | null => {
  const allTokens = getAllChannelTokens();
  return allTokens[channelInternalId] || null;
};

const getAllChannelTokens = (): Record<string, YouTubeTokens> => {
  try {
    const stored = localStorage.getItem(CHANNEL_TOKENS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const isChannelConnected = (channelInternalId: string): boolean => {
  const tokens = getChannelTokens(channelInternalId);
  return !!tokens?.access_token;
};

export const disconnectChannel = (channelInternalId: string): void => {
  const allTokens = getAllChannelTokens();
  delete allTokens[channelInternalId];
  localStorage.setItem(CHANNEL_TOKENS_KEY, JSON.stringify(allTokens));
};

// Check if YouTube API is configured
export const isYouTubeConfigured = (): boolean => {
  return !!getClientCredentials();
};

// Get YouTube video URL
export const getVideoUrl = (videoId: string): string => {
  return `https://www.youtube.com/watch?v=${videoId}`;
};

// Get YouTube Studio URL for video
export const getStudioUrl = (videoId: string): string => {
  return `https://studio.youtube.com/video/${videoId}/edit`;
};
