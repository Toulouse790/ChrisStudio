export interface Channel {
  id: string;
  name: string;
  description: string;
  style: ChannelStyle;
  voice: VoiceConfig;
}

export interface ChannelStyle {
  theme: 'sci-fi' | 'historical' | 'mysterious';
  musicGenre: string;
  visualStyle: string;
  colorGrading: string;
}

export interface VoiceConfig {
  language: string; // 'en-US', 'en-GB', etc.
  voice: string; // Edge TTS voice name
  rate: string; // '+0%', '+10%', etc.
  pitch: string; // '+0Hz', '+5Hz', etc.
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

export interface Asset {
  type: 'image' | 'video';
  url: string;
  localPath?: string;
  duration?: number;
  attribution?: string;
}
