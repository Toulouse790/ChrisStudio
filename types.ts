
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';

export enum AppState {
  IDLE,
  PLANNING, // Generating metadata/script
  GENERATING, // Generating video
  SUCCESS,
  ERROR,
}

export enum View {
  DASHBOARD = 'dashboard',
  STUDIO = 'studio',
  CALENDAR = 'calendar',
  TEMPLATES = 'templates',
  ASSETS = 'assets',
}

export enum VeoModel {
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  VEO = 'veo-3.1-generate-preview',
}

export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
}

export enum Resolution {
  P720 = '720p',
  P1080 = '1080p',
}

export enum GenerationMode {
  TEXT_TO_VIDEO = 'Text to Video',
  FRAMES_TO_VIDEO = 'Frames to Video',
  REFERENCES_TO_VIDEO = 'References to Video',
  EXTEND_VIDEO = 'Extend Video',
}

export interface ImageFile {
  file: File;
  base64: string;
}

export interface VideoFile {
  file: File;
  base64: string;
}

export interface GenerateVideoParams {
  prompt: string;
  model: VeoModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  mode: GenerationMode;
  startFrame?: ImageFile | null;
  endFrame?: ImageFile | null;
  referenceImages?: ImageFile[];
  styleImage?: ImageFile | null;
  inputVideo?: VideoFile | null;
  inputVideoObject?: Video | null;
  isLooping?: boolean;
}

// --- New Types for Studio ---

export interface Channel {
  id: string; // internal ID
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

export interface Project {
  id: string;
  niche: string;
  format: 'shorts' | 'long-form';
  language: 'en' | 'fr';
  status: 'draft' | 'planned' | 'ready' | 'published';
  metadata?: YouTubeMetadata;
  videoUrl?: string;
  dateCreated: Date;
  scheduledDate?: Date;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  channelId: string;
  niche: string;
  format: 'shorts' | 'long-form';
  language: 'en' | 'fr';
  isSeries: boolean;
  visualStyle?: string;
}

export interface GeneratedAsset {
  id: string;
  metadata: YouTubeMetadata;
  videoUrl: string;
  thumbnailImage: string | null;
  voiceoverUrl?: string | null; // Blob URL for the WAV file
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
    templates: Template[];
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
