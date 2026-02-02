export interface Channel {
  id: string;
  name: string;
  description: string;
  style: ChannelStyle;
  pacing?: ChannelPacing;
  visualMix?: VisualMix;
  /** How to balance local-library reuse across categories (defaults are applied in code if omitted). */
  assetReuseMix?: AssetReuseMix;
  branding?: ChannelBranding;
  voice: VoiceConfig;
}

export type AssetCategory = 'evergreen' | 'episode_specific';

export interface AssetReuseMix {
  evergreen: number; // 0..1
  episode_specific: number; // 0..1
}

export interface ChannelPacing {
  /** Typical shot length range in seconds */
  minShotSeconds: number;
  maxShotSeconds: number;
}

export interface VisualMix {
  image: number; // 0..1
  video: number; // 0..1
}

export interface ChannelBranding {
  stingText: string; // e.g. "{ChannelName} presents"
  softCtaText: string;
  finalCtaText: string;
  outroTeaserText: string;
  /** Overlay timings in seconds (relative to start) */
  overlay?: {
    stingStartSeconds: number;
    stingDurationSeconds: number;
    softCtaStartSeconds: number;
    softCtaDurationSeconds: number;
  };
  /** Optional per-channel overlay look (kept minimal to avoid harming retention). */
  overlayStyle?: {
    fontSize?: number;
    fontColor?: string;
    boxColor?: string;
    boxOpacity?: number; // 0..1
    boxBorderW?: number;
  };
}

export interface ChannelStyle {
  theme: 'sci-fi' | 'historical' | 'mysterious';
  musicGenre: string;
  visualStyle: string;
  colorGrading: string;
}

export interface VoiceConfig {
  provider: 'elevenlabs' | 'edge-tts';
  /** ElevenLabs voice ID or Edge TTS voice name */
  voiceId: string;
  /** Language code (for reference/fallback) */
  language?: string;
  /** ElevenLabs settings */
  stability?: number;
  similarityBoost?: number;
  style?: number;
  /** Edge TTS settings (legacy) */
  rate?: string;
  pitch?: string;
}

export interface VideoScript {
  title: string;
  hook: string; // First 10 seconds
  sections: ScriptSection[];
  conclusion: string;
  duration: number; // in seconds
}

export interface ScriptSection {
  narration: string;
  visualType: 'image' | 'video' | 'text';
  searchQuery: string;
  duration: number;
  transition: 'fade' | 'dissolve' | 'zoom';
}

export interface VisualRequest {
  searchQuery: string;
  preferredType: 'image' | 'video';
  durationSeconds: number;
  transition?: 'fade' | 'dissolve' | 'zoom';
  /** Optional label for debugging / analytics (hook, section-2-beat-3, etc.) */
  label?: string;
  /** Optional channel context for local-library scoring. */
  channelId?: string;
}

export interface Asset {
  /** Optional id (typically from the local library index). */
  libraryId?: string;
  type: 'image' | 'video';
  url: string;
  localPath?: string;
  /** Target duration for the segment this asset will cover (seconds). */
  duration?: number;
  attribution?: string;

  /** Library category, used for controlled reuse. */
  category?: AssetCategory;
  /** Normalized keywords derived from searchQuery/tags. */
  keywords?: string[];

  /** Metadata used for library indexing/matching (optional). */
  source?: 'pexels' | 'library';
  channelId?: string;
  searchQuery?: string;
  tags?: string[];
  /** For videos: probed duration of the media file (seconds), if known. */
  mediaDurationSeconds?: number;
}
