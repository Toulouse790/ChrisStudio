/**
 * Video Assembly Service - Assemblage des médias en vidéo finale
 * Version optimisée pour QUALITÉ MAXIMALE
 */

interface VideoScene {
  imageUrl: string;
  videoUrl?: string;
  text: string;
  duration: number; // en secondes
}

interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  backgroundColor: string;
  textColor: string;
  textFont: string;
  showSubtitles: boolean;
}

// Configuration HAUTE QUALITÉ pour YouTube
const DEFAULT_CONFIG: VideoConfig = {
  width: 1920,   // Full HD
  height: 1080,
  fps: 24,       // Cinématique
  backgroundColor: '#000000',
  textColor: '#ffffff',
  textFont: '42px "Segoe UI", Arial, sans-serif',
  showSubtitles: true
};

/**
 * Charge une image et retourne un HTMLImageElement
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Dessine des sous-titres style cinématique professionnel
 */
function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  canvasWidth: number,
  canvasHeight: number,
  config: VideoConfig
) {
  const padding = 24;
  const lineHeight = 56;
  const maxWidth = canvasWidth - 200; // Marges latérales généreuses
  
  // Limiter le texte affiché (2 phrases max pour lisibilité)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const displayText = sentences.slice(0, 2).join(' ').trim();
  if (displayText.length < 10) return; // Pas de sous-titre trop court
  
  ctx.font = config.textFont;
  
  // Diviser en lignes
  const words = displayText.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= 2) break; // Max 2 lignes
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < 2) lines.push(currentLine);
  
  // Position en bas
  const boxHeight = lines.length * lineHeight + padding * 2;
  const boxY = canvasHeight - boxHeight - 60;
  
  // Fond avec dégradé et coins arrondis
  ctx.save();
  
  // Ombre portée
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;
  
  // Rectangle arrondi
  const boxX = 80;
  const boxWidth = canvasWidth - 160;
  const radius = 12;
  
  ctx.beginPath();
  ctx.moveTo(boxX + radius, boxY);
  ctx.lineTo(boxX + boxWidth - radius, boxY);
  ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
  ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
  ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);
  ctx.lineTo(boxX + radius, boxY + boxHeight);
  ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
  ctx.lineTo(boxX, boxY + radius);
  ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
  ctx.closePath();
  
  // Dégradé de fond
  const gradient = ctx.createLinearGradient(0, boxY, 0, boxY + boxHeight);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  gradient.addColorStop(1, 'rgba(20, 20, 40, 0.9)');
  ctx.fillStyle = gradient;
  ctx.fill();
  
  ctx.restore();
  
  // Texte avec ombre
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  lines.forEach((line, i) => {
    const y = boxY + padding + (i + 0.5) * lineHeight;
    ctx.fillText(line, canvasWidth / 2, y);
  });
  
  ctx.restore();
}

/**
 * Dessine une image sur le canvas en mode cover
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number
) {
  const imgRatio = img.width / img.height;
  const canvasRatio = canvasWidth / canvasHeight;
  
  let drawWidth, drawHeight, offsetX, offsetY;
  
  if (imgRatio > canvasRatio) {
    drawHeight = canvasHeight;
    drawWidth = canvasHeight * imgRatio;
    offsetX = -(drawWidth - canvasWidth) / 2;
    offsetY = 0;
  } else {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imgRatio;
    offsetX = 0;
    offsetY = -(drawHeight - canvasHeight) / 2;
  }
  
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

/**
 * Assemble les scènes en une vidéo AVEC AUDIO
 * L'audio est mixé directement dans le flux vidéo
 */
export async function assembleVideo(
  scenes: VideoScene[],
  audioBlob: Blob | null,
  config: Partial<VideoConfig> = {},
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  onProgress?.(5, 'Préparation du canvas vidéo...');
  
  // Créer le canvas
  const canvas = document.createElement('canvas');
  canvas.width = fullConfig.width;
  canvas.height = fullConfig.height;
  const ctx = canvas.getContext('2d')!;
  
  // Précharger toutes les images EN PARALLÈLE (plus rapide)
  onProgress?.(10, 'Chargement des images...');
  const imagePromises = scenes.map(async (scene, i) => {
    try {
      return await loadImage(scene.imageUrl);
    } catch {
      // Image de fallback
      const fallback = document.createElement('canvas');
      fallback.width = fullConfig.width;
      fallback.height = fullConfig.height;
      const fctx = fallback.getContext('2d')!;
      fctx.fillStyle = '#1a1a2e';
      fctx.fillRect(0, 0, fallback.width, fallback.height);
      fctx.fillStyle = '#ffffff';
      fctx.font = 'bold 48px Arial';
      fctx.textAlign = 'center';
      fctx.fillText(`Scène ${i + 1}`, fullConfig.width / 2, fullConfig.height / 2);
      const img = new Image();
      img.src = fallback.toDataURL();
      await new Promise(r => img.onload = r);
      return img;
    }
  });
  
  const images = await Promise.all(imagePromises);
  onProgress?.(30, `${images.length} images chargées`);
  
  // Préparer l'audio si disponible
  let audioElement: HTMLAudioElement | null = null;
  let audioContext: AudioContext | null = null;
  let audioSource: MediaElementAudioSourceNode | null = null;
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  
  if (audioBlob && audioBlob.size > 1000) {
    try {
      onProgress?.(32, 'Préparation de l\'audio...');
      audioElement = new Audio();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioElement.src = audioUrl;
      audioElement.preload = 'auto';
      
      // Attendre que l'audio soit VRAIMENT chargé avec sa durée
      await new Promise<void>((resolve, reject) => {
        const checkDuration = () => {
          if (audioElement!.duration && !isNaN(audioElement!.duration) && audioElement!.duration > 0) {
            console.log('🔊 Audio chargé, durée:', audioElement!.duration, 's');
            resolve();
          }
        };
        
        audioElement!.onloadedmetadata = checkDuration;
        audioElement!.oncanplaythrough = checkDuration;
        audioElement!.ondurationchange = checkDuration;
        audioElement!.onerror = () => reject(new Error('Audio load failed'));
        
        // Vérifier immédiatement au cas où
        checkDuration();
        
        // Timeout avec fallback
        setTimeout(() => {
          if (!audioElement!.duration || isNaN(audioElement!.duration)) {
            console.warn('⚠️ Audio duration timeout, continuant sans audio');
            reject(new Error('Audio duration timeout'));
          } else {
            resolve();
          }
        }, 5000);
      });
      
      audioContext = new AudioContext();
      audioSource = audioContext.createMediaElementSource(audioElement);
      audioDestination = audioContext.createMediaStreamDestination();
      audioSource.connect(audioDestination);
      
      console.log('🔊 Audio préparé pour le mixage, durée:', audioElement.duration, 's');
    } catch (e) {
      console.warn('⚠️ Impossible de préparer l\'audio:', e);
      audioElement = null;
      audioContext = null;
      audioSource = null;
      audioDestination = null;
    }
  }
  
  // Configurer MediaRecorder avec vidéo ET audio
  const videoStream = canvas.captureStream(fullConfig.fps);
  
  // Combiner vidéo et audio dans un seul stream
  let combinedStream: MediaStream;
  if (audioDestination) {
    const audioTracks = audioDestination.stream.getAudioTracks();
    combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioTracks
    ]);
    console.log('🎬 Stream combiné: vidéo + audio');
  } else {
    combinedStream = videoStream;
    console.log('🎬 Stream vidéo seul (pas d\'audio)');
  }
  
  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: 'video/webm;codecs=vp9,opus', // VP9 vidéo + Opus audio
    videoBitsPerSecond: 12000000, // 12 Mbps vidéo
    audioBitsPerSecond: 128000   // 128 kbps audio
  });
  
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  
  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = async () => {
      // Cleanup audio
      if (audioElement) {
        audioElement.pause();
        URL.revokeObjectURL(audioElement.src);
      }
      if (audioContext) {
        await audioContext.close();
      }
      
      const videoBlob = new Blob(chunks, { type: 'video/webm' });
      console.log('✅ Vidéo assemblée:', (videoBlob.size / 1024 / 1024).toFixed(2), 'MB');
      onProgress?.(100, 'Vidéo HD avec audio créée !');
      resolve(videoBlob);
    };
    
    mediaRecorder.onerror = (e) => {
      console.error('❌ MediaRecorder error:', e);
      reject(e);
    };
    
    mediaRecorder.start(1000);
    
    // Démarrer l'audio en même temps que l'enregistrement
    if (audioElement) {
      audioElement.currentTime = 0;
      audioElement.play().catch(e => console.warn('Audio play failed:', e));
    }
    
    let sceneIndex = 0;
    let sceneStartTime = Date.now();
    
    // Fonction pour dessiner une scène avec effet Ken Burns
    const drawScene = (index: number, progress: number = 0) => {
      ctx.fillStyle = fullConfig.backgroundColor;
      ctx.fillRect(0, 0, fullConfig.width, fullConfig.height);
      
      if (images[index]) {
        // Effet Ken Burns - zoom progressif
        const scale = 1.0 + (progress * 0.15); // Zoom de 1.0 à 1.15
        const img = images[index];
        
        ctx.save();
        ctx.translate(fullConfig.width / 2, fullConfig.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-fullConfig.width / 2, -fullConfig.height / 2);
        drawImageCover(ctx, img, fullConfig.width, fullConfig.height);
        ctx.restore();
      }
      
      if (fullConfig.showSubtitles && scenes[index]?.text) {
        drawSubtitle(ctx, scenes[index].text, fullConfig.width, fullConfig.height, fullConfig);
      }
    };
    
    // Dessiner la première frame
    drawScene(0, 0);
    onProgress?.(35, `Scène 1/${scenes.length}...`);
    
    // Animation fluide avec requestAnimationFrame
    const animate = () => {
      const now = Date.now();
      const sceneElapsed = (now - sceneStartTime) / 1000;
      const currentDuration = scenes[sceneIndex]?.duration || 5;
      const sceneProgress = Math.min(sceneElapsed / currentDuration, 1);
      
      // Redessiner avec progression pour Ken Burns
      drawScene(sceneIndex, sceneProgress);
      
      if (sceneElapsed >= currentDuration) {
        sceneIndex++;
        sceneStartTime = now;
        
        if (sceneIndex >= scenes.length) {
          // Attendre un peu puis arrêter
          setTimeout(() => {
            if (audioElement) audioElement.pause();
            mediaRecorder.stop();
          }, 500);
          return;
        }
        
        const progress = 35 + (sceneIndex / scenes.length) * 60;
        onProgress?.(progress, `Scène ${sceneIndex + 1}/${scenes.length}...`);
      }
      
      if (sceneIndex < scenes.length) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  });
}

/**
 * Convertit un Blob webm en données téléchargeables
 */
export function downloadVideo(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Génère une miniature YouTube OPTIMISÉE pour le CTR
 * Style: Contraste élevé, texte lisible, émotion forte
 */
export async function generateThumbnail(
  imageUrl: string,
  title: string,
  width: number = 1280,
  height: number = 720
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  // Charger l'image de fond
  try {
    const img = await loadImage(imageUrl);
    drawImageCover(ctx, img, width, height);
    
    // Augmenter le contraste et la saturation (effet "pop")
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'hsl(0, 30%, 50%)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  } catch {
    // Dégradé dramatique de fallback
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  // Vignette pour attirer l'œil au centre
  const vignetteGradient = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, width * 0.7
  );
  vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignetteGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
  vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = vignetteGradient;
  ctx.fillRect(0, 0, width, height);
  
  // Bande colorée en bas pour le texte
  const barHeight = height * 0.35;
  const barGradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
  barGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  barGradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.85)');
  barGradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
  ctx.fillStyle = barGradient;
  ctx.fillRect(0, height - barHeight, width, barHeight);
  
  // Préparer le titre (max 6-8 mots pour lisibilité)
  const titleWords = title.split(' ').slice(0, 8);
  const shortTitle = titleWords.join(' ').toUpperCase();
  
  // Configuration du texte - GROS et LISIBLE
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Wrap le titre sur 2 lignes max
  ctx.font = 'bold 64px "Arial Black", Arial, sans-serif';
  const maxWidth = width - 80;
  const words = shortTitle.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= 2) break;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < 2) lines.push(currentLine);
  
  // Dessiner le texte avec effet 3D
  const lineHeight = 75;
  const textY = height - (lines.length * lineHeight) / 2 - 40;
  
  lines.forEach((line, i) => {
    const y = textY + i * lineHeight;
    
    // Ombre profonde
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillText(line, width / 2 + 4, y + 4);
    
    // Contour coloré (accent)
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 6;
    ctx.strokeText(line, width / 2, y);
    
    // Texte principal blanc
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, width / 2, y);
  });
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
  });
}
