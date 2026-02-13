import { ScheduledVideo, VideoSchedule } from '../types/scheduler.js';
import { writeFile, readFile, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

/** Write JSON atomically: write to tmp file then rename into place. */
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tmp = `${filePath}.${crypto.randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, filePath);
}

export class SchedulerDatabase {
  private dbPath = './data/scheduler.json';
  private schedulesPath = './data/schedules.json';
  private ready: Promise<void>;

  constructor() {
    this.ready = this.ensureDatabase();
  }

  private async ensureDatabase() {
    try {
      await mkdir('./data', { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    if (!existsSync(this.dbPath)) {
      await atomicWriteJson(this.dbPath, []);
    }
    
    if (!existsSync(this.schedulesPath)) {
      // Default: 3 videos per week per channel
      const defaultSchedules: VideoSchedule[] = [
        // What If - Monday, Wednesday, Friday at 10:00
        { channelId: 'what-if', weekday: 1, time: '10:00', enabled: true },
        { channelId: 'what-if', weekday: 3, time: '10:00', enabled: true },
        { channelId: 'what-if', weekday: 5, time: '10:00', enabled: true },
        
        // Human Odyssey - Tuesday, Thursday, Saturday at 14:00
        { channelId: 'human-odyssey', weekday: 2, time: '14:00', enabled: true },
        { channelId: 'human-odyssey', weekday: 4, time: '14:00', enabled: true },
        { channelId: 'human-odyssey', weekday: 6, time: '14:00', enabled: true },
        
        // Classified Files - Monday, Wednesday, Friday at 18:00
        { channelId: 'classified-files', weekday: 1, time: '18:00', enabled: true },
        { channelId: 'classified-files', weekday: 3, time: '18:00', enabled: true },
        { channelId: 'classified-files', weekday: 5, time: '18:00', enabled: true },
      ];
      await atomicWriteJson(this.schedulesPath, defaultSchedules);
    }
  }

  async getVideos(): Promise<ScheduledVideo[]> {
    await this.ready;
    const data = await readFile(this.dbPath, 'utf-8');
    const parsed = JSON.parse(data) as Array<{
      scheduledDate: string;
      createdAt: string;
      publishedAt?: string;
      [key: string]: unknown;
    }>;
    return parsed.map((v) => ({
      ...v,
      scheduledDate: new Date(v.scheduledDate),
      createdAt: new Date(v.createdAt),
      publishedAt: v.publishedAt ? new Date(v.publishedAt) : undefined
    })) as ScheduledVideo[];
  }

  async saveVideos(videos: ScheduledVideo[]): Promise<void> {
    await atomicWriteJson(this.dbPath, videos);
  }

  async addVideo(video: ScheduledVideo): Promise<void> {
    const videos = await this.getVideos();
    videos.push(video);
    await this.saveVideos(videos);
  }

  async updateVideo(id: string, updates: Partial<ScheduledVideo>): Promise<void> {
    const videos = await this.getVideos();
    const index = videos.findIndex(v => v.id === id);
    if (index >= 0) {
      videos[index] = { ...videos[index], ...updates };
      await this.saveVideos(videos);
    }
  }

  async deleteVideo(id: string): Promise<void> {
    const videos = await this.getVideos();
    await this.saveVideos(videos.filter(v => v.id !== id));
  }

  async getVideosByStatus(status: ScheduledVideo['status']): Promise<ScheduledVideo[]> {
    const videos = await this.getVideos();
    return videos.filter(v => v.status === status);
  }

  async getVideosByDateRange(start: Date, end: Date): Promise<ScheduledVideo[]> {
    const videos = await this.getVideos();
    return videos.filter(v => 
      v.scheduledDate >= start && v.scheduledDate <= end
    );
  }

  async getSchedules(): Promise<VideoSchedule[]> {
    await this.ready;
    const data = await readFile(this.schedulesPath, 'utf-8');
    return JSON.parse(data);
  }

  async saveSchedules(schedules: VideoSchedule[]): Promise<void> {
    await atomicWriteJson(this.schedulesPath, schedules);
  }

  async updateSchedule(channelId: string, weekday: number, updates: Partial<VideoSchedule>): Promise<void> {
    const schedules = await this.getSchedules();
    const index = schedules.findIndex(s => s.channelId === channelId && s.weekday === weekday);
    if (index >= 0) {
      schedules[index] = { ...schedules[index], ...updates };
      await this.saveSchedules(schedules);
    }
  }
}
