import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { FullVideoPipeline } from './workflows/full-video-pipeline.js';
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

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve output files
app.use('/output', express.static('output'));

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
        const timestamp = filename.match(/\d+/)?.[0] || Date.now();
        const channelId = filename.split('-')[0];
        
        return {
          id: timestamp,
          channel: channelId,
          title: script.title,
          timestamp: parseInt(timestamp),
          hasVideo: videos.some(v => v.includes(timestamp)),
          hasAudio: audios.some(a => a.includes(timestamp)),
          scriptPath: `/output/scripts/${filename}`,
          videoPath: videos.find(v => v.includes(timestamp)) ? `/output/videos/${videos.find(v => v.includes(timestamp))}` : null,
          audioPath: audios.find(a => a.includes(timestamp)) ? `/output/audio/${audios.find(a => a.includes(timestamp))}` : null
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

httpServer.listen(PORT, () => {
  console.log('\n🎬 YouTube Creator Studio Server');
  console.log('='.repeat(50));
  console.log(`🌐 Web UI:  http://localhost:${PORT}`);
  console.log(`📡 API:     http://localhost:${PORT}/api`);
  console.log('='.repeat(50));
  console.log('\n✨ Ready to create videos!\n');
});

export default app;
