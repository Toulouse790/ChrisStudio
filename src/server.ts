import express from 'express';
import cors from 'cors';
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

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize services
const scheduler = new VideoScheduler();
const schedulerDb = new SchedulerDatabase();
const youtubeUploader = new YouTubeUploader();
const youtubePublishStore = new YouTubePublishStore();
const prepublishValidator = new PrepublishValidator();

function getBaseUrl(req: express.Request): string {
  // Behind proxies this may need X-Forwarded-*; for local app this is fine.
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.headers.host;
  return `${proto}://${host}`;
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve output files
app.use('/output', express.static('output'));

// Download video endpoint with proper headers
app.get('/api/download/video/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(process.cwd(), 'output', 'videos', filename);
  
  res.download(filepath, filename, (err) => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) {
        res.status(404).json({ error: 'Video not found' });
      }
    }
  });
});

// Get available channels
app.get('/api/channels', (req, res) => {
  const channelsList = Object.values(channels).map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    theme: c.style.theme
  }));
  res.json(channelsList);
});

// Get generation history
app.get('/api/history', async (req, res) => {
  try {
    const scriptsDir = './output/scripts';
    const videosDir = './output/videos';
    const audioDir = './output/audio';

    const scripts = await readdir(scriptsDir).catch(() => []);
    const videos = await readdir(videosDir).catch(() => []);
    const audios = await readdir(audioDir).catch(() => []);

    const history = await Promise.all(
      scripts.map(async (filename) => {
        const content = await readFile(path.join(scriptsDir, filename), 'utf-8');
        const script = JSON.parse(content);
        const timestampStr = filename.match(/\d+/)?.[0] || String(Date.now());
        const timestamp = parseInt(timestampStr, 10);
        const channelId = filename.split('-')[0];
        
        return {
          id: timestamp,
          channel: channelId,
          title: script.title,
          timestamp,
          hasVideo: videos.some(v => v.includes(timestampStr)),
          hasAudio: audios.some(a => a.includes(timestampStr)),
          scriptPath: `/output/scripts/${filename}`,
          videoPath: videos.find(v => v.includes(timestampStr)) ? `/output/videos/${videos.find(v => v.includes(timestampStr))}` : null,
          audioPath: audios.find(a => a.includes(timestampStr)) ? `/output/audio/${audios.find(a => a.includes(timestampStr))}` : null
        };
      })
    );

    res.json(history.sort((a, b) => b.timestamp - a.timestamp));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// Generate video endpoint
app.post('/api/generate', async (req, res) => {
  const { channelId, topic, mode = 'full' } = req.body;

  if (!channelId || !topic) {
    return res.status(400).json({ error: 'Channel and topic are required' });
  }

  const channel = channels[channelId];
  if (!channel) {
    return res.status(400).json({ error: 'Invalid channel' });
  }

  const jobId = Date.now().toString();
  const projectId = `${channel.id}-${jobId}`;
  res.json({ jobId, status: 'started' });

  // Start generation in background
  const socketRoom = `job-${jobId}`;
  
  try {
    const pipeline = new FullVideoPipeline();
    
    // Override console.log to send to socket
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      originalLog(...args);
      io.to(socketRoom).emit('progress', { message: args.join(' ') });
    };

    io.to(socketRoom).emit('progress', { 
      step: 'started', 
      message: `Starting generation for: ${topic}` 
    });

    const videoPath = await pipeline.generateVideo(channel, topic, projectId);

    const scriptPath = `./output/scripts/${projectId}.json`;
    const audioPath = `./output/audio/${projectId}.mp3`;

    io.to(socketRoom).emit('complete', { 
      jobId,
      projectId,
      videoPath: videoPath.replace('./output/', '/output/'),
      scriptPath: scriptPath.replace('./output/', '/output/'),
      audioPath: audioPath.replace('./output/', '/output/'),
      message: 'Video generation complete!' 
    });

    console.log = originalLog;
  } catch (error: any) {
    io.to(socketRoom).emit('error', { 
      jobId,
      error: error.message 
    });
  }
});

// Scheduler endpoints
app.get('/api/schedule', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const videos = await scheduler.getUpcomingVideos(days);
    res.json(videos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/schedule', async (req, res) => {
  try {
    const { channelId, topic, date } = req.body;
    const video = await scheduler.scheduleVideo(channelId, topic, new Date(date));
    res.json(video);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/schedule/:id', async (req, res) => {
  try {
    await schedulerDb.deleteVideo(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/schedule/:id', async (req, res) => {
  try {
    await schedulerDb.updateVideo(req.params.id, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get video metadata
app.get('/api/schedule/:id/metadata', async (req, res) => {
  try {
    const videos = await schedulerDb.getVideos();
    const video = videos.find(v => v.id === req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json(video.metadata || {
      title: video.topic,
      description: `${video.topic}\n\nGenerated automatically`,
      tags: [video.topic.toLowerCase()],
      seoScore: 0,
      trendingKeywords: []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// YouTube upload endpoint
app.post('/api/youtube/upload', async (req, res) => {
  try {
    const { videoId, config } = req.body;
    const videos = await schedulerDb.getVideos();
    const video = videos.find(v => v.id === videoId);
    
    if (!video || !video.videoPath) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Hard safety gate: never upload if prepublish checks fail.
    // (UI may miss it; server must enforce it.)
    const localVideoPath = resolveOutputVideoPath(video.videoPath);
    if (!existsSync(localVideoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
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
      return res.status(412).json({ error: 'PREPUBLISH_FAILED', report });
    }

    const publishJobId = crypto.randomUUID();
    res.json({ success: true, publishJobId });

    const room = `yt-${publishJobId}`;
    const redirectUri = `${getBaseUrl(req)}/api/youtube/oauth/callback`;

    io.to(room).emit('yt:status', { status: 'starting', progress: 0 });

    try {
      const result = await youtubeUploader.uploadVideoResumable(
        localVideoPath,
        config,
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

      io.to(room).emit('yt:done', {
        status: 'done',
        progress: 100,
        videoId: result.videoId,
        videoUrl: result.videoUrl,
        appliedPrivacyStatus: result.appliedPrivacyStatus,
        warning: result.warning,
        processingStatus: result.processingStatus
      });
    } catch (error: any) {
      const msg = error?.message === 'AUTH_REQUIRED'
        ? 'AUTH_REQUIRED'
        : (error?.message || 'Upload failed');
      io.to(room).emit('yt:error', { status: 'failed', error: msg });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function resolveOutputVideoPath(input: string): string {
  if (!input) throw new Error('Missing videoPath');

  // Accept UI-style URLs like /output/videos/foo.mp4
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

// Pre-publish checks shown in UI before upload
app.post('/api/prepublish/validate', async (req, res) => {
  try {
    const { videoPath, metadata } = req.body as {
      videoPath?: string;
      metadata?: { title?: string; description?: string; tags?: string[] };
    };

    const localVideoPath = resolveOutputVideoPath(videoPath || '');
    if (!existsSync(localVideoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const report = await prepublishValidator.validate({
      videoAbsPath: localVideoPath,
      videoUiPath: videoPath || '',
      metadata
    });

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Validation failed' });
  }
});

// Fix action: regenerate only assets + recomposition (keep script/audio)
app.post('/api/prepublish/regenerate-assets', async (req, res) => {
  const { videoPath, forceImagesOnly, minClips } = req.body as {
    videoPath?: string;
    forceImagesOnly?: boolean;
    minClips?: number;
  };

  try {
    const localVideoPath = resolveOutputVideoPath(videoPath || '');
    if (!existsSync(localVideoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const projectId = inferProjectIdFromVideoPath(localVideoPath);
    const channelId = inferChannelIdFromProjectId(projectId);
    const channel = channelId ? channels[channelId] : undefined;
    if (!channel) {
      return res.status(400).json({ error: 'Invalid channel for projectId' });
    }

    // Topic is stored in manifest (preferred), else fallback to projectId
    const metaPath = path.resolve(process.cwd(), 'output', 'meta', `${projectId}.json`);
    let topic = projectId;
    try {
      const raw = await readFile(metaPath, 'utf-8');
      const meta = JSON.parse(raw);
      if (typeof meta?.topic === 'string' && meta.topic.trim()) topic = meta.topic.trim();
    } catch {
      // ignore
    }

    const jobId = Date.now().toString();
    res.json({ jobId, status: 'started', projectId });

    const socketRoom = `job-${jobId}`;
    const pipeline = new FullVideoPipeline();

    const originalLog = console.log;
    console.log = (...args: any[]) => {
      originalLog(...args);
      io.to(socketRoom).emit('progress', { message: args.join(' ') });
    };

    io.to(socketRoom).emit('progress', {
      step: 'started',
      message: '🔧 Regenerating assets + recomposing video...'
    });

    pipeline
      .regenerateAssetsAndRecompose(channel, topic, projectId, {
        forceImagesOnly: !!forceImagesOnly,
        minClipsRequested: Number.isFinite(minClips) ? Math.max(0, Number(minClips)) : undefined
      })
      .then((newVideoPath) => {
        const scriptPath = `./output/scripts/${projectId}.json`;
        const audioPath = `./output/audio/${projectId}.mp3`;

        io.to(socketRoom).emit('complete', {
          jobId,
          projectId,
          videoPath: newVideoPath.replace('./output/', '/output/'),
          scriptPath: scriptPath.replace('./output/', '/output/'),
          audioPath: audioPath.replace('./output/', '/output/'),
          message: 'Assets regenerated + video recomposed!'
        });
      })
      .catch((err: any) => {
        io.to(socketRoom).emit('error', { jobId, error: err?.message || 'Regeneration failed' });
      })
      .finally(() => {
        console.log = originalLog;
      });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Regeneration failed' });
  }
});

// Publish a generated MP4 directly (from the "Video Ready" screen)
app.post('/api/youtube/publish', async (req, res) => {
  try {
    const { videoPath, metadata } = req.body as {
      videoPath?: string;
      metadata?: {
        title?: string;
        description?: string;
        tags?: string[];
        categoryId?: string;
        privacyStatus?: 'private' | 'unlisted' | 'public';
      };
    };

    const localVideoPath = resolveOutputVideoPath(videoPath || '');
    if (!existsSync(localVideoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    // Hard safety gate: never publish a failed video.
    const report = await prepublishValidator.validate({
      videoAbsPath: localVideoPath,
      videoUiPath: videoPath || '',
      metadata: {
        title: metadata?.title,
        description: metadata?.description,
        tags: Array.isArray(metadata?.tags) ? metadata!.tags : []
      }
    });

    if (!report.ok) {
      return res.status(412).json({ error: 'PREPUBLISH_FAILED', report });
    }

    const publishJobId = crypto.randomUUID();
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
        tags: Array.isArray(metadata?.tags) ? metadata!.tags : [],
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
          const nextStatus = (status === 'starting' || status === 'uploading' || status === 'processing' || status === 'done')
            ? status
            : 'uploading';
          await youtubePublishStore.upsert({
            ...job,
            status: nextStatus,
            progress,
            updatedAt: new Date().toISOString()
          });
        }
      );

      const done = {
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

      io.to(room).emit('yt:done', {
        status: 'done',
        progress: 100,
        videoId: result.videoId,
        videoUrl: result.videoUrl,
        appliedPrivacyStatus: result.appliedPrivacyStatus,
        warning: result.warning,
        processingStatus: result.processingStatus
      });
    } catch (error: any) {
      const msg = error?.message === 'AUTH_REQUIRED'
        ? 'AUTH_REQUIRED'
        : (error?.message || 'Upload failed');

      await youtubePublishStore.upsert({
        ...job,
        status: 'failed',
        progress: job.progress,
        updatedAt: new Date().toISOString(),
        error: msg
      });

      io.to(room).emit('yt:error', { status: 'failed', error: msg });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/youtube/publish/history', async (req, res) => {
  try {
    const jobs = await youtubePublishStore.list();
    res.json(jobs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/youtube/publish/:id', async (req, res) => {
  try {
    const job = await youtubePublishStore.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/youtube/status', async (req, res) => {
  try {
    const status = await youtubeUploader.getAuthStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/youtube/connect', async (req, res) => {
  try {
    const redirectUri = `${getBaseUrl(req)}/api/youtube/oauth/callback`;
    const state = crypto.randomUUID();
    const url = await youtubeUploader.getAuthUrl(redirectUri, state);
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/youtube/oauth/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) {
      return res.status(400).send('Missing ?code');
    }
    const redirectUri = `${getBaseUrl(req)}/api/youtube/oauth/callback`;
    await youtubeUploader.handleOAuthCallback(code, redirectUri);
    res.send('YouTube connected. You can close this tab and return to ChrisStudio.');
  } catch (error: any) {
    res.status(500).send(`OAuth failed: ${error.message}`);
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', (jobId: string) => {
    socket.join(`job-${jobId}`);
    console.log(`Client ${socket.id} subscribed to job-${jobId}`);
  });

  socket.on('subscribe-youtube', (publishJobId: string) => {
    socket.join(`yt-${publishJobId}`);
    console.log(`Client ${socket.id} subscribed to yt-${publishJobId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, async () => {
  console.log('\n🎬 ChrisStudio Server');
  console.log('='.repeat(50));
  console.log(`🌐 Web UI:  http://localhost:${PORT}`);
  console.log(`📡 API:     http://localhost:${PORT}/api`);
  console.log('='.repeat(50));
  
  // Start video scheduler
  scheduler.start();
  
  // Generate schedule for next 4 weeks
  console.log('📅 Generating video schedule...');
  await scheduler.generateSchedule(4);
  
  console.log('\n✨ Ready to create videos!\n');
});

export default app;
