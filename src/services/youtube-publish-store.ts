import { mkdir, readFile, writeFile, rename } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { YouTubePublishJob } from '../types/youtube-publish.js';

export class YouTubePublishStore {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || process.env.YOUTUBE_PUBLISH_HISTORY_PATH || './data/youtube-publish-history.json';
  }

  async list(): Promise<YouTubePublishJob[]> {
    await this.ensureFile();
    const raw = await readFile(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as YouTubePublishJob[]) : [];
  }

  async get(id: string): Promise<YouTubePublishJob | null> {
    const all = await this.list();
    return all.find(j => j.id === id) || null;
  }

  async upsert(job: YouTubePublishJob): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex(j => j.id === job.id);
    if (idx >= 0) all[idx] = job;
    else all.unshift(job);
    await this.save(all);
  }

  private async ensureFile(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    if (!existsSync(this.filePath)) {
      await this.save([]);
    }
  }

  private async save(jobs: YouTubePublishJob[]): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(jobs, null, 2));
    await rename(tmp, this.filePath);
  }
}
