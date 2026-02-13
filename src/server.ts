import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { FullVideoPipeline } from './workflows/full-video-pipeline.js';
import { VideoScheduler } from './services/video-scheduler.js';
import { SchedulerDatabase } from './services/scheduler-db.js';
import { YouTubeUploader } from './services/youtube-uploader.js';
import { YouTubePublishStore } from './services/youtube-publish-store.js';
import { YouTubePublishJob } from './types/youtube-publish.js';
import { PrepublishValidator } from './services/prepublish-validator.js';
import { channels } from './config/channels.js';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { existsSync } from 'fs';

import logger from './utils/logger.js';
import { authMiddleware, optionalAuthMiddleware, authenticateUser, generateToken, isAuthEnabled, AuthRequest } from './middleware/auth.js';
import { globalRateLimiter, generateRateLimiter, uploadRateLimiter, authRateLimiter } from './middleware/rate-limiter.js';
import { validateBody, validateParams } from './middleware/validation.js';
import {
  generateVideoSchema,
  scheduleVideoSchema,
  updateScheduleSchema,
  youtubeUploadSchema,
  youtubePublishSchema,
  prepublishValidateSchema,
  regenerateAssetsSchema,
  idParamSchema,
  filenameParamSchema
} from './schemas/api.js';

const app = express();
const httpServer = createServer(app);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const scheduler = new VideoScheduler();
const schedulerDb = new SchedulerDatabase();
const youtubeUploader = new YouTubeUploader();
const youtubePublishStore = new YouTubePublishStore();
const prepublishValidator = new PrepublishValidator();

function getBaseUrl(req: express.Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.headers.host;
  return `${proto}://${host}`;
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));
app.use('/output', express.static('output'));

app.use(globalRateLimiter);

app.use((req, _res, next) => {
  const requestId = crypto.randomUUID();
  (req as AuthRequest & { requestId: string }).requestId = requestId;
  logger.info({ requestId, method: req.method, path: req.path, ip: req.ip }, 'Request received');
  next();
});

// ─── Health endpoint (unauthenticated) ─────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      logger.warn({ username }, 'Failed login attempt');
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user);
    logger.info({ username }, 'User logged in');
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Login error');
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    authEnabled: isAuthEnabled(),
    message: isAuthEnabled()
      ? 'Authentication is enabled. Provide Bearer token.'
      : 'Authentication is disabled. Set AUTH_ENABLED=true and ADMIN_PASSWORD_HASH to enable.'
  });
});

app.get('/api/download/video/:filename', validateParams(filenameParamSchema), (req, res) => {
  const filename = String(req.params.filename);
  const filepath = path.join(process.cwd(), 'output', 'videos', filename);

  res.download(filepath, filename, (err) => {
    if (err) {
      logger.error({ error: err.message, filename }, 'Download error');
      if (!res.headersSent) {
        res.status(404).json({ error: 'Video not found' });
      }
    }
  });
});

app.get('/api/channels', (_req, res) => {
  const channelsList = Object.values(channels).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    theme: c.style.theme
  }));
  res.json(channelsList);
});

app.get('/api/history', async (_req, res) => {
  try {
    const scriptsDir = './output/scripts';
    const videosDir = './output/videos';
    const audioDir = './output/audio';

    const scripts = await readdir(scriptsDir).catch(() => [] as string[]);
    const videos = await readdir(videosDir).catch(() => [] as string[]);
    const audios = await readdir(audioDir).catch(() => [] as string[]);

    const history = await Promise.all(
      scripts.map(async (filename) => {
        const content = await readFile(path.join(scriptsDir, filename), 'utf-8');
        const script = JSON.parse(content) as { title?: string };
        const timestampStr = filename.match(/\d+/)?.[0] || String(Date.now());
        const timestamp = parseInt(timestampStr, 10);
        const channelId = filename.split('-')[0];

        return {
          id: timestamp,
          channel: channelId,
          title: script.title || 'Untitled',
          timestamp,
          hasVideo: videos.some((v) => v.includes(timestampStr)),
          hasAudio: audios.some((a) => a.includes(timestampStr)),
          scriptPath: `/output/scripts/${filename}`,
          videoPath: videos.find((v) => v.includes(timestampStr)) ? `/output/videos/${videos.find((v) => v.includes(timestampStr))}` : null,
          audioPath: audios.find((a) => a.includes(timestampStr)) ? `/output/audio/${audios.find((a) => a.includes(timestampStr))}` : null
        };
      })
    );

    res.json(history.sort((a, b) => b.timestamp - a.timestamp));
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to load history');
    res.status(500).json({ error: 'Failed to load history' });
  }
});

app.post('/api/generate', authMiddleware, generateRateLimiter, validateBody(generateVideoSchema), async (req: AuthRequest, res) => {
  const { channelId, topic } = req.body as { channelId: string; topic: string };

  const channel = channels[channelId];
  if (!channel) {
    res.status(400).json({ error: 'Invalid channel' });
    return;
  }

  const jobId = Date.now().toString();
  const projectId = `${channel.id}-${jobId}`;

  logger.info({ jobId, channelId, topic, user: req.user?.username }, 'Starting video generation');
  res.json({ jobId, status: 'started' });

  const socketRoom = `job-${jobId}`;

  const pipeline = new FullVideoPipeline();

  const logToSocket = (message: string) => {
    logger.debug({ jobId, message }, 'Pipeline progress');
    io.to(socketRoom).emit('progress', { message });
  };

  io.to(socketRoom).emit('progress', {
    step: 'started',
    message: `Starting generation for: ${topic}`
  });

  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    originalLog(...args);
    logToSocket(args.map(String).join(' '));
  };

  try {
    const videoPath = await pipeline.generateVideo(channel, topic, projectId);

    const scriptPath = `./output/scripts/${projectId}.json`;
    const audioPath = `./output/audio/${projectId}.mp3`;

    logger.info({ jobId, projectId, videoPath }, 'Video generation complete');

    io.to(socketRoom).emit('complete', {
      jobId,
      projectId,
      videoPath: videoPath.replace('./output/', '/output/'),
      scriptPath: scriptPath.replace('./output/', '/output/'),
      audioPath: audioPath.replace('./output/', '/output/'),
      message: 'Video generation complete!'
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ jobId, error: err.message }, 'Video generation failed');
    io.to(socketRoom).emit('error', {
      jobId,
      error: err.message
    });
  } finally {
    console.log = originalLog;
  }
});

app.get('/api/schedule', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const videos = await scheduler.getUpcomingVideos(days);
    res.json(videos);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to get schedule');
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/schedule', authMiddleware, validateBody(scheduleVideoSchema), async (req: AuthRequest, res) => {
  try {
    const { channelId, topic, date } = req.body as { channelId: string; topic: string; date: string };
    logger.info({ channelId, topic, date, user: req.user?.username }, 'Scheduling video');
    const video = await scheduler.scheduleVideo(channelId, topic, new Date(date));
    res.json(video);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to schedule video');
    res.status(500).json({ error: err.message });
  }
});

// Generate topic suggestions for a channel
app.get('/api/topics/:channelId', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const channelIdParam = req.params.channelId;
    const channelId = typeof channelIdParam === 'string' ? channelIdParam : channelIdParam[0];
    const countParam = req.query.count;
    const count = countParam && typeof countParam === 'string' ? parseInt(countParam) : 5;
    
    logger.info({ channelId, count, user: req.user?.username }, 'Generating topic suggestions');
    const suggestions = await scheduler.generateTopicSuggestions(channelId, count);
    
    res.json({ suggestions });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to generate topics');
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/schedule/:id', authMiddleware, validateParams(idParamSchema), async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    logger.info({ id, user: req.user?.username }, 'Deleting scheduled video');
    await schedulerDb.deleteVideo(id);
    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to delete scheduled video');
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/schedule/:id', authMiddleware, validateParams(idParamSchema), validateBody(updateScheduleSchema), async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    logger.info({ id, user: req.user?.username }, 'Updating scheduled video');
    await schedulerDb.updateVideo(id, req.body);
    res.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to update scheduled video');
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/schedule/:id/metadata', validateParams(idParamSchema), async (req, res) => {
  try {
    const id = String(req.params.id);
    const videos = await schedulerDb.getVideos();
    const video = videos.find((v) => v.id === id);

    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    res.json(video.metadata || {
      title: video.topic,
      description: `${video.topic}\n\nGenerated automatically`,
      tags: [video.topic.toLowerCase()],
      seoScore: 0,
      trendingKeywords: []
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to get video metadata');
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/youtube/upload', authMiddleware, uploadRateLimiter, validateBody(youtubeUploadSchema), async (req: AuthRequest, res) => {
  try {
    const { videoId, config } = req.body as { videoId: string; config?: { title?: string; description?: string; tags?: string[]; category?: string; privacy?: string } };
    const videos = await schedulerDb.getVideos();
    const video = videos.find((v) => v.id === videoId);

    if (!video || !video.videoPath) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const localVideoPath = resolveOutputVideoPath(video.videoPath);
    if (!existsSync(localVideoPath)) {
      res.status(404).json({ error: 'Video file not found' });
      return;
    }

    const report = await prepublishValidator.validate({
      videoAbsPath: localVideoPath,
      videoUiPath: video.videoPath,
      metadata: {
        title: config?.title,
        description: config?.description,
        tags: Array.isArray(config?.tags) ? config.tags : []
      }
    });

    if (!report.ok) {
      res.status(412).json({ error: 'PREPUBLISH_FAILED', report });
      return;
    }

    const publishJobId = crypto.randomUUID();
    logger.info({ publishJobId, videoId, user: req.user?.username }, 'Starting YouTube upload');
    res.json({ success: true, publishJobId });

    const room = `yt-${publishJobId}`;
    const redirectUri = `${getBaseUrl(req)}/api/youtube/oauth/callback`;

    io.to(room).emit('yt:status', { status: 'starting', progress: 0 });

    try {
      const uploadConfig = {
        title: config?.title || video.topic || 'Untitled Video',
        description: config?.description || '',
        tags: Array.isArray(config?.tags) ? config.tags : [],
        category: config?.category || '22',
        privacy: (config?.privacy as 'private' | 'unlisted' | 'public') || 'unlisted'
      };

      const result = await youtubeUploader.uploadVideoResumable(
        localVideoPath,
        uploadConfig,
        redirectUri,
        (progress, status) => {
          io.to(room).emit('yt:status', { status: status || 'uploading', progress });
        }
      );

      await schedulerDb.updateVideo(videoId, {
        status: 'published',
        youtubeUrl: result.videoUrl,
        publishedAt: new Date()
      });

      logger.info({ publishJobId, youtubeVideoId: result.videoId }, 'YouTube upload complete');

      io.to(room).emit('yt:done', {
        status: 'done',
        progress: 100,
        videoId: result.videoId,
        videoUrl: result.videoUrl,
        appliedPrivacyStatus: result.appliedPrivacyStatus,
        warning: result.warning,
        processingStatus: result.processingStatus
      });
    } catch (error: unknown) {
      const err = error as Error;
      const msg = err.message === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : (err.message || 'Upload failed');
      logger.error({ publishJobId, error: msg }, 'YouTube upload failed');
      io.to(room).emit('yt:error', { status: 'failed', error: msg });
    }
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'YouTube upload request failed');
    res.status(500).json({ error: err.message });
  }
});

function resolveOutputVideoPath(input: string): string {
  if (!input) throw new Error('Missing videoPath');

  const cleaned = input.startsWith('/output/') ? `./output/${input.slice('/output/'.length)}` : input;
  const abs = path.resolve(process.cwd(), cleaned);
  const allowedDir = path.resolve(process.cwd(), 'output', 'videos');
  if (!abs.startsWith(allowedDir + path.sep) && abs !== allowedDir) {
    throw new Error('Invalid videoPath (must be under ./output/videos)');
  }
  return abs;
}

function inferProjectIdFromVideoPath(absVideoPath: string): string {
  const base = path.basename(absVideoPath);
  return base.replace(/\.mp4$/i, '');
}

function inferChannelIdFromProjectId(projectId: string): string | null {
  const keys = Object.keys(channels);
  const matches = keys
    .filter((k) => projectId === k || projectId.startsWith(k + '-'))
    .sort((a, b) => b.length - a.length);
  return matches[0] || null;
}

app.post('/api/prepublish/validate', validateBody(prepublishValidateSchema), async (req, res) => {
  try {
    const { videoPath, metadata } = req.body as {
      videoPath: string;
      metadata?: { title?: string; description?: string; tags?: string[] };
    };

    const localVideoPath = resolveOutputVideoPath(videoPath);
    if (!existsSync(localVideoPath)) {
      res.status(404).json({ error: 'Video file not found' });
      return;
    }

    const report = await prepublishValidator.validate({
      videoAbsPath: localVideoPath,
      videoUiPath: videoPath,
      metadata
    });

    res.json(report);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Validation failed');
    res.status(500).json({ error: err.message || 'Validation failed' });
  }
});

app.post('/api/prepublish/regenerate-assets', authMiddleware, generateRateLimiter, validateBody(regenerateAssetsSchema), async (req: AuthRequest, res) => {
  const { videoPath, forceImagesOnly, minClips } = req.body as {
    videoPath: string;
    forceImagesOnly?: boolean;
    minClips?: number;
  };

  try {
    const localVideoPath = resolveOutputVideoPath(videoPath);
    if (!existsSync(localVideoPath)) {
      res.status(404).json({ error: 'Video file not found' });
      return;
    }

    const projectId = inferProjectIdFromVideoPath(localVideoPath);
    const channelId = inferChannelIdFromProjectId(projectId);
    const channel = channelId ? channels[channelId] : undefined;
    if (!channel) {
      res.status(400).json({ error: 'Invalid channel for projectId' });
      return;
    }

    const metaPath = path.resolve(process.cwd(), 'output', 'meta', `${projectId}.json`);
    let topic = projectId;
    try {
      const raw = await readFile(metaPath, 'utf-8');
      const meta = JSON.parse(raw) as { topic?: string };
      if (typeof meta?.topic === 'string' && meta.topic.trim()) topic = meta.topic.trim();
    } catch {
      // ignore
    }

    const jobId = Date.now().toString();
    logger.info({ jobId, projectId, user: req.user?.username }, 'Starting asset regeneration');
    res.json({ jobId, status: 'started', projectId });

    const socketRoom = `job-${jobId}`;
    const pipeline = new FullVideoPipeline();

    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      originalLog(...args);
      io.to(socketRoom).emit('progress', { message: args.map(String).join(' ') });
    };

    io.to(socketRoom).emit('progress', {
      step: 'started',
      message: 'Regenerating assets + recomposing video...'
    });

    pipeline
      .regenerateAssetsAndRecompose(channel, topic, projectId, {
        forceImagesOnly: !!forceImagesOnly,
        minClipsRequested: Number.isFinite(minClips) ? Math.max(0, Number(minClips)) : undefined
      })
      .then((newVideoPath) => {
        const scriptPath = `./output/scripts/${projectId}.json`;
        const audioPath = `./output/audio/${projectId}.mp3`;

        logger.info({ jobId, projectId, newVideoPath }, 'Asset regeneration complete');

        io.to(socketRoom).emit('complete', {
          jobId,
          projectId,
          videoPath: newVideoPath.replace('./output/', '/output/'),
          scriptPath: scriptPath.replace('./output/', '/output/'),
          audioPath: audioPath.replace('./output/', '/output/'),
          message: 'Assets regenerated + video recomposed!'
        });
      })
      .catch((err: Error) => {
        logger.error({ jobId, error: err.message }, 'Asset regeneration failed');
        io.to(socketRoom).emit('error', { jobId, error: err.message || 'Regeneration failed' });
      })
      .finally(() => {
        console.log = originalLog;
      });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Regeneration request failed');
    res.status(500).json({ error: err.message || 'Regeneration failed' });
  }
});

app.post('/api/youtube/publish', authMiddleware, uploadRateLimiter, validateBody(youtubePublishSchema), async (req: AuthRequest, res) => {
  try {
    const { videoPath, metadata } = req.body as {
      videoPath: string;
      metadata?: {
        title?: string;
        description?: string;
        tags?: string[];
        categoryId?: string;
        privacyStatus?: 'private' | 'unlisted' | 'public';
      };
    };

    const localVideoPath = resolveOutputVideoPath(videoPath);
    if (!existsSync(localVideoPath)) {
      res.status(404).json({ error: 'Video file not found' });
      return;
    }

    const report = await prepublishValidator.validate({
      videoAbsPath: localVideoPath,
      videoUiPath: videoPath,
      metadata: {
        title: metadata?.title,
        description: metadata?.description,
        tags: Array.isArray(metadata?.tags) ? metadata.tags : []
      }
    });

    if (!report.ok) {
      res.status(412).json({ error: 'PREPUBLISH_FAILED', report });
      return;
    }

    const publishJobId = crypto.randomUUID();
    logger.info({ publishJobId, videoPath, user: req.user?.username }, 'Starting YouTube publish');
    res.json({ success: true, publishJobId });

    const room = `yt-${publishJobId}`;
    const redirectUri = `${getBaseUrl(req)}/api/youtube/oauth/callback`;

    const job: YouTubePublishJob = {
      id: publishJobId,
      status: 'starting' as const,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      videoPath: localVideoPath,
      request: {
        title: metadata?.title || path.basename(localVideoPath),
        description: metadata?.description || '',
        tags: Array.isArray(metadata?.tags) ? metadata.tags : [],
        categoryId: metadata?.categoryId || '22',
        privacyStatus: metadata?.privacyStatus || 'unlisted'
      }
    };
    await youtubePublishStore.upsert(job);

    io.to(room).emit('yt:status', { status: 'starting', progress: 0 });

    try {
      const result = await youtubeUploader.uploadVideoResumable(
        localVideoPath,
        {
          title: job.request.title,
          description: job.request.description,
          tags: job.request.tags,
          category: job.request.categoryId,
          privacy: job.request.privacyStatus
        },
        redirectUri,
        async (progress, status) => {
          io.to(room).emit('yt:status', { status: status || 'uploading', progress });
          const validStatuses = ['starting', 'uploading', 'processing', 'done'] as const;
          const nextStatus = validStatuses.includes(status as typeof validStatuses[number])
            ? (status as typeof validStatuses[number])
            : 'uploading';
          await youtubePublishStore.upsert({
            ...job,
            status: nextStatus,
            progress,
            updatedAt: new Date().toISOString()
          });
        }
      );

      const done: YouTubePublishJob = {
        ...job,
        status: 'done' as const,
        progress: 100,
        updatedAt: new Date().toISOString(),
        videoId: result.videoId,
        videoUrl: result.videoUrl,
        appliedPrivacyStatus: result.appliedPrivacyStatus,
        warning: result.warning,
        processingStatus: result.processingStatus
      };
      await youtubePublishStore.upsert(done);

      logger.info({ publishJobId, youtubeVideoId: result.videoId }, 'YouTube publish complete');

      io.to(room).emit('yt:done', {
        status: 'done',
        progress: 100,
        videoId: result.videoId,
        videoUrl: result.videoUrl,
        appliedPrivacyStatus: result.appliedPrivacyStatus,
        warning: result.warning,
        processingStatus: result.processingStatus
      });
    } catch (error: unknown) {
      const err = error as Error;
      const msg = err.message === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : (err.message || 'Upload failed');

      await youtubePublishStore.upsert({
        ...job,
        status: 'failed',
        progress: job.progress,
        updatedAt: new Date().toISOString(),
        error: msg
      });

      logger.error({ publishJobId, error: msg }, 'YouTube publish failed');
      io.to(room).emit('yt:error', { status: 'failed', error: msg });
    }
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'YouTube publish request failed');
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/publish/history', async (_req, res) => {
  try {
    const jobs = await youtubePublishStore.list();
    res.json(jobs);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to get publish history');
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/publish/:id', validateParams(idParamSchema), async (req, res) => {
  try {
    const id = String(req.params.id);
    const job = await youtubePublishStore.get(id);
    if (!job) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(job);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to get publish job');
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/status', async (_req, res) => {
  try {
    const status = await youtubeUploader.getAuthStatus();
    res.json(status);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to get YouTube status');
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/connect', optionalAuthMiddleware, async (req, res) => {
  try {
    const redirectUri = `${getBaseUrl(req)}/api/youtube/oauth/callback`;
    const state = crypto.randomUUID();
    const url = await youtubeUploader.getAuthUrl(redirectUri, state);
    res.json({ url });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Failed to get YouTube connect URL');
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/oauth/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) {
      res.status(400).send('Missing ?code');
      return;
    }
    const redirectUri = `${getBaseUrl(req)}/api/youtube/oauth/callback`;
    await youtubeUploader.handleOAuthCallback(code, redirectUri);
    logger.info('YouTube OAuth callback successful');
    res.send('YouTube connected. You can close this tab and return to ChrisStudio.');
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message }, 'OAuth callback failed');
    res.status(500).send(`OAuth failed: ${err.message}`);
  }
});

io.on('connection', (socket) => {
  logger.debug({ socketId: socket.id }, 'Client connected');

  socket.on('subscribe', (jobId: string) => {
    socket.join(`job-${jobId}`);
    logger.debug({ socketId: socket.id, jobId }, 'Client subscribed to job');
  });

  socket.on('subscribe-youtube', (publishJobId: string) => {
    socket.join(`yt-${publishJobId}`);
    logger.debug({ socketId: socket.id, publishJobId }, 'Client subscribed to YouTube job');
  });

  socket.on('disconnect', () => {
    logger.debug({ socketId: socket.id }, 'Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, async () => {
  logger.info({ port: PORT }, 'ChrisStudio Server starting');
  console.log('\n ChrisStudio Server');
  console.log('='.repeat(50));
  console.log(`Web UI:  http://localhost:${PORT}`);
  console.log(`API:     http://localhost:${PORT}/api`);
  console.log(`Auth:    ${isAuthEnabled() ? 'ENABLED' : 'DISABLED (set AUTH_ENABLED=true)'}`);
  console.log('='.repeat(50));

  scheduler.start();

  logger.info('Generating video schedule...');
  await scheduler.generateSchedule(4);

  logger.info('ChrisStudio ready');
  console.log('\n Ready to create videos!\n');
});

// ─── Graceful shutdown ──────────────────────────────────────────────
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, closing…');
  scheduler.stop();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10 s if connections are still open
  setTimeout(() => {
    logger.warn('Forceful shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
