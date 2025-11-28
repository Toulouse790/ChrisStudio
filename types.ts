
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum AppState {
  IDLE,
  PLANNING, // Generating metadata/script
  GENERATING, // Generating video
  SUCCESS,
  ERROR,
}

export enum View {
  DASHBOARD = 'dashboard',
  CALENDAR = 'calendar',
  ASSETS = 'assets',
}

// --- Channel Types ---

export interface Channel {
  id: string; // internal ID
  youtubeChannelId?: string; // YouTube Channel ID (e.g., UCp3fqxkp3kgFJu33gpdcUtA)
  youtubeHandle?: string; // e.g., @MyChannel
  name: string;
  theme: string;
  color: string; // For UI decoration
  connected: boolean; // Simulator for OAuth connection
  rpm?: number; // Estimated revenue per 1000 views
  avgViews?: number; // Estimated average views per video
}

export interface YouTubeMetadata {
  title: string;
  description: string;
  tags: string[];
  thumbnailIdea: string;
  script?: string;
  visualPrompt?: string; // Prompt for the video model (always English)
  subtitles?: string; // SRT formatted subtitles (Target Language)
  thumbnailImage?: string; // Base64 data URI
  episodeNumber?: number; // For series logic
  communityPost?: string; // Text for a YouTube Community Post
}

export interface GeneratedAsset {
  id: string;
  metadata: YouTubeMetadata;
  videoUrl: string;
  thumbnailImage: string | null;
  voiceoverUrl?: string | null;
  voiceoverBlob?: Blob | null;
  timestamp: Date;
  channelName?: string;
}

// --- Watermark Types ---

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface WatermarkSettings {
  enabled: boolean;
  dataUrl: string | null; // Base64
  position: WatermarkPosition;
  opacity: number; // 0.1 to 1.0
  scale: number; // 0.1 to 0.5 (relative to video width)
}

// --- Intro/Outro/Music Types ---

export interface AssetConfig {
  enabled: boolean;
  file: File | null;
  previewUrl: string | null;
}

export interface MusicTrack {
    id: string;
    name: string;
    file: File;
    url: string;
}

export interface IntroOutroSettings {
  intro: AssetConfig;
  outro: AssetConfig;
}

// --- Persistence ---
export interface AppSettings {
    channels: Channel[];
    watermarkSettings: WatermarkSettings;
    calendar?: ContentCalendar;
}

// --- Calendar/Planner Types ---

export enum ContentStatus {
  PROPOSED = 'proposed',      // IA a proposé, en attente de validation
  APPROVED = 'approved',      // Validé par l'utilisateur
  MODIFIED = 'modified',      // Modifié par l'utilisateur
  REJECTED = 'rejected',      // Rejeté
  GENERATING = 'generating',  // En cours de génération
  READY = 'ready',            // Vidéo prête
  PUBLISHING = 'publishing',  // Upload en cours vers YouTube
  SCHEDULED = 'scheduled',    // Planifié pour publication
  PUBLISHED = 'published',    // Publié sur YouTube
}

export interface CalendarItem {
  id: string;
  channelId: string;
  title: string;
  description: string;           // Résumé du sujet
  originalTitle?: string;        // Titre original si modifié
  status: ContentStatus;
  scheduledDate?: Date;
  generatedAsset?: GeneratedAsset;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentCalendar {
  id: string;
  month: number;                  // 1-12
  year: number;
  items: CalendarItem[];
  generatedAt: Date;
  validatedAt?: Date;
}

export interface CalendarGenerationRequest {
  channelId: string;
  channelName: string;
  channelTheme: string;
  month: number;
  year: number;
  count: number;                  // Nombre de sujets à générer (ex: 12)
  existingTitles?: string[];      // Pour éviter les doublons
}
