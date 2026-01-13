import { google, youtube_v3 } from 'googleapis';
import { YouTubeConfig } from '../types/scheduler.js';
import { readFile } from 'fs/promises';
import path from 'path';

export class YouTubeUploader {
  private youtube: youtube_v3.Youtube | null = null;

  async initialize() {
    // OAuth2 authentication
    const credentials = process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET 
      ? {
          client_id: process.env.YOUTUBE_CLIENT_ID,
          client_secret: process.env.YOUTUBE_CLIENT_SECRET,
          redirect_uris: ['http://localhost:3000/oauth2callback']
        }
      : null;

    if (!credentials) {
      console.warn('⚠️  YouTube credentials not configured. Upload will be disabled.');
      return false;
    }

    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uris[0]
    );

    // Check if we have a saved token
    const token = process.env.YOUTUBE_REFRESH_TOKEN;
    if (token) {
      oauth2Client.setCredentials({ refresh_token: token });
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    return true;
  }

  async uploadVideo(
    videoPath: string,
    config: YouTubeConfig,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    if (!this.youtube) {
      throw new Error('YouTube uploader not initialized. Configure YouTube API credentials.');
    }

    console.log(`📤 Uploading video to YouTube: ${config.title}`);

    const fileSize = (await readFile(videoPath)).length;
    let uploadedBytes = 0;

    try {
      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: config.title,
            description: config.description,
            tags: config.tags,
            categoryId: config.category
          },
          status: {
            privacyStatus: config.privacy,
            publishAt: config.scheduledPublishTime?.toISOString(),
            selfDeclaredMadeForKids: false
          }
        },
        media: {
          body: await readFile(videoPath)
        }
      });

      const videoId = response.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      console.log(`✅ Video uploaded: ${videoUrl}`);
      return videoUrl;

    } catch (error: any) {
      console.error('❌ YouTube upload failed:', error);
      throw new Error(`YouTube upload failed: ${error.message}`);
    }
  }

  // Generate OAuth URL for user authorization
  getAuthUrl(): string {
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      'http://localhost:3000/oauth2callback'
    );

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload']
    });
  }

  // Exchange code for tokens
  async getTokenFromCode(code: string): Promise<any> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      'http://localhost:3000/oauth2callback'
    );

    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }
}
