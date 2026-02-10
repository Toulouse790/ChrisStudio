# ChrisStudio

Copyright (c) 2026 Christophe SENTENAC

Studio de production automatisee de videos YouTube style documentaire avec IA.

## Chaines

### 1. What If...
Scenarios hypothetiques et possibilites futures. Explore des questions "et si..." avec un storytelling captivant.

### 2. The Human Odyssey
Exploration de l'histoire et des civilisations. Contenu documentaire sur les evenements historiques.

### 3. Classified Files
Mysteres et phenomenes inexpliques. Contenu investigatif sur les affaires non resolues.

## Prerequis

- Node.js 18+
- FFmpeg (pour le montage video)

### Installation FFmpeg

**Windows:**
1. Telecharge: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
2. Extrait dans `C:\ffmpeg`
3. Ajoute `C:\ffmpeg\bin` au PATH Windows

**Linux:**
```bash
sudo apt install ffmpeg
```

**Mac:**
```bash
brew install ffmpeg
```

## Installation

```bash
# Clone le repo
git clone https://github.com/Toulouse790/youtube-creator-studio.git
cd youtube-creator-studio

# Installe les dependances
npm install

# Configure les cles API
cp .env.example .env
# Edite .env avec tes cles
```

## Configuration (.env)

```env
# OpenAI (GPT-4) - Generation de scripts
OPENAI_API_KEY=sk-...

# Pexels (gratuit) - B-roll videos/images
PEXELS_API_KEY=...

# ElevenLabs - Synthese vocale pro
ELEVENLABS_API_KEY=...

PORT=3000
NODE_ENV=development
```

**Obtenir les cles API:**
- **OpenAI**: https://platform.openai.com/api-keys
- **Pexels** (gratuit): https://www.pexels.com/api/
- **ElevenLabs**: https://elevenlabs.io/

## Utilisation

### Interface Web (Recommande)

```bash
npm start
```

Ouvre **http://localhost:3000**

1. Choisis ta chaine
2. Entre un sujet
3. Clique "Generer la video"
4. Attends ~5-10 min
5. Video prete dans `output/videos/`

### Ligne de commande

```bash
# Pipeline complet
npm run generate:full what-if "Et si l'IA devenait consciente?"

# Script + audio seulement
npm run generate what-if "Et si la gravite disparaissait?"

# Tests
npm run test:tts      # Test voix
npm run test:assets   # Test Pexels
npm run test:video    # Test FFmpeg
```

## Fonctionnalites

| Fonctionnalite | Statut |
|----------------|--------|
| Multi-chaines (3 chaines) | OK |
| Generation de scripts IA (GPT-4o) | OK |
| Synthese vocale pro (ElevenLabs) | OK |
| B-roll automatique (Pexels API) | OK |
| Montage video (FFmpeg 1080p) | OK |
| Structure narrative 3 actes | OK |
| Pacing dynamique (2-12s/plan) | OK |
| Effets visuels (8+ effets) | OK |
| Color grading par chaine | OK |
| Transitions fluides | OK |
| Interface francaise | OK |
| Interface mobile responsive | OK |
| Musique de fond + auto-ducking | En attente d'assets |
| Sound design (SFX) | En attente d'assets |
| Upload YouTube | OK |

## Architecture

```
src/
├── config/
│   └── channels.ts              # Configuration des chaines
├── services/
│   ├── script-generator.ts      # GPT-4o (3 actes, micro-hooks)
│   ├── voice-generator-elevenlabs.ts  # ElevenLabs TTS
│   ├── asset-collector.ts       # Pexels API
│   ├── video-composer.ts        # FFmpeg montage
│   ├── visual-effects-engine.ts # 8+ effets visuels
│   ├── dynamic-pacing-engine.ts # Pacing adaptatif
│   ├── music-manager.ts         # Musique + auto-ducking
│   └── sound-design-manager.ts  # SFX
├── workflows/
│   └── full-video-pipeline.ts   # Pipeline complet
└── server.ts                    # Serveur Express

public/
├── index.html    # Interface (francais)
├── styles.css    # Themes par chaine
└── app.js        # Logique frontend

output/
├── audio/        # Narrations generees
├── videos/       # Videos finales
├── scripts/      # Scripts JSON
└── meta/         # Metadonnees projets
```

## Stack technique

- **Scripts**: GPT-4o (OpenAI)
- **Voix**: ElevenLabs
- **Video**: FFmpeg
- **B-roll**: Pexels API
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: HTML/CSS/JS vanilla

## Voix par chaine

| Chaine | Voice ID ElevenLabs |
|--------|---------------------|
| What If | `gnPxliFHTp6OK2tcoA6i` |
| Human Odyssey | `QIhD5ivPGEoYZQDocuHI` |
| Classified Files | `2gPFXx8pN3Avh27Dw5Ma` |

## Musique (optionnel)

Pour ajouter de la musique de fond, place des fichiers MP3 dans:

```
assets/music/
├── ambient/      # Ambiance calme
├── epic/         # Epique/dramatique
├── mysterious/   # Mysterieux
└── uplifting/    # Inspirant
```

## SFX (optionnel)

Pour les effets sonores:

```
assets/sfx/
├── whoosh/       # Transitions
├── impact/       # Impacts
├── transition/   # Changements de scene
├── reveal/       # Revelations
└── tension/      # Tension
```

## Cout estime par video

- **ElevenLabs**: ~0.50-1.50 EUR (10 min narration)
- **OpenAI**: ~0.10-0.20 EUR (GPT-4o)
- **Pexels**: Gratuit
- **Total**: ~0.60-1.70 EUR/video

## Licence

MIT

## Auteur

Toulouse790
