# 🎬 YouTube Creator Studio - Architecture Complete

## 📊 Vue d'ensemble

```
Pipeline Complet de Génération Vidéo
=====================================

1. SCRIPT GENERATION (Claude Sonnet 4)
   └─> Génère un script de 9 min avec sections visuelles

2. VOICE GENERATION (Edge TTS)
   └─> Convertit le script en narration MP3

3. ASSET COLLECTION (Pexels API)
   └─> Recherche images/vidéos pertinentes

4. ASSET DOWNLOAD
   └─> Télécharge les fichiers localement

5. VIDEO COMPOSITION (FFmpeg)
   └─> Assemble tout en vidéo 1080p avec transitions
```

## 📁 Structure Finale

```
youtube-creator-studio/
│
├── 📄 Configuration
│   ├── package.json             # Dépendances et scripts
│   ├── tsconfig.json            # Config TypeScript
│   ├── .env                     # Clés API (privé)
│   └── .env.example             # Template
│
├── 📚 Documentation
│   ├── README.md                # Guide principal
│   ├── docs/QUICKSTART.md       # Guide de démarrage rapide
│   ├── docs/PEXELS_SETUP.md     # Configuration Pexels
│   └── docs/ARCHITECTURE.md     # Ce fichier
│
├── 💻 Code Source (src/)
│   │
│   ├── 🎭 Types (types/)
│   │   └── index.ts             # Interfaces TypeScript
│   │
│   ├── ⚙️ Configuration (config/)
│   │   └── channels.ts          # Config des 3 chaînes
│   │
│   ├── 🔧 Services (services/)
│   │   ├── script-generator.ts  # Claude API
│   │   ├── voice-generator.ts   # Edge TTS
│   │   ├── asset-collector.ts   # Pexels search
│   │   ├── asset-downloader.ts  # Download manager
│   │   └── video-composer.ts    # FFmpeg wrapper
│   │
│   ├── 🔄 Workflows (workflows/)
│   │   └── full-video-pipeline.ts # Orchestration complète
│   │
│   ├── 🧪 Tests (tests/)
│   │   ├── test-edge-tts.ts     # Test voix
│   │   ├── test-assets.ts       # Test assets
│   │   └── test-ffmpeg.ts       # Test vidéo
│   │
│   ├── 🖥️ CLI
│   │   └── cli.ts               # Interface ligne de commande
│   │
│   └── 🚀 Entry Point
│       └── index.ts             # Point d'entrée
│
└── 📦 Outputs (output/)
    ├── scripts/                 # Scripts JSON générés
    ├── audio/                   # Narrations MP3
    ├── videos/                  # Vidéos finales MP4
    └── tests/                   # Fichiers de test
```

## 🔌 Services & APIs

### 1. Script Generator (`script-generator.ts`)
```typescript
Input:  Channel config + Topic
API:    Claude Sonnet 4 (Anthropic)
Output: Structured JSON script with sections
```

**Responsabilités:**
- Génère script de 9 minutes
- Crée des sections avec search queries
- Adapte le ton selon la chaîne

### 2. Voice Generator (`voice-generator.ts`)
```typescript
Input:  Text + Voice config
API:    Edge TTS (Microsoft, gratuit)
Output: MP3 audio file
```

**Responsabilités:**
- Convertit texte en parole
- Support 3 voix différentes (UK/US)
- Contrôle rate/pitch

### 3. Asset Collector (`asset-collector.ts`)
```typescript
Input:  Script sections
API:    Pexels (gratuit, 200 req/h)
Output: Array d'assets (URLs)
```

**Responsabilités:**
- Recherche images HD (1920x1080)
- Recherche vidéos HD
- Rate limiting automatique
- Fallback vers Unsplash

### 4. Asset Downloader (`asset-downloader.ts`)
```typescript
Input:  Assets array avec URLs
Output: Assets avec chemins locaux
```

**Responsabilités:**
- Télécharge fichiers en parallèle
- Gestion des timeouts
- Organisation des fichiers

### 5. Video Composer (`video-composer.ts`)
```typescript
Input:  Script + Audio + Assets
Tool:   FFmpeg
Output: MP4 1080p 30fps
```

**Responsabilités:**
- Effet Ken Burns sur images
- Transitions fade/dissolve
- Sync audio/vidéo
- Encoding H.264

### 6. Full Pipeline (`full-video-pipeline.ts`)
```typescript
Orchestrates: All services in sequence
Output:       Complete MP4 video
```

**Responsabilités:**
- Coordination des 5 étapes
- Gestion des erreurs
- Logging détaillé
- Cleanup optionnel

## 🎨 Channels Configuration

### What If... (Sci-Fi)
```typescript
theme: 'sci-fi'
voice: 'en-US-GuyNeural' (Passion)
style: 'futuristic-conceptual'
color: 'blue-orange'
```

### The Human Odyssey (History)
```typescript
theme: 'historical'
voice: 'en-GB-RyanNeural' (British)
style: 'documentary-classic'
color: 'warm-vintage'
```

### Classified Files (Mystery)
```typescript
theme: 'mysterious'
voice: 'en-US-ChristopherNeural' (Authority)
style: 'noir-documentary'
color: 'desaturated-cold'
```

## 📊 Data Flow

```mermaid
User Input (Topic)
    ↓
[1] Claude API → JSON Script
    ↓
[2] Edge TTS → MP3 Audio
    ↓
[3] Pexels API → Asset URLs
    ↓
[4] Download → Local Files
    ↓
[5] FFmpeg → Final Video.mp4
    ↓
Ready for YouTube!
```

## 🔧 Technologies

| Component | Technology | Free? |
|-----------|-----------|-------|
| Script | Claude Sonnet 4 | ❌ Paid |
| Voice | Edge TTS | ✅ Yes |
| Images | Pexels API | ✅ Yes (200/h) |
| Videos | Pexels Videos | ✅ Yes |
| Composition | FFmpeg | ✅ Yes |
| Runtime | Node.js + TypeScript | ✅ Yes |

## 📈 Performance

### Temps de Génération
- Script: ~30 secondes
- Audio: ~1 minute
- Assets: ~2 minutes (download)
- Video: ~3-5 minutes (FFmpeg)
- **Total: ~7-10 minutes**

### Coûts (par vidéo)
- Claude API: ~$0.10-0.20
- Edge TTS: $0 (gratuit)
- Pexels: $0 (gratuit)
- FFmpeg: $0 (gratuit)
- **Total: ~$0.10-0.20**

## 🚀 Commandes CLI

```bash
# Pipeline complet
npm run generate:full [channel] [topic]

# Script + Audio seulement
npm run generate [channel] [topic]

# Tests
npm run test:tts      # Voix
npm run test:assets   # Pexels
npm run test:video    # FFmpeg

# Info
npm run voices        # Liste voix
```

## 🔮 Roadmap

### ✅ Complété
- [x] Script generation avec Claude
- [x] Voice synthesis avec Edge TTS
- [x] Asset collection Pexels/Unsplash
- [x] Asset downloading
- [x] Video composition FFmpeg
- [x] Full pipeline automation
- [x] Multi-channel support

### 🚧 En Développement
- [ ] Sous-titres automatiques
- [ ] Musique de fond
- [ ] Upload YouTube automatique
- [ ] Scheduling de publications
- [ ] Analytics & tracking

### 💡 Futures Fonctionnalités
- [ ] Support vidéos multi-langues
- [ ] A/B testing thumbnails
- [ ] SEO optimization auto
- [ ] Intégration TikTok/Shorts
- [ ] Text-to-video avec AI (Runway, Pika)

## 🛡️ Best Practices

### Sécurité
- ✅ Clés API dans `.env` (jamais commité)
- ✅ `.gitignore` pour fichiers sensibles
- ✅ Rate limiting Pexels

### Performance
- ✅ Parallel asset downloads
- ✅ Streaming FFmpeg
- ✅ Cleanup assets après vidéo
- ✅ Cache script results

### Qualité
- ✅ TypeScript strict mode
- ✅ Error handling complet
- ✅ Logging détaillé
- ✅ Tests pour chaque service

## 📞 Support

- 📖 Docs: [README.md](../README.md)
- 🚀 Quick Start: [QUICKSTART.md](QUICKSTART.md)
- 🎨 Pexels Setup: [PEXELS_SETUP.md](PEXELS_SETUP.md)
- 🐛 Issues: GitHub Issues

---

**Built with ❤️ for content creators**
