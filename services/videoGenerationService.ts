/**
 * Video Generation Service
 * Generates complete videos using AI (script, images, voiceover)
 * PRODUCTION VERSION - Uses real APIs
 * 
 * Supports:
 * - Shotstack (cloud, fast, high quality) - if configured
 * - Browser Canvas (fallback, slower)
 */

import { GoogleGenAI } from '@google/genai';
import { CalendarItem, Channel } from '../types';
import { generateSceneMedia } from './mediaService';
import { generateVoiceover, isElevenLabsAvailable } from './audioService';
import { assembleVideo, generateThumbnail as createThumbnail } from './videoAssemblyService';
import { isShotstackAvailable, generateVideoWithShotstack, uploadAudioForShotstack } from './shotstackService';

// Get API key
const getApiKey = (): string => {
  const key = import.meta.env.VITE_API_KEY;
  if (!key) {
    throw new Error('VITE_API_KEY not configured');
  }
  return key;
};

// Download video from URL to Blob
const downloadVideoBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  return response.blob();
};

export interface GeneratedVideo {
  id: string;
  contentItem: CalendarItem;
  script: string;
  scenes: GeneratedScene[];
  voiceoverBlob?: Blob;
  thumbnailBlob?: Blob;
  videoBlob?: Blob;
  voiceoverUrl?: string;
  thumbnailUrl?: string;
  finalVideoUrl?: string;
  status: 'pending' | 'generating-script' | 'generating-images' | 'generating-audio' | 'assembling' | 'ready' | 'error';
  progress: number;
  error?: string;
}

export interface GeneratedScene {
  id: number;
  text: string;
  imagePrompt: string;
  imageUrl?: string;
  videoUrl?: string;
  duration: number; // seconds
}

export interface GenerationProgress {
  stage: string;
  progress: number;
  message: string;
}

type ProgressCallback = (progress: GenerationProgress) => void;

/**
 * Generate a complete video from a content item
 */
export const generateVideo = async (
  contentItem: CalendarItem,
  channel: Channel,
  onProgress?: ProgressCallback
): Promise<GeneratedVideo> => {
  const video: GeneratedVideo = {
    id: `video_${Date.now()}`,
    contentItem,
    script: '',
    scenes: [],
    status: 'pending',
    progress: 0
  };

  try {
    // Step 1: Generate Script
    onProgress?.({ stage: 'script', progress: 5, message: 'Génération du script...' });
    video.status = 'generating-script';
    video.script = await generateScript(contentItem, channel);
    video.progress = 15;

    // Step 2: Parse script into scenes
    onProgress?.({ stage: 'scenes', progress: 18, message: 'Découpage en scènes...' });
    video.scenes = parseScriptToScenes(video.script);
    
    // Log durée estimée
    const totalDuration = video.scenes.reduce((acc, s) => acc + s.duration, 0);
    const minutes = Math.floor(totalDuration / 60);
    const seconds = totalDuration % 60;
    console.log(`📊 Durée vidéo estimée: ${minutes}:${seconds.toString().padStart(2, '0')} (${video.scenes.length} scènes)`);
    onProgress?.({ stage: 'scenes', progress: 19, message: `${video.scenes.length} scènes (~${minutes}:${seconds.toString().padStart(2, '0')})` });
    video.progress = 20;

    // Step 3: Generate image prompts for each scene
    onProgress?.({ stage: 'prompts', progress: 22, message: 'Création des prompts visuels...' });
    video.scenes = await generateImagePrompts(video.scenes, channel);
    video.progress = 25;

    // Step 4: Fetch real images/videos from Pexels
    onProgress?.({ stage: 'images', progress: 28, message: 'Recherche des médias sur Pexels...' });
    video.status = 'generating-images';
    video.scenes = await generateSceneImages(video.scenes, (p, m) => {
      onProgress?.({ stage: 'images', progress: 28 + (p * 0.22), message: m });
    });
    video.progress = 50;

    // Step 5: Generate voiceover - TEXTE COMPLET POUR ELEVENLABS
    onProgress?.({ stage: 'audio', progress: 52, message: `Génération voix off (${isElevenLabsAvailable() ? 'ElevenLabs' : 'Navigateur'})...` });
    video.status = 'generating-audio';
    
    // Concaténer TOUT le texte des scènes pour la narration complète
    const voiceText = video.scenes.map(s => s.text).join('\n\n');
    const wordCount = voiceText.split(/\s+/).length;
    const charCount = voiceText.length;
    console.log(`🎤 Texte pour ElevenLabs: ${wordCount} mots, ${charCount} caractères`);
    console.log(`📖 Aperçu du texte:\n${voiceText.substring(0, 500)}...`);
    
    video.voiceoverBlob = await generateVoiceover(voiceText, (p, m) => {
      onProgress?.({ stage: 'audio', progress: 52 + (p * 0.15), message: m });
    });
    video.voiceoverUrl = URL.createObjectURL(video.voiceoverBlob);
    video.progress = 67;

    // Step 6: Generate thumbnail
    onProgress?.({ stage: 'thumbnail', progress: 68, message: 'Création de la miniature...' });
    const thumbnailImageUrl = video.scenes[0]?.imageUrl || '';
    video.thumbnailBlob = await createThumbnail(thumbnailImageUrl, contentItem.title);
    video.thumbnailUrl = URL.createObjectURL(video.thumbnailBlob);
    video.progress = 70;

    // Step 7: Assemble final video
    video.status = 'assembling';
    
    // Try Shotstack for fast cloud rendering, but fallback to browser if audio upload fails
    let useShotstack = isShotstackAvailable();
    let audioUrl: string | null = null;
    
    if (useShotstack && video.voiceoverBlob) {
      onProgress?.({ stage: 'assembly', progress: 72, message: 'Tentative upload audio pour Shotstack...' });
      audioUrl = await uploadAudioForShotstack(video.voiceoverBlob);
      
      if (!audioUrl) {
        console.warn('⚠️ Audio upload failed - using browser assembly to preserve audio');
        onProgress?.({ stage: 'assembly', progress: 73, message: '⚠️ Upload audio échoué, utilisation assemblage navigateur...' });
        useShotstack = false; // Force browser assembly to keep audio
      }
    }
    
    if (useShotstack) {
      onProgress?.({ stage: 'assembly', progress: 74, message: '⚡ Rendu cloud Shotstack (ultra-rapide)...' });
      
      try {
        // Prepare media for Shotstack
        const shotstackScenes = video.scenes.map(s => ({
          imageUrl: s.imageUrl || '',
          videoUrl: s.videoUrl || '', // Passer les vidéos Pexels à Shotstack
          text: s.text,
          duration: s.duration
        }));
        
        // Generate video with Shotstack
        const result = await generateVideoWithShotstack(
          shotstackScenes,
          audioUrl || undefined,
          (progress, message) => {
            onProgress?.({ 
              stage: 'assembly', 
              progress: 74 + (progress * 0.20), 
              message: `Shotstack: ${message}` 
            });
          }
        );
        
        if ('error' in result) {
          throw new Error(result.error);
        }
        
        onProgress?.({ stage: 'assembly', progress: 95, message: 'Téléchargement de la vidéo HD...' });
        video.videoBlob = await downloadVideoBlob(result.videoUrl);
        video.finalVideoUrl = URL.createObjectURL(video.videoBlob);
        video.progress = 97;
        
      } catch (shotstackError) {
        console.warn('Shotstack failed, falling back to browser assembly:', shotstackError);
        onProgress?.({ stage: 'assembly', progress: 72, message: 'Fallback: assemblage navigateur...' });
        
        // Fallback to browser assembly
        const videoScenes = video.scenes.map(s => ({
          imageUrl: s.imageUrl || '',
          videoUrl: s.videoUrl,
          text: s.text,
          duration: s.duration
        }));
        video.videoBlob = await assembleVideo(videoScenes, video.voiceoverBlob, {}, (p, m) => {
          onProgress?.({ stage: 'assembly', progress: 72 + (p * 0.25), message: m });
        });
        video.finalVideoUrl = URL.createObjectURL(video.videoBlob);
        video.progress = 97;
      }
    } else {
      // Browser-based assembly (slower but works without API key)
      onProgress?.({ stage: 'assembly', progress: 72, message: 'Assemblage navigateur (ajoutez SHOTSTACK pour accélérer)...' });
      
      const videoScenes = video.scenes.map(s => ({
        imageUrl: s.imageUrl || '',
        videoUrl: s.videoUrl,
        text: s.text,
        duration: s.duration
      }));
      video.videoBlob = await assembleVideo(videoScenes, video.voiceoverBlob, {}, (p, m) => {
        onProgress?.({ stage: 'assembly', progress: 72 + (p * 0.25), message: m });
      });
      video.finalVideoUrl = URL.createObjectURL(video.videoBlob);
      video.progress = 97;
    }

    // Step 8: Complete
    onProgress?.({ stage: 'complete', progress: 100, message: 'Vidéo prête à publier !' });
    video.status = 'ready';
    video.progress = 100;

    return video;

  } catch (error) {
    video.status = 'error';
    video.error = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('Video generation error:', error);
    throw error;
  }
};

/**
 * Generate a detailed script for the video - VERSION DÉFINITIVE
 * Adapté aux chaînes: Dossiers Classifiés, Et Si..., L'Odyssée Humaine
 */
async function generateScript(item: CalendarItem, channel: Channel): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  // Déterminer le style selon la chaîne
  const channelStyle = getChannelStyle(channel.name, channel.theme);
  
  const prompt = `Tu es un SCÉNARISTE DE DOCUMENTAIRES CINÉMATOGRAPHIQUES pour YouTube.
Tu crées des scripts pour des vidéos style "documentaire 3D" à forte rétention.

CHAÎNE: ${channel.name}
THÈME: ${channel.theme}
TITRE: ${item.title}
SUJET: ${item.description}

${channelStyle.instructions}

=== RÈGLES D'OR ===

**1. LA RÈGLE DES 4 SECONDES:**
Tu n'as que 4 secondes pour captiver. La première phrase décide TOUT.
INTERDIT: "Bonjour à tous", "Bienvenue", "Aujourd'hui on va parler de..."
Le spectateur doit être HAPPÉ immédiatement.

**2. NARRATION CINÉMATOGRAPHIQUE:**
- Écris comme un FILM, pas comme un article
- Crée des IMAGES MENTALES puissantes
- Utilise le PRÉSENT pour l'immersion: "Il est 3h du matin. Les rues sont désertes..."
- Fais RESSENTIR les émotions, pas juste les décrire

**3. TECHNIQUE QPC (Quoi-Pourquoi-Comment):**
- QUOI: Le sujet captivant
- POURQUOI: L'enjeu, ce qu'on risque de manquer
- COMMENT: La promesse de ce qu'on va découvrir

**4. ARC NARRATIF EN 6 ACTES:**
Acte 1: ACCROCHE → Captiver en 4 secondes
Acte 2: CONTEXTE → Poser le décor, créer l'atmosphère
Acte 3: RÉVÉLATION 1 → Première info surprenante
Acte 4: TENSION → Monter les enjeux
Acte 5: CLIMAX → La révélation ultime
Acte 6: CONCLUSION → Message mémorable

=== STRUCTURE DU SCRIPT ===

**PARAGRAPHE 1 - ACCROCHE CINÉMATOGRAPHIQUE (80 mots):**
${channelStyle.hookStyle}
Phrase 1-2: Accroche IMPOSSIBLE à ignorer (statistique choc, question brûlante, scène immersive)
Phrase 3-4: Contexte rapide - POURQUOI c'est fascinant
Phrase 5-6: Promesse - Ce que le spectateur va découvrir
Le spectateur doit penser: "Il FAUT que je voie ça."

**PARAGRAPHE 2 - IMMERSION DANS LE CONTEXTE (100 mots):**
${channelStyle.contextStyle}
Crée une ATMOSPHÈRE. Fais voyager le spectateur.
Utilise des détails SENSORIELS: sons, images, ambiances.
Pose les bases de l'histoire avec des faits captivants.
Termine par une transition vers la première révélation.

**PARAGRAPHE 3 - PREMIÈRE RÉVÉLATION (100 mots):**
${channelStyle.revelationStyle}
Livre une information SURPRENANTE.
"Ce que peu de gens savent..."
Utilise des exemples CONCRETS et visuels.
Crée un micro-cliffhanger: "Mais ce n'était que le début..."

**PARAGRAPHE 4 - MONTÉE DRAMATIQUE (100 mots):**
${channelStyle.tensionStyle}
Intensifie la tension. "Et c'est là que tout bascule..."
Deuxième révélation, encore plus forte.
Connexions inattendues, retournements.
Le spectateur sent qu'il approche de LA vérité.

**PARAGRAPHE 5 - CLIMAX / RÉVÉLATION ULTIME (100 mots):**
${channelStyle.climaxStyle}
Le moment "MIND-BLOWN".
LA révélation qui change tout.
Le spectateur a sa prise de conscience.
Information la plus précieuse de la vidéo.

**PARAGRAPHE 6 - CONCLUSION MÉMORABLE (80 mots):**
${channelStyle.conclusionStyle}
Synthèse percutante en 2-3 phrases.
Message qui reste en tête.
Question ouverte pour les commentaires.
Dernière phrase = celle qu'on retient.

=== STYLE D'ÉCRITURE CINÉMATOGRAPHIQUE ===
- Phrases COURTES et PERCUTANTES (max 15 mots)
- Rythme DYNAMIQUE: alterne punch et respiration
- Utilise le PRÉSENT pour l'immersion
- Descriptions VISUELLES: le spectateur doit VOIR la scène
- Ponctuation EXPRESSIVE: ... pour le suspense, ! pour l'impact
- Transitions FLUIDES: "Mais attendez...", "Et c'est là que..."
- JAMAIS de phrases plates ou académiques

=== TECHNIQUE AUDIO ===
- Ce texte sera lu par ElevenLabs (voix off dramatique)
- Phrases faciles à lire à voix haute
- Pauses naturelles entre les idées (. ou ...)
- Rythme qui permet la respiration
- Mots forts en fin de phrase pour l'impact

=== IMPORTANT ===
- Sépare CHAQUE paragraphe par UNE LIGNE VIDE
- Total: ~560 mots (~4 minutes de narration)
- Le spectateur doit être CAPTIVÉ du début à la fin
- Style UNIQUE, pas générique - comme les grandes chaînes documentaires

Génère maintenant le script CINÉMATOGRAPHIQUE en français:

`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt
  });

  const script = response.text || '';
  
  // Log word count for debug
  const wordCount = script.split(/\s+/).length;
  console.log(`📝 Script généré: ${wordCount} mots`);
  
  return script;
}

/**
 * Get channel-specific style instructions
 */
function getChannelStyle(channelName: string, theme: string): {
  instructions: string;
  hookStyle: string;
  contextStyle: string;
  revelationStyle: string;
  tensionStyle: string;
  climaxStyle: string;
  conclusionStyle: string;
} {
  const lowerName = channelName.toLowerCase();
  const lowerTheme = theme.toLowerCase();
  
  // DOSSIERS CLASSIFIÉS - Mystères, enquêtes, secrets
  if (lowerName.includes('dossier') || lowerName.includes('classif') || 
      lowerTheme.includes('mystère') || lowerTheme.includes('secret') || lowerTheme.includes('enquête')) {
    return {
      instructions: `=== STYLE "DOSSIERS CLASSIFIÉS" ===
Ton: MYSTÉRIEUX, INTRIGANT, SUSPENSE
Ambiance: Enquête, secrets révélés, vérités cachées
Vocabulaire: "classifié", "révélé", "dissimulé", "la vérité sur...", "ce qu'on ne vous dit pas"
Émotion: Curiosité, tension, révélation`,
      hookStyle: `Style ENQUÊTE/MYSTÈRE:
"Cette histoire a été classifiée pendant 50 ans. Aujourd'hui, les archives s'ouvrent enfin..."
"Ce que vous allez découvrir a été caché au public pendant des décennies..."
"Il y a des vérités qu'on préfère garder dans l'ombre. Celle-ci en fait partie..."`,
      contextStyle: `Pose l'atmosphère d'une ENQUÊTE:
Détails sur le contexte historique, les acteurs impliqués.
Crée un sentiment de mystère et d'intrigue.
"Dans les coulisses du pouvoir...", "Derrière les portes closes..."`,
      revelationStyle: `Révèle comme un ENQUÊTEUR:
"Les documents déclassifiés révèlent que..."
"Ce que les archives montrent est troublant..."
Indices, preuves, témoignages qui s'accumulent.`,
      tensionStyle: `Monte la tension comme un THRILLER:
"Mais l'affaire prend un tournant inattendu..."
"C'est là que les choses deviennent vraiment étranges..."
Retournements, zones d'ombre, questions sans réponse.`,
      climaxStyle: `La RÉVÉLATION finale:
"La vérité, c'est que..."
"Ce que personne n'avait compris jusqu'ici..."
Le voile se lève sur le mystère.`,
      conclusionStyle: `Conclusion MYSTÉRIEUSE:
"Cette affaire soulève une question troublante..."
"Et vous, que pensez-vous vraiment de cette histoire ?"
Laisse planer un dernier doute ou une réflexion.`
    };
  }
  
  // ET SI... - Scénarios hypothétiques, uchronies
  if (lowerName.includes('et si') || lowerTheme.includes('hypothè') || 
      lowerTheme.includes('scenario') || lowerTheme.includes('uchronie')) {
    return {
      instructions: `=== STYLE "ET SI..." ===
Ton: SPÉCULATIF, FASCINANT, VERTIGINEUX
Ambiance: Exploration de possibilités, réalités alternatives
Vocabulaire: "imaginez", "et si", "dans ce scénario", "les conséquences seraient..."
Émotion: Émerveillement, vertige, fascination`,
      hookStyle: `Style HYPOTHÉTIQUE/VERTIGINEUX:
"Et si tout ce que vous pensiez savoir était faux ?"
"Imaginez un monde où [scénario]. Les conséquences seraient vertigineuses..."
"Cette simple question va bouleverser votre vision de [sujet]..."`,
      contextStyle: `Pose le SCÉNARIO HYPOTHÉTIQUE:
Explique les conditions de départ.
"Pour comprendre, il faut d'abord imaginer que..."
Crée un cadre mental fascinant.`,
      revelationStyle: `Explore les CONSÉQUENCES:
"La première conséquence serait stupéfiante..."
"Ce que la science nous dit, c'est que..."
Faits scientifiques + extrapolations logiques.`,
      tensionStyle: `AMPLIFIE le scénario:
"Mais ce n'est que le début. Les effets en cascade seraient..."
"Et si on pousse le raisonnement encore plus loin..."
Chaque révélation en amène une plus grande.`,
      climaxStyle: `La RÉALISATION vertigineuse:
"Et c'est là qu'on comprend l'ampleur de..."
"La conclusion est à la fois fascinante et terrifiante..."
Le "mind-blown" moment.`,
      conclusionStyle: `Conclusion OUVERTE:
"Ce scénario nous force à reconsidérer..."
"Et vous, comment réagiriez-vous si demain... ?"
Invite à la réflexion et au débat.`
    };
  }
  
  // L'ODYSSÉE HUMAINE - Histoire, civilisations, explorations
  if (lowerName.includes('odyssée') || lowerName.includes('humaine') || 
      lowerTheme.includes('histoire') || lowerTheme.includes('civilis') || lowerTheme.includes('explor')) {
    return {
      instructions: `=== STYLE "L'ODYSSÉE HUMAINE" ===
Ton: ÉPIQUE, INSPIRANT, GRANDIOSE
Ambiance: Voyage à travers le temps, grandeur de l'humanité
Vocabulaire: "nos ancêtres", "l'humanité", "à travers les âges", "l'épopée de..."
Émotion: Émerveillement, fierté, connexion avec le passé`,
      hookStyle: `Style ÉPIQUE/HISTORIQUE:
"Il y a [X] ans, l'humanité a accompli l'impossible..."
"Cette découverte a changé le cours de l'histoire humaine à jamais..."
"Au cœur de [lieu], une civilisation a bâti quelque chose d'extraordinaire..."`,
      contextStyle: `TRANSPORTE dans l'époque:
Descriptions immersives du lieu et de l'époque.
"Imaginez-vous en [année], dans [lieu]..."
Détails sensoriels: sons, odeurs, ambiances.`,
      revelationStyle: `Révèle la GRANDEUR:
"Ce que les archéologues ont découvert dépasse l'imagination..."
"Nos ancêtres avaient compris quelque chose que nous avons oublié..."
Faits historiques fascinants.`,
      tensionStyle: `Monte vers l'APOGÉE:
"Mais le plus extraordinaire restait à venir..."
"C'est à ce moment que [civilisation/personnage] a accompli..."
Progression vers le climax historique.`,
      climaxStyle: `Le moment LÉGENDAIRE:
"Et c'est ainsi que l'humanité a prouvé..."
"Ce qui s'est passé ce jour-là reste gravé dans l'histoire..."
L'accomplissement ultime.`,
      conclusionStyle: `Conclusion INSPIRANTE:
"Cette histoire nous rappelle que l'humanité..."
"Et vous, quel héritage souhaitez-vous laisser ?"
Message universel et intemporel.`
    };
  }
  
  // STYLE PAR DÉFAUT - Documentaire générique
  return {
    instructions: `=== STYLE DOCUMENTAIRE CINÉMATOGRAPHIQUE ===
Ton: CAPTIVANT, INFORMATIF, ENGAGEANT
Ambiance: Découverte, exploration, révélation
Vocabulaire: varié, précis, évocateur
Émotion: Curiosité, fascination, compréhension`,
    hookStyle: `Style ACCROCHE UNIVERSELLE:
Statistique choc, question brûlante, ou scène immersive.
"Ce que vous allez découvrir va changer votre perspective..."`,
    contextStyle: `Pose le DÉCOR avec immersion:
Contexte clair, détails captivants.
Crée une atmosphère engageante.`,
    revelationStyle: `SURPRENDS avec des faits:
Informations inattendues, exemples concrets.
"Ce que peu de gens savent..."`,
    tensionStyle: `INTENSIFIE progressivement:
Montée en puissance des révélations.
Connexions surprenantes.`,
    climaxStyle: `Le POINT CULMINANT:
La révélation la plus importante.
Le moment de prise de conscience.`,
    conclusionStyle: `Conclusion MÉMORABLE:
Synthèse percutante.
Question ouverte pour l'engagement.`
  };
}

/**
 * Parse script into individual scenes - NARRATION DÉTAILLÉE
 */
function parseScriptToScenes(script: string): GeneratedScene[] {
  // Split by paragraphs or scene indicators
  const paragraphs = script.split(/\n\n+/).filter(p => p.trim().length > 30);
  
  // 6 scènes avec narration complète (~560 mots = ~4 min)
  // Durée moyenne de lecture vocale: ~150 mots/minute = 2.5 mots/seconde
  return paragraphs.slice(0, 6).map((text, index) => {
    const wordCount = text.split(/\s+/).length;
    // Durée basée sur la lecture vocale: 150 mots/min = 2.5 mots/sec
    // Minimum 10 secondes par scène pour les paragraphes détaillés
    const estimatedDuration = Math.max(10, Math.ceil(wordCount / 2.5));
    
    console.log(`📖 Scène ${index + 1}: ${wordCount} mots → ${estimatedDuration}s`);
    
    return {
      id: index + 1,
      text: text.trim(),
      imagePrompt: '',
      duration: estimatedDuration
    };
  });
}

/**
 * Generate search keywords for each scene (optimized for Pexels video search)
 */
async function generateImagePrompts(scenes: GeneratedScene[], channel: Channel): Promise<GeneratedScene[]> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const sceneTexts = scenes.map((s, i) => `Scène ${i + 1}: ${s.text.substring(0, 300)}`).join('\n\n');
  
  const prompt = `Tu es expert en recherche de stock footage sur Pexels. Pour chaque scène, génère des TERMES DE RECHERCHE PEXELS en anglais.

CHAÎNE: "${channel.name}"
THÈME: ${channel.theme}

SCÈNES:
${sceneTexts}

RÈGLES CRITIQUES:
1. Génère 1-2 termes CONCRETS par scène (pas de mots-clés séparés)
2. Les termes doivent correspondre à ce qui EXISTE SUR PEXELS
3. EXEMPLES QUI FONCTIONNENT:
   - "ocean waves drone" (pour la mer)
   - "ancient temple ruins" (pour l'histoire)
   - "night city lights" (pour ville)
   - "forest fog mystery" (pour forêt)
   - "storm clouds dramatic" (pour tempête)
   - "space stars galaxy" (pour espace)
   - "fire flames burning" (pour feu)
   - "crowd people walking" (pour foule)
   - "desert sand dunes" (pour désert)
   - "mountain snow peaks" (pour montagne)
   - "laboratory science" (pour science)
   - "war military soldiers" (pour guerre)

4. ÉVITE ABSOLUMENT:
   - Mots abstraits: mystery, secret, revelation, amazing, incredible
   - Noms propres: Triangle des Bermudes, Atlantis, etc.
   - Concepts: théorie, explication, découverte

Réponds UNIQUEMENT avec ce JSON (rien d'autre):
[
  {"scene": 1, "keywords": "ocean waves storm"},
  {"scene": 2, "keywords": "ancient ruins temple"}
]`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt
  });

  try {
    const text = response.text || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const prompts = JSON.parse(jsonMatch[0]);
      return scenes.map((scene, i) => ({
        ...scene,
        imagePrompt: prompts[i]?.keywords || prompts[i]?.prompt || `documentary footage`
      }));
    }
  } catch (e) {
    console.warn('Failed to parse search keywords, using scene text');
  }

  // Fallback: utiliser le texte de la scène directement
  return scenes.map(scene => ({
    ...scene,
    imagePrompt: scene.text.substring(0, 100)
  }));
}

/**
 * Generate images for scenes using Pexels API
 */
async function generateSceneImages(
  scenes: GeneratedScene[], 
  onProgress?: (progress: number, message: string) => void
): Promise<GeneratedScene[]> {
  const mediaResults = await generateSceneMedia(scenes, onProgress);
  
  return scenes.map((scene, index) => {
    const media = mediaResults.find(m => m.sceneId === scene.id) || mediaResults[index];
    return {
      ...scene,
      imageUrl: media?.imageUrl || '',
      videoUrl: media?.videoUrl || ''
    };
  });
}

/**
 * Get video generation status summary
 */
export const getGenerationStatusText = (status: GeneratedVideo['status']): string => {
  const statusMap: Record<GeneratedVideo['status'], string> = {
    'pending': 'En attente',
    'generating-script': 'Génération du script...',
    'generating-images': 'Recherche médias Pexels...',
    'generating-audio': 'Synthèse vocale...',
    'assembling': 'Assemblage vidéo...',
    'ready': 'Prêt à publier',
    'error': 'Erreur'
  };
  return statusMap[status] || status;
};

/**
 * Export video data for external processing (if needed)
 */
export const exportVideoData = (video: GeneratedVideo): object => {
  return {
    title: video.contentItem.title,
    description: video.contentItem.description,
    script: video.script,
    scenes: video.scenes.map(s => ({
      text: s.text,
      imagePrompt: s.imagePrompt,
      imageUrl: s.imageUrl,
      videoUrl: s.videoUrl,
      duration: s.duration
    })),
    hasVideo: !!video.videoBlob,
    hasThumbnail: !!video.thumbnailBlob,
    hasVoiceover: !!video.voiceoverBlob
  };
};

/**
 * Download the generated video
 */
export const downloadGeneratedVideo = (video: GeneratedVideo): void => {
  if (!video.videoBlob) {
    throw new Error('No video available to download');
  }
  
  const url = URL.createObjectURL(video.videoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${video.contentItem.title.replace(/[^a-zA-Z0-9]/g, '_')}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Get the video file for YouTube upload
 */
export const getVideoFile = (video: GeneratedVideo): File | null => {
  if (!video.videoBlob) return null;
  
  return new File(
    [video.videoBlob], 
    `${video.contentItem.title.replace(/[^a-zA-Z0-9]/g, '_')}.webm`,
    { type: 'video/webm' }
  );
};

/**
 * Get the thumbnail file for YouTube upload
 */
export const getThumbnailFile = (video: GeneratedVideo): File | null => {
  if (!video.thumbnailBlob) return null;
  
  return new File(
    [video.thumbnailBlob],
    `thumbnail_${video.id}.jpg`,
    { type: 'image/jpeg' }
  );
};
