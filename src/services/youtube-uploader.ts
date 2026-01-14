import axios, { AxiosError } from 'axios';
import { google, youtube_v3 } from 'googleapis';
import { createReadStream, existsSync } from 'fs';
import { chmod, mkdir, readFile, rename, stat, writeFile, rm } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { YouTubeConfig } from '../types/scheduler.js';

export type YouTubeAuthStatus = {
  hasCredentials: boolean;
  connected: boolean;
  tokensPath: string;
};

export type YouTubeUploadResult = {
  videoId: string;
  videoUrl: string;
  requestedPrivacyStatus: YouTubeConfig['privacy'];
  appliedPrivacyStatus?: YouTubeConfig['privacy'];
  warning?: string;
  processingStatus?: string;
};

type StoredTokens = {
  refresh_token?: string;
  access_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
};

type OAuthClientCredentials = {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
};

const YT_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

export class YouTubeUploader {
  private oauth2Client: ReturnType<typeof this.createOAuthClient> | null = null;
  private youtube: youtube_v3.Youtube | null = null;

  private credentialsPath: string;
  private tokensPath: string;

  constructor(config?: { credentialsPath?: string; tokensPath?: string }) {
    this.credentialsPath = config?.credentialsPath || process.env.YOUTUBE_OAUTH_CLIENT_PATH || './secrets/youtube_oauth_client.json';
    this.tokensPath = config?.tokensPath || process.env.YOUTUBE_TOKENS_PATH || './secrets/youtube_tokens.json';
  }

  getTokensPath(): string {
    return this.tokensPath;
  }

  async getAuthStatus(): Promise<YouTubeAuthStatus> {
    const creds = await this.loadClientCredentials().catch(() => null);
    const hasCredentials = !!creds;
    const tokens = await this.loadTokens().catch(() => null);
    const connected = !!tokens?.refresh_token;
    return { hasCredentials, connected, tokensPath: this.tokensPath };
  }

  /** Ensure OAuth client is created and tokens are loaded (refresh token required). */
  async ensureAuth(redirectUri: string): Promise<void> {
    const creds = await this.loadClientCredentials();
    this.oauth2Client = this.createOAuthClient(creds, redirectUri);

    const tokens = await this.loadTokens().catch(() => null);
    if (tokens) {
      this.oauth2Client.setCredentials(tokens);
    }

    if (!tokens?.refresh_token) {
      throw new Error('AUTH_REQUIRED');
    }

    this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
  }

  /** Build a consent URL for Installed App OAuth on localhost. */
  async getAuthUrl(redirectUri: string, state?: string): Promise<string> {
    const creds = await this.loadClientCredentials();
    const client = this.createOAuthClient(creds, redirectUri);

    return client.generateAuthUrl({
      access_type: 'offline',
      // prompt=consent helps ensure we receive refresh_token on repeat authorizations.
      prompt: 'consent',
      scope: [YT_UPLOAD_SCOPE],
      state
    });
  }

  /** Exchange code for tokens and persist them securely. */
  async handleOAuthCallback(code: string, redirectUri: string): Promise<void> {
    const creds = await this.loadClientCredentials();
    const client = this.createOAuthClient(creds, redirectUri);
    const { tokens } = await client.getToken(code);

    // Never log token content.
    await this.saveTokens(tokens as StoredTokens);

    // Keep client ready for subsequent calls.
    this.oauth2Client = client;
    this.oauth2Client.setCredentials(tokens);
    this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
  }

  /** Robust resumable upload with progress + basic resume/retry. */
  async uploadVideoResumable(
    videoPath: string,
    config: YouTubeConfig,
    redirectUri: string,
    onProgress?: (progress: number, status?: string) => void
  ): Promise<YouTubeUploadResult> {
    await this.ensureAuth(redirectUri);
    if (!this.oauth2Client) throw new Error('OAuth client not initialized');

    if (!videoPath || !existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const fileInfo = await stat(videoPath);
    const totalBytes = fileInfo.size;
    if (totalBytes <= 0) {
      throw new Error('Video file is empty');
    }

    onProgress?.(0, 'starting');

    const accessToken = await this.getFreshAccessToken();
    const uploadUrl = await this.startResumableSession(accessToken, config);

    onProgress?.(0, 'uploading');

    const chunkSize = this.getChunkSizeBytes();
    const uploadOutcome = await this.uploadChunksWithRetry(uploadUrl, videoPath, totalBytes, chunkSize, (sent) => {
      const pct = Math.max(0, Math.min(99, Math.floor((sent / totalBytes) * 100)));
      onProgress?.(pct, 'uploading');
    });

    // Finalize: the last PUT should return the video resource with id.
    const finalize = uploadOutcome.finalVideo
      ? uploadOutcome.finalVideo
      : await this.finalizeResumableUpload(uploadUrl, videoPath, totalBytes, chunkSize, uploadOutcome.bytesSent);

    const videoId = finalize?.id;
    if (!videoId) {
      throw new Error('Upload completed but no video ID returned');
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    onProgress?.(100, 'processing');
    const post = await this.tryFetchProcessingAndPrivacy(videoId, config).catch(() => null);

    const appliedPrivacyStatus = post?.appliedPrivacyStatus;
    const processingStatus = post?.processingStatus;

    // IMPORTANT: projects not audited may be forced to private.
    let warning: string | undefined;
    if (config.privacy !== 'private' && appliedPrivacyStatus === 'private') {
      warning = 'Your API project may be restricted to Private uploads until YouTube API audit/verification.';
    } else if (config.privacy !== 'private' && !appliedPrivacyStatus) {
      warning = 'PrivacyStatus may be forced to Private by YouTube until API project audit/verification.';
    }

    onProgress?.(100, 'done');

    return {
      videoId,
      videoUrl,
      requestedPrivacyStatus: config.privacy,
      appliedPrivacyStatus,
      processingStatus,
      warning
    };
  }

  // -------------------------
  // Internals
  // -------------------------

  private async loadClientCredentials(): Promise<OAuthClientCredentials> {
    // 1) env vars (fast path)
    if (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) {
      return {
        client_id: process.env.YOUTUBE_CLIENT_ID,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET,
        redirect_uris: process.env.YOUTUBE_REDIRECT_URIS ? process.env.YOUTUBE_REDIRECT_URIS.split(',') : undefined
      };
    }

    // 2) JSON file (recommended)
    const raw = await readFile(this.credentialsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const node = parsed.installed || parsed.web;
    if (!node?.client_id || !node?.client_secret) {
      throw new Error(`Invalid OAuth client file (expected installed/web.client_id/client_secret): ${this.credentialsPath}`);
    }
    return {
      client_id: node.client_id,
      client_secret: node.client_secret,
      redirect_uris: Array.isArray(node.redirect_uris) ? node.redirect_uris : undefined
    };
  }

  private createOAuthClient(creds: OAuthClientCredentials, redirectUri: string) {
    return new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri);
  }

  private async loadTokens(): Promise<StoredTokens | null> {
    if (!existsSync(this.tokensPath)) return null;
    const raw = await readFile(this.tokensPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed as StoredTokens;
  }

  private async saveTokens(tokens: StoredTokens): Promise<void> {
    const dir = path.dirname(this.tokensPath);
    await mkdir(dir, { recursive: true });
    // Best-effort: strict perms on dir + file.
    await chmod(dir, 0o700).catch(() => undefined);

    const tmp = `${this.tokensPath}.tmp`;
    await writeFile(tmp, JSON.stringify(tokens, null, 2), { encoding: 'utf-8' });
    await chmod(tmp, 0o600).catch(() => undefined);

    try {
      await rename(tmp, this.tokensPath);
    } catch {
      // Cross-device fallback (rare): copy then cleanup.
      await writeFile(this.tokensPath, await readFile(tmp));
      await rm(tmp, { force: true }).catch(() => undefined);
    }

    await chmod(this.tokensPath, 0o600).catch(() => undefined);
  }

  private async getFreshAccessToken(): Promise<string> {
    if (!this.oauth2Client) throw new Error('OAuth client not initialized');
    const token = await this.oauth2Client.getAccessToken();
    const value = typeof token === 'string' ? token : token?.token;
    if (!value) throw new Error('Unable to obtain access token');
    return value;
  }

  private getChunkSizeBytes(): number {
    // YouTube supports chunk sizes that are multiples of 256KB.
    const mb = parseInt(process.env.YOUTUBE_UPLOAD_CHUNK_MB || '8', 10);
    const raw = Math.max(1, Math.min(64, Number.isFinite(mb) ? mb : 8)) * 1024 * 1024;
    const unit = 256 * 1024;
    return Math.floor(raw / unit) * unit;
  }

  private async startResumableSession(accessToken: string, config: YouTubeConfig): Promise<string> {
    const url = 'https://www.googleapis.com/upload/youtube/v3/videos';

    const response = await axios.post(
      url,
      {
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
      {
        params: {
          uploadType: 'resumable',
          part: 'snippet,status'
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/*'
        },
        validateStatus: (s) => s >= 200 && s < 400
      }
    );

    const location = response.headers?.location as string | undefined;
    if (!location) {
      throw new Error('YouTube resumable session did not return an upload URL');
    }
    return location;
  }

  private async uploadChunksWithRetry(
    uploadUrl: string,
    filePath: string,
    totalBytes: number,
    chunkSize: number,
    onBytesSent?: (bytesSent: number) => void
  ): Promise<{ bytesSent: number; finalVideo: youtube_v3.Schema$Video | null }> {
    let bytesSent = 0;
    let finalVideo: youtube_v3.Schema$Video | null = null;

    // If we need to resume, query server for last committed byte.
    const resumeAt = await this.queryResumableOffset(uploadUrl, totalBytes).catch(() => 0);
    if (resumeAt > 0) bytesSent = resumeAt;

    while (bytesSent < totalBytes) {
      const start = bytesSent;
      const end = Math.min(totalBytes - 1, start + chunkSize - 1);
      const contentLength = end - start + 1;

      const attemptId = crypto.randomUUID();
      await this.retry(async () => {
        const stream = createReadStream(filePath, { start, end });
        const res = await axios.put(uploadUrl, stream, {
          headers: {
            'Content-Length': contentLength,
            'Content-Range': `bytes ${start}-${end}/${totalBytes}`
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          validateStatus: (s) => (s >= 200 && s < 300) || s === 308
        });

        if (res.status === 308) {
          const range = res.headers?.range as string | undefined;
          const committed = this.parseRangeCommittedBytes(range);
          bytesSent = committed;
          onBytesSent?.(bytesSent);
          return;
        }

        // 2xx means finalization (YouTube returns the video resource).
        if (res?.data && typeof res.data === 'object') {
          finalVideo = res.data as youtube_v3.Schema$Video;
        }
        bytesSent = end + 1;
        onBytesSent?.(bytesSent);
      }, `chunk-${start}-${end}:${attemptId}`);
    }

    return { bytesSent, finalVideo };
  }

  private async finalizeResumableUpload(
    uploadUrl: string,
    filePath: string,
    totalBytes: number,
    chunkSize: number,
    bytesSent: number
  ): Promise<youtube_v3.Schema$Video | null> {
    if (bytesSent < totalBytes) {
      // Best-effort re-sync and retry.
      const resumeAt = await this.queryResumableOffset(uploadUrl, totalBytes).catch(() => bytesSent);
      bytesSent = resumeAt;
    }

    if (bytesSent < totalBytes) {
      // Push remaining bytes (including last chunk) and capture final response.
      const start = bytesSent;
      const end = totalBytes - 1;
      const stream = createReadStream(filePath, { start, end });
      const res = await axios.put(uploadUrl, stream, {
        headers: {
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${totalBytes}`
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: (s) => s >= 200 && s < 300
      });
      return (res.data || null) as youtube_v3.Schema$Video | null;
    }

    // If we already sent all bytes, try querying processing/metadata via API.
    return null;
  }

  private async queryResumableOffset(uploadUrl: string, totalBytes: number): Promise<number> {
    const res = await axios.put(uploadUrl, null, {
      headers: {
        'Content-Length': 0,
        'Content-Range': `bytes */${totalBytes}`
      },
      validateStatus: (s) => s === 308 || (s >= 200 && s < 300)
    });

    // 308: incomplete
    if (res.status === 308) {
      const committed = this.parseRangeCommittedBytes(res.headers?.range as string | undefined);
      return committed;
    }

    // Already finished.
    return totalBytes;
  }

  private parseRangeCommittedBytes(rangeHeader?: string): number {
    // Example: "bytes=0-1048575"
    if (!rangeHeader) return 0;
    const m = rangeHeader.match(/(\d+)-(\d+)/);
    if (!m) return 0;
    const end = parseInt(m[2], 10);
    return Number.isFinite(end) ? end + 1 : 0;
  }

  private async tryFetchProcessingAndPrivacy(videoId: string, config: YouTubeConfig): Promise<{ appliedPrivacyStatus?: YouTubeConfig['privacy']; processingStatus?: string }>{
    if (!this.youtube) return {};

    // Small polling window: good enough to show “processing” in UI.
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const res = await this.youtube.videos.list({
        part: ['status', 'processingDetails'],
        id: [videoId]
      });
      const item = res.data.items?.[0];
      const appliedPrivacyStatus = item?.status?.privacyStatus as YouTubeConfig['privacy'] | undefined;
      const processingStatus = item?.processingDetails?.processingStatus || undefined;

      // If processed or failed, return immediately.
      if (processingStatus && processingStatus !== 'processing') {
        return { appliedPrivacyStatus, processingStatus };
      }

      // If privacy is known and we asked for private, no need to wait.
      if (appliedPrivacyStatus && config.privacy === 'private') {
        return { appliedPrivacyStatus, processingStatus };
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    // Best-effort snapshot.
    const res = await this.youtube.videos.list({
      part: ['status', 'processingDetails'],
      id: [videoId]
    });
    const item = res.data.items?.[0];
    return {
      appliedPrivacyStatus: item?.status?.privacyStatus as YouTubeConfig['privacy'] | undefined,
      processingStatus: item?.processingDetails?.processingStatus || undefined
    };
  }

  private async retry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    const maxAttempts = parseInt(process.env.YOUTUBE_UPLOAD_RETRIES || '6', 10);
    let attempt = 0;
    let delayMs = 500;

    while (true) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        if (attempt >= maxAttempts || !this.isRetryableError(err)) {
          throw err;
        }

        const jitter = Math.floor(Math.random() * 200);
        await new Promise(r => setTimeout(r, delayMs + jitter));
        delayMs = Math.min(8000, Math.floor(delayMs * 1.8));
      }
    }
  }

  private isRetryableError(err: unknown): boolean {
    const ax = err as AxiosError;
    const status = ax?.response?.status;
    if (status && [408, 429, 500, 502, 503, 504].includes(status)) return true;

    // Network/timeout
    const code = (ax as any)?.code as string | undefined;
    if (code && ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND'].includes(code)) return true;

    return false;
  }
}
