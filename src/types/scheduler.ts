export interface ScheduledVideo {
  id: string;
  channelId: string;
  topic: string;
  scheduledDate: Date;
  status: 'pending' | 'generating' | 'ready' | 'published' | 'failed';
  scriptPath?: string;
  audioPath?: string;
  videoPath?: string;
  thumbnailPath?: string;
  youtubeUrl?: string;
  metadata?: {
    title: string;
    description: string;
    tags: string[];
    seoScore: number;
    trendingKeywords: string[];
  };
  error?: string;
  createdAt: Date;
  publishedAt?: Date;
}

export interface VideoSchedule {
  channelId: string;
  weekday: number; // 0-6 (0 = Sunday)
  time: string; // HH:mm format
  enabled: boolean;
}

export interface YouTubeConfig {
  title: string;
  description: string;
  tags: string[];
  category: string;
  privacy: 'private' | 'unlisted' | 'public';
  scheduledPublishTime?: Date;
}
