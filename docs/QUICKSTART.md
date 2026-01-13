# 🚀 Quick Start Guide

## 1. Initial Setup (5 minutes)

### Install Dependencies
```bash
npm install
pip install edge-tts
cp .env.example .env
```

### Get Your API Keys

#### Claude API (Required)
1. Go to https://console.anthropic.com/
2. Sign up / Login
3. Get your API key
4. Add to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

#### Pexels API (Required for images/videos)
1. Go to https://www.pexels.com/api/
2. Create free account
3. Get your API key
4. Add to `.env`:
   ```
   PEXELS_API_KEY=563492ad6f917000...
   ```

## 2. Test Each Component (10 minutes)

### Test Voice Generation
```bash
npm run test:tts
```
✅ Creates 3 audio files in `output/tests/`

### Test Asset Collection
```bash
npm run test:assets
```
✅ Downloads 3 images/videos from Pexels

## 3. Generate Your First Video! 🎬

### Option A: Full Automated Pipeline (Recommended)
```bash
npm run generate:full what-if "What if humans could breathe underwater?"
```

This will:
1. Generate script with Claude (~30 seconds)
2. Generate narration with Edge TTS (~1 minute)
3. Download 5-6 assets from Pexels (~2 minutes)
4. Compose video with FFmpeg (~3-5 minutes)
5. Output: Final MP4 in `output/videos/`

**Total time: ~7-10 minutes** ⏱️

### Option B: Script + Audio Only (Faster)
```bash
npm run generate what-if "What if gravity suddenly stopped?"
```

Output: Script JSON + MP3 audio file

## 4. Available Channels

### 🌌 What If... (Sci-Fi / Hypothetical)
```bash
npm run generate:full what-if "What if [scenario]?"
```
**Best topics:**
- Future scenarios
- Scientific hypotheticals  
- "What if Earth had two moons?"
- "What if we could time travel?"

### 🏛️ The Human Odyssey (History)
```bash
npm run generate:full human-odyssey "The [historical topic]"
```
**Best topics:**
- Historical events
- Ancient civilizations
- "The Fall of Rome"
- "Ancient Egyptian Engineering"

### 🔍 Classified Files (Mysteries)
```bash
npm run generate:full classified-files "The mystery of [topic]"
```
**Best topics:**
- Unsolved mysteries
- Strange phenomena
- "The Bermuda Triangle"
- "Area 51 Secrets"

## 5. Check Your Outputs

```bash
# View generated files
ls -lh output/videos/
ls -lh output/audio/
ls -lh output/scripts/

# Play audio
mpv output/audio/what-if-*.mp3

# Watch video
mpv output/videos/what-if-*.mp4
```

## 6. Troubleshooting

### "ANTHROPIC_API_KEY not found"
- Make sure `.env` file exists
- Check the key is correct (starts with `sk-ant-`)

### "PEXELS_API_KEY not found"
- You can still generate script + audio
- But video generation needs Pexels
- See [docs/PEXELS_SETUP.md](PEXELS_SETUP.md)

### "FFmpeg error"
```bash
# Make sure FFmpeg is installed
ffmpeg -version

# Install if needed (Ubuntu/Debian)
sudo apt install ffmpeg
```

### "Edge TTS error"
```bash
# Reinstall edge-tts
pip install --upgrade edge-tts

# Test it
edge-tts --list-voices | grep "en-"
```

## 7. Next Steps

1. **Customize voices**: Edit `src/config/channels.ts`
2. **Adjust prompts**: Edit `src/services/script-generator.ts`
3. **Add music**: Extend `video-composer.ts` to add background music
4. **Upload to YouTube**: Use YouTube Data API v3

## 8. Tips for Best Results

### Topic Ideas
- ✅ Specific and intriguing
- ✅ Not too narrow (needs visual content)
- ✅ Engaging questions
- ❌ Too broad ("History of the world")
- ❌ Too obscure (no Pexels content)

### Good Examples:
- "What if the Internet suddenly disappeared?"
- "The rise and fall of the Roman Empire"
- "The mystery of the Voynich manuscript"

### Video Length
- Default: 9 minutes (~540 seconds)
- Adjust in script prompts if needed
- Pexels clips usually 5-10 seconds each

## Need Help?

Check the full [README.md](../README.md) or open an issue on GitHub!

---

**Ready?** Try this command now:

```bash
npm run generate:full what-if "What if artificial intelligence surpassed human intelligence?"
```

🎬 Happy creating! 🚀
