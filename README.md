# 🎬 YouTube Creator Studio

Multi-channel YouTube video automation studio for generating documentary-style videos with AI.

## 📺 Channels

### 1. What If...
Hypothetical scenarios and future possibilities. Explores "what if" questions with engaging storytelling.

### 2. The Human Odyssey
History and civilization exploration. Documentary-style content about historical events and human achievements.

### 3. Classified Files
Mysteries and unexplained phenomena. Investigative content about unsolved cases and strange events.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+ (for Edge TTS)
- FFmpeg

### Installation

```bash
# Install Node dependencies
npm install

# Install Edge TTS (Python)
pip install edge-tts

# Copy environment file
cp .env.example .env

# Add your API keys to .env
# OPENAI_API_KEY=your_openai_key_here
# PEXELS_API_KEY=your_pexels_key_here
```

**Get API Keys:**
- **OpenAI**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Pexels** (free): [https://www.pexels.com/api/](https://www.pexels.com/api/) - See [docs/PEXELS_SETUP.md](docs/PEXELS_SETUP.md)

### Usage

#### 🌐 Web Interface (Recommended!)
```bash
# Start the web server
npm run server

# Or with auto-reload
npm run server:dev
```
Then open **http://localhost:3000** in your browser for a beautiful UI! ✨

#### 💻 Command Line
```bash
# Full pipeline: Generate complete video
npm run generate:full what-if "What if AI became conscious tomorrow?"

# Or generate script & audio only (no video)
npm run generate what-if "What if gravity suddenly stopped?"

# Test components individually
npm run test:tts      # Test voice generation
npm run test:assets   # Test Pexels asset collection
npm run test:video    # Test FFmpeg video composition
npm run voices        # List available voices
```

## 🏗️ Architecture

```
src/
├── config/
│   └── channels.ts          # Channel configurations
├── services/
│   ├── script-generator.ts  # OpenAI GPT-4 for scripts
│   ├── voice-generator.ts   # Edge TTS for narration
│   └── video-composer.ts    # FFmpeg for video assembly
├── tests/
│   ├── test-edge-tts.ts
│   └── test-ffmpeg.ts
├── types/
│   └── index.ts
└── cli.ts                   # Main CLI

output/
├── audio/                   # Generated narrations
├── videos/                  # Final videos
└── scripts/                 # Generated scripts (JSON)
```

## 🎯 Features

- ✅ Multi-channel support (3 channels)
- ✅ AI-powered script generation (OpenAI GPT-4o)
- ✅ High-quality voice synthesis (Edge TTS)
- ✅ Automatic asset collection (Pexels API)
- ✅ Professional video composition (FFmpeg)
- ✅ Complete automation pipeline
- 🚧 Automatic subtitle generation
- 🚧 YouTube upload automation
- 🚧 Music/soundtrack integration

## 🔧 Technology Stack

- **Script Generation**: GPT-4o (OpenAI)
- **Voice**: Edge TTS (Microsoft)
- **Video**: FFmpeg
- **Language**: TypeScript + Node.js

## 📝 Example Workflow

### Quick Start (Full Pipeline)
```bash
npm run generate:full what-if "What if we could control the weather?"
```

This single command will:
1. ✅ **Generate Script**: GPT-4o creates a 9-minute script with visual cues
2. ✅ **Generate Audio**: Edge TTS converts script to narration
3. ✅ **Collect Assets**: Searches and downloads images/videos from Pexels
4. ✅ **Compose Video**: FFmpeg assembles everything with transitions
5. 🎬 **Output**: Final MP4 video ready for YouTube!

### Manual Steps (For Testing)
```bash
# 1. Test each component
npm run test:tts      # Test voices
npm run test:assets   # Test asset collection

# 2. Generate script & audio only
npm run generate what-if "Your topic here"

# 3. Generate full video
npm run generate:full what-if "Your topic here"
```

## 🎙️ Voice Options

- **What If**: `en-US-GuyNeural` (Professional male)
- **Human Odyssey**: `en-GB-RyanNeural` (British narrator)
- **Classified Files**: `en-US-DavisNeural` (Deep mysterious)

## 📄 License

MIT

## 👤 Author

Toulouse790
