import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { FullVideoPipeline } from './workflows/full-video-pipeline.js';
import { VideoScheduler } from './services/video-scheduler.js';
import { SchedulerDatabase } from './services/scheduler-db.js';
import { YouTubeUploader } from './services/youtube-uploader.js';
import { channels } from './config/channels.js';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

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

    const videoPath = await pipeline.generateVideo(channel, topic);

    io.to(socketRoom).emit('complete', { 
      jobId,
      videoPath: videoPath.replace('./output/', '/output/'),
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
    
    const youtubeUrl = await youtubeUploader.uploadVideo(video.videoPath, config);
    
    await schedulerDb.updateVideo(videoId, {
      status: 'published',
      youtubeUrl,
      publishedAt: new Date()
    });
    
    res.json({ success: true, youtubeUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/youtube/auth-url', (req, res) => {
  try {
    const url = youtubeUploader.getAuthUrl();
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', (jobId: string) => {
    socket.join(`job-${jobId}`);
    console.log(`Client ${socket.id} subscribed to job-${jobId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, async () => {
  console.log('\n🎬 YouTube Creator Studio Server');
  console.log('='.repeat(50));
  console.log(`🌐 Web UI:  http://localhost:${PORT}`);
  console.log(`📡 API:     http://localhost:${PORT}/api`);
  console.log('='.repeat(50));
  
  // Initialize YouTube uploader
  await youtubeUploader.initialize();
  
  // Start video scheduler
  scheduler.start();
  
  // Generate schedule for next 4 weeks
  console.log('📅 Generating video schedule...');
  await scheduler.generateSchedule(4);
  
  console.log('\n✨ Ready to create videos!\n');
});

export default app;
