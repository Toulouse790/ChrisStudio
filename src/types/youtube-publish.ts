import { YouTubeConfig } from './scheduler.js';

export type YouTubePublishStatus = 'starting' | 'uploading' | 'processing' | 'done' | 'failed';

export interface YouTubePublishJob {
  id: string;
  status: YouTubePublishStatus;
  progress: number; // 0..100

  createdAt: string;
  updatedAt: string;

  /** Local video file path on the server. */
  videoPath: string;

  /** Metadata requested by the user. */
  request: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    privacyStatus: YouTubeConfig['privacy'];
  };

  /** Result fields if upload succeeds. */
  videoId?: string;
  videoUrl?: string;

  /** YouTube may force privacy to private for non-audited projects. */
  appliedPrivacyStatus?: YouTubeConfig['privacy'];
  warning?: string;
  processingStatus?: string;

  error?: string;
}
