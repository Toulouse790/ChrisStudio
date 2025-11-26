
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import JSZip from 'jszip';
import React, {useState, useEffect, useRef} from 'react';
import {
  ArrowRightIcon,
  SparklesIcon,
  TextModeIcon,
  FilmIcon,
  ArrowPathIcon,
  ArrowDownIcon,
  ImageModeIcon,
  DownloadIcon,
  ArchiveIcon,
  CheckSquareIcon,
  SquareIcon,
  TrashIcon,
  XMarkIcon,
  CaptionsIcon,
  YoutubeIcon,
  CopyIcon,
  ExternalLinkIcon,
  SaveIcon,
  ListOrderedIcon,
  WandIcon,
  MicIcon,
  Volume2Icon,
  PlayIcon,
  MusicIcon,
  UsersIcon
} from './icons';
import {
  AppState,
  AspectRatio,
  GenerationMode,
  Project,
  Resolution,
  VeoModel,
  YouTubeMetadata,
  GeneratedAsset,
  WatermarkSettings,
  IntroOutroSettings,
  Channel,
  Template,
  MusicTrack
} from '../types';
import {generateVideo, generateVideoPlan, generateThumbnailImage, generateSpeech, enhancePrompt} from '../services/geminiService';
import { processVideoComposition } from '../services/videoService';
import LoadingIndicator from './LoadingIndicator';

interface CreatorStudioProps {
  watermarkSettings?: WatermarkSettings;
  introOutroSettings?: IntroOutroSettings;
  musicLibrary: MusicTrack[];
  channels: Channel[];
  onProjectCreated: (asset: GeneratedAsset) => void;
  initialTemplate?: Template | null;
  onSaveTemplate: (template: Template) => void;
}

const styles = [
    { id: 'cinematic', label: 'Cinématique', desc: 'Éclairage dramatique, photoréaliste' },
    { id: 'documentary', label: 'Documentaire', desc: 'Naturel, détaillé, style BBC' },
    { id: '3d_render', label: 'Animation 3D', desc: 'Style Pixar/Disney, propre' },
    { id: 'watercolor', label: 'Aquarelle', desc: 'Artistique, doux, peint à la main' },
    { id: 'vintage', label: 'Vintage / 8mm', desc: 'Grain, rétro, historique' },
    { id: 'cyberpunk', label: 'Futuriste', desc: 'Néons, tech, sombre' },
];

const voices = [
    { id: 'Puck', label: 'Puck (Masculin, Doux)' },
    { id: 'Charon', label: 'Charon (Masculin, Grave)' },
    { id: 'Kore', label: 'Kore (Féminin, Calme)' },
    { id: 'Fenrir', label: 'Fenrir (Masculin, Intense)' },
    { id: 'Zephyr', label: 'Zephyr (Féminin, Dynamique)' },
];

const CreatorStudio: React.FC<CreatorStudioProps> = ({ 
    watermarkSettings, 
    introOutroSettings, 
    musicLibrary,
    channels,
    onProjectCreated,
    initialTemplate,
    onSaveTemplate
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Final Video Composition State
  const [isComposing, setIsComposing] = useState(false);
  const [compositionProgress, setCompositionProgress] = useState('');
  const [composedVideoUrl, setComposedVideoUrl] = useState<string | null>(null);

  // Batch Export State
  const [exportQueue, setExportQueue] = useState<GeneratedAsset[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  
  // Publishing Assistant State
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Save Template Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Step 1 Inputs
  const [selectedChannelId, setSelectedChannelId] = useState<string>(channels[0]?.id || '');
  const [niche, setNiche] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false); // State for Magic Enhance
  const [format, setFormat] = useState<'shorts' | 'long-form'>('shorts');
  const [language, setLanguage] = useState<'en' | 'fr'>('fr');
  const [visualStyle, setVisualStyle] = useState<string>('cinematic');
  
  // Series/Chronology Mode
  const [isSeriesMode, setIsSeriesMode] = useState(false);
  const [episodeNumber, setEpisodeNumber] = useState<number>(1);

  // Load Template if provided
  useEffect(() => {
      if (initialTemplate) {
          setSelectedChannelId(initialTemplate.channelId);
          setNiche(initialTemplate.niche);
          setFormat(initialTemplate.format);
          setLanguage(initialTemplate.language);
          setIsSeriesMode(initialTemplate.isSeries);
          if (initialTemplate.visualStyle) setVisualStyle(initialTemplate.visualStyle);
          if (initialTemplate.isSeries) {
              setEpisodeNumber(2); // Suggest next episode
          }
          setStep(1);
      }
  }, [initialTemplate]);

  // Step 2 Data
  const [metadata, setMetadata] = useState<YouTubeMetadata | null>(null);
  const [thumbnailImage, setThumbnailImage] = useState<string | null>(null);

  // Step 3 Data
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedAudioBlob, setGeneratedAudioBlob] = useState<Blob | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('Charon');
  
  // Music Selection
  const [selectedMusicId, setSelectedMusicId] = useState<string>('');

  // Synced Playback Logic
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const [isPlayingSynced, setIsPlayingSynced] = useState(false);

  const toggleSyncedPlayback = () => {
      if (!videoRef.current) return;
      
      if (isPlayingSynced) {
          videoRef.current.pause();
          if (audioRef.current) audioRef.current.pause();
          if (musicRef.current) musicRef.current.pause();
          setIsPlayingSynced(false);
      } else {
          videoRef.current.currentTime = 0;
          if (audioRef.current) audioRef.current.currentTime = 0;
          if (musicRef.current) musicRef.current.currentTime = 0;

          videoRef.current.play();
          if (audioRef.current) audioRef.current.play();
          if (musicRef.current) {
              musicRef.current.volume = 0.3; // Background level
              musicRef.current.play();
          }
          setIsPlayingSynced(true);
      }
  };

  // Reset synced state when video ends
  useEffect(() => {
      const vid = videoRef.current;
      if (!vid) return;
      const handleEnded = () => setIsPlayingSynced(false);
      vid.addEventListener('ended', handleEnded);
      return () => vid.removeEventListener('ended', handleEnded);
  }, [generatedVideoUrl]);

  // Helper to translate errors
  const handleApiError = (err: any, defaultMsg: string) => {
      console.error(err);
      const msg = err.message || JSON.stringify(err);
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          setError("⚠️ Quota API atteint (Erreur 429). Limite de générations par minute atteinte. Veuillez patienter 1 à 2 minutes avant de réessayer.");
      } else {
          setError(`${defaultMsg}: ${msg.substring(0, 100)}...`);
      }
  };

  // --- MAGIC ENHANCE FUNCTION ---
  const handleMagicEnhance = async () => {
      if (!niche) return;
      setIsEnhancing(true);
      try {
          const selectedChannel = channels.find(c => c.id === selectedChannelId);
          const enhanced = await enhancePrompt(niche, selectedChannel?.theme);
          setNiche(enhanced);
      } catch (err) {
          console.error("Failed to enhance", err);
      } finally {
          setIsEnhancing(false);
      }
  };

  const handleGeneratePlan = async () => {
    if (!niche) return;
    setLoading(true);
    setLoadingText('Analyse de la niche et génération de la stratégie SEO...');
    setError(null);
    
    const selectedChannel = channels.find(c => c.id === selectedChannelId);
    const styleLabel = styles.find(s => s.id === visualStyle)?.label;

    try {
      const plan = await generateVideoPlan(
          niche, 
          format, 
          language, 
          selectedChannel?.name, 
          selectedChannel?.theme,
          isSeriesMode ? episodeNumber : undefined,
          styleLabel
      );
      setMetadata(plan);
      setThumbnailImage(null); // Reset thumbnail on new plan
      setGeneratedAudioUrl(null); // Reset audio
      setGeneratedAudioBlob(null);
      setStep(2);
    } catch (err: any) {
      handleApiError(err, 'Échec de la génération du plan');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateThumbnail = async () => {
      if (!metadata?.thumbnailIdea) return;
      setLoading(true);
      setLoadingText('Génération de la miniature haute résolution...');
      setError(null);
      try {
          const imageUrl = await generateThumbnailImage(metadata.thumbnailIdea);
          setThumbnailImage(imageUrl);
      } catch (err: any) {
          handleApiError(err, 'Échec de la génération de la miniature');
      } finally {
          setLoading(false);
      }
  };

  const handleGenerateAudio = async () => {
      if (!metadata?.script) return;
      setLoading(true);
      setLoadingText(`Enregistrement de la voix-off avec ${selectedVoice}...`);
      setError(null);
      try {
          // Clean script of visual cues (often in brackets or parentheses) for better TTS
          const cleanText = metadata.script.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '');
          const { blob, url } = await generateSpeech(cleanText, selectedVoice);
          setGeneratedAudioBlob(blob);
          setGeneratedAudioUrl(url);
      } catch (err: any) {
          handleApiError(err, "Échec de la génération audio");
      } finally {
          setLoading(false);
      }
  };

  const handleGenerateVideo = async () => {
    if (!metadata) return;
    setLoading(true);
    setLoadingText('Production du contenu vidéo avec Veo...');
    setError(null);
    try {
        // Use the generated visualPrompt if available, otherwise fall back to a constructed one
        const prompt = metadata.visualPrompt 
            ? metadata.visualPrompt
            : `Cinematic shot for a video about ${metadata.title}. ${metadata.thumbnailIdea}. High quality, professional lighting.`;
        
        const { objectUrl } = await generateVideo({
            prompt: prompt,
            model: VeoModel.VEO_FAST,
            aspectRatio: format === 'shorts' ? AspectRatio.PORTRAIT : AspectRatio.LANDSCAPE,
            resolution: Resolution.P720,
            mode: GenerationMode.TEXT_TO_VIDEO
        });
        setGeneratedVideoUrl(objectUrl);
        setStep(3);
    } catch (err: any) {
        handleApiError(err, "Échec de la génération de la vidéo");
    } finally {
        setLoading(false);
    }
  };

  const handleAddToQueue = () => {
      if (metadata && generatedVideoUrl) {
          const selectedChannel = channels.find(c => c.id === selectedChannelId);
          const newAsset: GeneratedAsset = {
              id: crypto.randomUUID(),
              metadata,
              videoUrl: generatedVideoUrl,
              thumbnailImage,
              voiceoverUrl: generatedAudioUrl,
              voiceoverBlob: generatedAudioBlob,
              timestamp: new Date(),
              channelName: selectedChannel?.name
          };
          setExportQueue(prev => [...prev, newAsset]);
          setSelectedAssetIds(prev => new Set(prev).add(newAsset.id)); // Auto-select newly added
          
          // Sync with App (Dashboard)
          onProjectCreated(newAsset);

          // Increment episode if series mode
          if (isSeriesMode) {
              setEpisodeNumber(prev => prev + 1);
          }

          // Reset for next
          setStep(1);
          setMetadata(null);
          setGeneratedVideoUrl(null);
          setThumbnailImage(null);
          setGeneratedAudioUrl(null);
          setGeneratedAudioBlob(null);
          // Keep niche for series flow
          if (!isSeriesMode) {
              setNiche('');
          }
      }
  };

  const handleComposeVideo = async () => {
    if (!metadata || !generatedVideoUrl) return;

    setIsComposing(true);
    setCompositionProgress("Initializing FFmpeg...");
    setError(null);

    try {
        const selectedChannel = channels.find(c => c.id === selectedChannelId);
        const currentAsset: GeneratedAsset = {
            id: 'composition-asset',
            metadata,
            videoUrl: generatedVideoUrl,
            thumbnailImage,
            voiceoverUrl: generatedAudioUrl,
            voiceoverBlob: generatedAudioBlob,
            timestamp: new Date(),
            channelName: selectedChannel?.name
        };

        const selectedMusic = musicLibrary.find(m => m.id === selectedMusicId);

        const { url } = await processVideoComposition({
            asset: currentAsset,
            introOutro: introOutroSettings,
            watermark: watermarkSettings,
            music: selectedMusic,
            progressCallback: setCompositionProgress,
        });

        setComposedVideoUrl(url);

    } catch (err: any) {
        console.error("Composition failed", err);
        setError(`Échec de l'assemblage vidéo: ${err.message}`);
    } finally {
        setIsComposing(false);
    }
  };

  const handleSaveAsTemplate = () => {
      const newTemplate: Template = {
          id: crypto.randomUUID(),
          name: newTemplateName || `${niche} (${format})`,
          description: `Configuration pour ${channels.find(c => c.id === selectedChannelId)?.name}.`,
          channelId: selectedChannelId,
          niche: niche,
          format: format,
          language: language,
          isSeries: isSeriesMode,
          visualStyle: visualStyle
      };
      onSaveTemplate(newTemplate);
      setShowTemplateModal(false);
      setNewTemplateName('');
  };

  const toggleAssetSelection = (id: string) => {
      const newSelection = new Set(selectedAssetIds);
      if (newSelection.has(id)) {
          newSelection.delete(id);
      } else {
          newSelection.add(id);
      }
      setSelectedAssetIds(newSelection);
  };

  const createZipFromAssets = async (assets: GeneratedAsset[]): Promise<Blob> => {
      const zip = new JSZip();

      for (const asset of assets) {
          const folderName = `${asset.channelName ? asset.channelName.substring(0,15) + '_' : ''}${asset.metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30)}`;
          const folder = assets.length > 1 ? zip.folder(folderName) : zip;
          
          if (folder) {
              // Add Metadata
              const content = `
CHANNEL: ${asset.channelName || 'N/A'}
TITLE: ${asset.metadata.title}
DESCRIPTION: ${asset.metadata.description}
TAGS: ${asset.metadata.tags.join(', ')}
VISUAL PROMPT: ${asset.metadata.visualPrompt || 'N/A'}
EPISODE: ${asset.metadata.episodeNumber || 'N/A'}
COMMUNITY POST: ${asset.metadata.communityPost || 'N/A'}

SCRIPT:
${asset.metadata.script}
              `;
              folder.file("metadata.txt", content);

              // Add Subtitles
              if (asset.metadata.subtitles) {
                  folder.file("subtitles.srt", asset.metadata.subtitles);
              }

              // Add Main Video
              try {
                  const videoBlob = await fetch(asset.videoUrl).then(r => r.blob());
                  folder.file("01_main_video.mp4", videoBlob);
              } catch (e) {
                  console.error("Failed to fetch video blob", e);
                  folder.file("video_url.txt", asset.videoUrl);
              }

              // Add Voiceover Audio
              if (asset.voiceoverBlob) {
                  folder.file("02_voiceover.wav", asset.voiceoverBlob);
              }

              // Add Thumbnail
              if (asset.thumbnailImage) {
                  const base64Data = asset.thumbnailImage.split(',')[1];
                  folder.file("thumbnail.png", base64Data, {base64: true});
              }

              // Add Watermark
              if (watermarkSettings?.enabled && watermarkSettings.dataUrl) {
                   const base64Data = watermarkSettings.dataUrl.split(',')[1];
                   folder.file("asset_watermark.png", base64Data, {base64: true});
              }

              // Add Intro
              if (introOutroSettings?.intro.enabled && introOutroSettings.intro.file) {
                  folder.file("00_intro.mp4", introOutroSettings.intro.file);
              }

              // Add Outro
              if (introOutroSettings?.outro.enabled && introOutroSettings.outro.file) {
                  folder.file("99_outro.mp4", introOutroSettings.outro.file);
              }
              
              // Add Selected Music (Note: Logic currently supports only global music selection for single export flow, or attached to asset if we persisted it. For now we use the library selected in Step 3 if it's a single export)
              if (selectedMusicId) {
                   const track = musicLibrary.find(t => t.id === selectedMusicId);
                   if (track) {
                       folder.file("03_background_music.mp3", track.file);
                   }
              }
          }
      }

      return await zip.generateAsync({type: "blob"});
  };

  const handleBatchDownload = async () => {
    const assetsToDownload = exportQueue.filter(asset => selectedAssetIds.has(asset.id));
    if (assetsToDownload.length === 0) return;

    setLoading(true);
    setLoadingText(`Compression de ${assetsToDownload.length} projets...`);

    try {
        const content = await createZipFromAssets(assetsToDownload);
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `veo_studio_batch_${new Date().toISOString().slice(0,10)}.zip`;
        a.click();
        setShowBatchModal(false);

    } catch (e) {
        console.error("Zip error", e);
        setError("Échec de la création de l'archive ZIP.");
    } finally {
        setLoading(false);
    }
  };

  const handleDownloadSinglePackage = async () => {
      if (!metadata || !generatedVideoUrl) return;
      setLoading(true);
      setLoadingText("Empaquetage de la ressource...");

      try {
          const selectedChannel = channels.find(c => c.id === selectedChannelId);
          const currentAsset: GeneratedAsset = {
              id: 'temp',
              metadata,
              videoUrl: generatedVideoUrl,
              thumbnailImage,
              voiceoverUrl: generatedAudioUrl,
              voiceoverBlob: generatedAudioBlob,
              timestamp: new Date(),
              channelName: selectedChannel?.name
          };
          
          const content = await createZipFromAssets([currentAsset]);
          const url = URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_package.zip`;
          a.click();
      } catch (e) {
          console.error("Zip error", e);
          setError("Échec de la création du package de téléchargement.");
      } finally {
          setLoading(false);
      }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  const getWatermarkPositionClasses = (pos: string) => {
    switch (pos) {
      case 'top-left': return 'top-[5%] left-[5%]';
      case 'top-right': return 'top-[5%] right-[5%]';
      case 'bottom-left': return 'bottom-[5%] left-[5%]';
      case 'bottom-right': return 'bottom-[5%] right-[5%]';
      default: return 'bottom-[5%] right-[5%]';
    }
  };

  if (loading || isComposing) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <LoadingIndicator />
        <p className="mt-4 text-indigo-300 animate-pulse text-sm md:text-base">
            {isComposing ? compositionProgress : loadingText}
        </p>
        {isComposing && <p className="text-xs text-gray-500 mt-2">Cette opération peut prendre plusieurs minutes. Veuillez garder cet onglet ouvert.</p>}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto scrollbar-hide relative">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Studio de création</h2>
            <p className="text-sm md:text-base text-gray-400 mt-1">
            Étape {step} sur 3 : {step === 1 ? 'Stratégie' : step === 2 ? 'Planification IA' : 'Production'}
            </p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
            {step === 1 && (
                 <button
                    onClick={() => setShowTemplateModal(true)}
                    disabled={!niche}
                    className="px-4 py-2 bg-[#1f1f1f] hover:bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors flex items-center gap-2"
                    title="Sauvegarder la configuration actuelle"
                 >
                     <SaveIcon className="w-5 h-5" />
                     <span className="hidden md:inline">Sauvegarder en Modèle</span>
                 </button>
            )}
            {exportQueue.length > 0 && (
                 <button 
                    onClick={() => setShowBatchModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-white transition-colors relative w-full md:w-auto justify-center"
                 >
                    <ArchiveIcon className="w-5 h-5 text-indigo-400" />
                    <span>Export groupé</span>
                    <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">{exportQueue.length}</span>
                 </button>
            )}
        </div>
      </header>

      <div className="w-full h-1 bg-gray-800 mb-6 md:mb-8 rounded-full overflow-hidden">
            <div className={`h-full bg-indigo-600 transition-all duration-500 ${step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'}`}></div>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/30 border border-red-500/50 p-4 rounded-lg text-red-200 flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-200 hover:text-white" aria-label="Fermer le message d'erreur"><ArrowPathIcon className="w-4 h-4"/></button>
        </div>
      )}

      {/* STEP 1: STRATEGY */}
      {step === 1 && (
        <div className="max-w-3xl mx-auto w-full bg-[#1f1f1f] p-5 md:p-8 rounded-2xl border border-gray-700 shadow-xl">
          <div className="space-y-6">
            
            {/* Channel Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                    Chaîne YouTube Cible
                    </label>
                    <select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full bg-[#0f0f0f] border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-white font-semibold"
                    aria-label="Sélectionner la chaîne YouTube cible"
                    >
                    {channels.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Thème : {channels.find(c => c.id === selectedChannelId)?.theme}</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                    Niche ou Sujet de la Vidéo
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={niche}
                            onChange={(e) => setNiche(e.target.value)}
                            placeholder="ex : Feu, Mystère, Espace..."
                            className="w-full bg-[#0f0f0f] border border-gray-600 rounded-lg pl-4 pr-12 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-white"
                        />
                        <button 
                            onClick={handleMagicEnhance}
                            disabled={!niche || isEnhancing}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-purple-400 hover:text-white hover:bg-purple-900/50 rounded-lg transition-colors disabled:opacity-50"
                            title="Magic Enhance : Améliorer le sujet avec l'IA"
                        >
                            {isEnhancing ? <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div> : <WandIcon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Series Mode Toggle */}
             <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-gray-800">
                 <button 
                    onClick={() => setIsSeriesMode(!isSeriesMode)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${isSeriesMode ? 'bg-indigo-600' : 'bg-gray-600'}`}
                    aria-label={isSeriesMode ? 'Désactiver le mode série' : 'Activer le mode série'}
                 >
                     <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isSeriesMode ? 'left-5' : 'left-1'}`}></div>
                 </button>
                 <div className="flex-grow">
                     <span className="text-sm font-medium text-white flex items-center gap-2">
                         <ListOrderedIcon className="w-4 h-4" />
                         Mode Série / Chronologie
                     </span>
                 </div>
                 {isSeriesMode && (
                     <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
                         <button onClick={() => setEpisodeNumber(Math.max(1, episodeNumber - 1))} className="px-2 text-gray-400 hover:text-white">-</button>
                         <span className="font-bold text-white">Ép. {episodeNumber}</span>
                         <button onClick={() => setEpisodeNumber(episodeNumber + 1)} className="px-2 text-gray-400 hover:text-white">+</button>
                     </div>
                 )}
             </div>

             {/* Style Selector */}
             <div>
                 <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                     <WandIcon className="w-4 h-4 text-purple-400" />
                     Style Visuel
                 </label>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                     {styles.map(style => (
                         <button
                            key={style.id}
                            onClick={() => setVisualStyle(style.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${visualStyle === style.id ? 'bg-purple-900/20 border-purple-500' : 'bg-[#0f0f0f] border-gray-700 hover:border-gray-500'}`}
                         >
                             <div className={`font-semibold text-sm ${visualStyle === style.id ? 'text-purple-400' : 'text-gray-300'}`}>{style.label}</div>
                             <div className="text-[10px] text-gray-500 mt-1">{style.desc}</div>
                         </button>
                     ))}
                 </div>
             </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setFormat('shorts')}
                        className={`px-2 py-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${format === 'shorts' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#0f0f0f] border-gray-600 text-gray-400'}`}
                    >
                        <ArrowDownIcon className="w-4 h-4" />
                        <span className="text-xs font-medium">Shorts</span>
                    </button>
                    <button
                        onClick={() => setFormat('long-form')}
                        className={`px-2 py-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${format === 'long-form' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#0f0f0f] border-gray-600 text-gray-400'}`}
                    >
                        <FilmIcon className="w-4 h-4" />
                        <span className="text-xs font-medium">Long</span>
                    </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Langue
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'fr')}
                  className="w-full bg-[#0f0f0f] border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-white h-[50px]"
                  aria-label="Sélectionner la langue">
                  <option value="en">Anglais</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGeneratePlan}
              disabled={!niche}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 transition-all active:scale-[0.99]">
              <SparklesIcon className="w-5 h-5" />
              Générer le plan IA
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PLANNING */}
      {step === 2 && metadata && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full pb-20">
          {/* Left: Metadata Preview */}
          <div className="space-y-6 bg-[#1f1f1f] p-4 md:p-6 rounded-xl border border-gray-700 overflow-y-auto max-h-[50vh] md:max-h-[65vh] scrollbar-thin scrollbar-thumb-gray-600">
            <div className="flex justify-between items-start">
                 <div className="flex flex-col">
                     <h3 className="text-lg font-bold text-white">Métadonnées & SEO</h3>
                     {metadata.episodeNumber && <span className="text-xs text-indigo-400 font-bold">ÉPISODE {metadata.episodeNumber}</span>}
                 </div>
                 <button 
                    onClick={handleGeneratePlan}
                    className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                 >
                    <ArrowPathIcon className="w-3 h-3" /> Régénérer
                 </button>
            </div>
           
            <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Titre optimisé ({language === 'fr' ? 'FR' : 'EN'})</label>
                <h3 className="text-lg md:text-xl font-bold text-white mt-1 p-2 bg-black/20 rounded border border-transparent hover:border-gray-600 transition-colors outline-none" contentEditable suppressContentEditableWarning>{metadata.title}</h3>
            </div>
            <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Description</label>
                <p className="text-gray-300 text-sm mt-1 p-2 bg-black/20 rounded border border-transparent hover:border-gray-600 transition-colors outline-none" contentEditable suppressContentEditableWarning>{metadata.description}</p>
            </div>

             {/* Community Post Section */}
             <div className="bg-gradient-to-r from-orange-900/20 to-red-900/20 p-3 rounded border border-orange-900/50">
                 <label className="text-xs text-orange-400 uppercase font-bold flex items-center gap-1">
                     <UsersIcon className="w-3 h-3"/> Post Communauté (Teasing)
                 </label>
                 <p className="text-gray-200 text-sm mt-1 p-1 bg-transparent font-medium italic" contentEditable suppressContentEditableWarning>{metadata.communityPost}</p>
            </div>

             <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Prompt Visuel (Anglais)</label>
                <p className="text-indigo-300 text-xs md:text-sm mt-1 p-2 bg-indigo-900/10 border border-indigo-900/30 rounded font-mono break-words">{metadata.visualPrompt}</p>
            </div>
            <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Tags</label>
                <div className="flex flex-wrap gap-2 mt-2">
                    {metadata.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded-full border border-gray-700">#{tag}</span>
                    ))}
                </div>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold">Plan du script</label>
                    <div className="bg-black/30 p-4 rounded mt-1 h-32 overflow-y-auto text-xs md:text-sm text-gray-400 whitespace-pre-wrap font-mono">
                        {metadata.script}
                    </div>
                </div>
                <div>
                     <label className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1">
                         <CaptionsIcon className="w-3 h-3"/> Sous-titres (SRT)
                     </label>
                     <div className="bg-black/30 p-4 rounded mt-1 h-32 overflow-y-auto text-xs md:text-sm text-green-400 whitespace-pre-wrap font-mono">
                        {metadata.subtitles || "Aucun sous-titre généré."}
                     </div>
                </div>
            </div>
          </div>

          {/* Right: Visuals & Action */}
          <div className="flex flex-col gap-6">
             {/* Thumbnail Section */}
             <div className="bg-[#1f1f1f] p-4 md:p-6 rounded-xl border border-gray-700">
                 <label className="text-xs text-gray-500 uppercase font-semibold block mb-2">Miniature</label>
                 {thumbnailImage ? (
                     <div className="relative group aspect-video rounded-lg overflow-hidden bg-black">
                         <img src={thumbnailImage} alt="Thumbnail" className="w-full h-full object-cover" />
                         <button 
                            onClick={handleGenerateThumbnail}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-semibold"
                         >
                             Régénérer
                         </button>
                     </div>
                 ) : (
                    <div className="space-y-3">
                         <div className="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded-lg">
                            <p className="text-indigo-200 text-xs italic">"{metadata.thumbnailIdea}"</p>
                        </div>
                        <button 
                            onClick={handleGenerateThumbnail}
                            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                            <SparklesIcon className="w-4 h-4" />
                            Générer l'image de la miniature
                        </button>
                    </div>
                 )}
             </div>

            {/* Production Action */}
            <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 p-4 md:p-6 rounded-xl border border-indigo-500/30 text-center mt-auto">
                <FilmIcon className="w-10 h-10 md:w-12 md:h-12 text-indigo-400 mx-auto mb-3" />
                <h3 className="text-lg md:text-xl font-bold text-white mb-2">Tout semble correct ?</h3>
                <p className="text-gray-400 text-sm mb-6">
                    Passez à la génération de la vidéo basée sur ce plan.
                </p>
                <button 
                    onClick={handleGenerateVideo}
                    className="w-full py-4 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                    Lancer la production vidéo
                    <ArrowRightIcon className="w-5 h-5" />
                </button>
                 <button 
                    onClick={() => setStep(1)}
                    className="mt-4 text-gray-500 hover:text-gray-300 text-xs underline"
                >
                    Retour à la stratégie
                </button>
            </div>
          </div>
        </div>
      )}

       {/* STEP 3: PRODUCTION & EXPORT */}
       {step === 3 && (
           <div className="flex flex-col items-center justify-center h-full max-w-5xl mx-auto w-full pb-20">
                <div className="w-full flex flex-col lg:flex-row gap-8 items-start">
                    {/* Video Player & Audio */}
                    <div className="w-full lg:w-2/3 space-y-6">
                        {/* Final Composed Video Player */}
                        {composedVideoUrl ? (
                             <div className="w-full space-y-4">
                                <div className={`w-full bg-black rounded-xl overflow-hidden shadow-2xl border border-green-500/50 ${format === 'shorts' ? 'aspect-[9/16] max-w-xs md:max-w-sm mx-auto' : 'aspect-video'}`}>
                                     <video
                                        src={composedVideoUrl}
                                        controls
                                        playsInline
                                        className="w-full h-full object-contain"
                                     />
                                </div>
                                <div className="text-center p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                                    <h4 className="font-bold text-green-300">Vidéo Finale Prête</h4>
                                    <p className="text-xs text-gray-400">Votre vidéo a été assemblée avec tous les éléments.</p>
                                </div>
                             </div>
                        ) : (
                             <>
                                {/* Synced Player */}
                                <div className={`w-full bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800 relative ${format === 'shorts' ? 'aspect-[9/16] max-w-xs md:max-w-sm mx-auto' : 'aspect-video'}`}>
                                    {generatedVideoUrl ? (
                                        <>
                                            <video
                                                ref={videoRef}
                                                src={generatedVideoUrl}
                                                controls={!isPlayingSynced}
                                                playsInline
                                                className="w-full h-full object-contain"
                                            />
                                            {watermarkSettings?.enabled && watermarkSettings.dataUrl && (
                                                <img
                                                    src={watermarkSettings.dataUrl}
                                                    alt="Watermark"
                                                    className={`absolute pointer-events-none object-contain z-10 max-w-[50%] ${getWatermarkPositionClasses(watermarkSettings.position)}`}
                                                    style={
                                                        {
                                                            '--watermark-opacity': watermarkSettings.opacity,
                                                            '--watermark-scale': `${watermarkSettings.scale * 100}%`,
                                                            opacity: 'var(--watermark-opacity)',
                                                            width: 'var(--watermark-scale)'
                                                        } as React.CSSProperties
                                                    }
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600">Aucune vidéo</div>
                                    )}
                                </div>

                                {/* Sync Controls */}
                                {generatedVideoUrl && generatedAudioUrl && (
                                    <div className="flex justify-center">
                                        <button
                                            onClick={toggleSyncedPlayback}
                                            className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all shadow-lg ${isPlayingSynced ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-500'}`}
                                        >
                                            {isPlayingSynced ? <SquareIcon className="w-5 h-5 fill-current" /> : <PlayIcon className="w-5 h-5 fill-current" />}
                                            {isPlayingSynced ? 'STOP' : 'LECTURE SYNCHRONISÉE (Prévisualisation)'}
                                        </button>
                                    </div>
                                )}
                             </>
                        )}

                        {/* Hidden Audio Elements for Sync */}
                        {generatedAudioUrl && <audio ref={audioRef} src={generatedAudioUrl} />}
                        {selectedMusicId && <audio ref={musicRef} src={musicLibrary.find(m => m.id === selectedMusicId)?.url} loop />}

                        {/* Voiceover & Music Studio */}
                        <div className="bg-[#1f1f1f] p-4 md:p-6 rounded-xl border border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Voiceover Column */}
                            <div>
                                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                    <MicIcon className="w-4 h-4 text-pink-500" />
                                    Doublage IA
                                </h3>
                                <div className="space-y-3">
                                    <select 
                                        value={selectedVoice}
                                        onChange={(e) => setSelectedVoice(e.target.value)}
                                        className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                        aria-label="Sélectionner la voix pour le doublage IA"
                                    >
                                        {voices.map(v => (
                                            <option key={v.id} value={v.id}>{v.label}</option>
                                        ))}
                                    </select>
                                    <button 
                                        onClick={handleGenerateAudio}
                                        className="w-full px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Volume2Icon className="w-4 h-4" />
                                        {generatedAudioUrl ? 'Régénérer Audio' : 'Générer la Voix-Off'}
                                    </button>
                                </div>
                            </div>

                            {/* Music Column */}
                            <div>
                                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                    <MusicIcon className="w-4 h-4 text-blue-400" />
                                    Musique de Fond
                                </h3>
                                <div className="space-y-3">
                                    {musicLibrary.length === 0 ? (
                                        <div className="text-xs text-gray-500 italic border border-dashed border-gray-700 p-2 rounded text-center">
                                            Aucune musique. Ajoutez-en dans Ressources.
                                        </div>
                                    ) : (
                                        <select 
                                            value={selectedMusicId}
                                            onChange={(e) => setSelectedMusicId(e.target.value)}
                                            className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                            aria-label="Sélectionner la musique de fond"
                                        >
                                            <option value="">-- Aucune musique --</option>
                                            {musicLibrary.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    )}
                                    <div className="text-xs text-gray-500 text-center">
                                        Sera mixé à 30% du volume.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Export Options */}
                    <div className="w-full lg:w-1/3 space-y-4">
                         <div className="bg-[#1f1f1f] p-4 md:p-6 rounded-xl border border-gray-700">
                            <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                                <DownloadIcon className="w-5 h-5 text-green-500" />
                                Actions
                            </h3>
                            
                            {composedVideoUrl ? (
                                <a
                                    href={composedVideoUrl}
                                    download={`${metadata?.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`}
                                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 mb-3 transition-colors shadow-lg shadow-green-900/20 text-sm md:text-base"
                                >
                                    <DownloadIcon className="w-5 h-5" />
                                    Télécharger la Vidéo Finale
                                </a>
                            ) : (
                                <button
                                    onClick={handleComposeVideo}
                                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 mb-3 transition-colors shadow-lg shadow-green-900/20 text-sm md:text-base"
                                >
                                    <WandIcon className="w-5 h-5" />
                                    Assembler la Vidéo Finale
                                </button>
                            )}

                            <button
                                onClick={() => setShowPublishModal(true)}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 mb-3 transition-colors shadow-lg shadow-red-900/20 text-sm md:text-base"
                            >
                                <YoutubeIcon className="w-5 h-5" />
                                Publier sur YouTube
                            </button>

                            <button 
                                onClick={handleAddToQueue}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 mb-3 transition-colors shadow-lg shadow-indigo-900/20 text-sm md:text-base"
                            >
                                <ArchiveIcon className="w-5 h-5" />
                                Ajouter à la file & {isSeriesMode ? `Épisode ${episodeNumber + 1}` : 'Créer nouveau'}
                            </button>

                            <button 
                                onClick={handleDownloadSinglePackage}
                                className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 mb-3 transition-colors text-sm md:text-base"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                Télécharger le pack d'assets
                            </button>
                        </div>
                        
                        <div className="p-4 border border-gray-800 rounded-xl">
                             <div className="flex items-center justify-between mb-2">
                                <h4 className="text-gray-500 text-xs uppercase font-bold">Statut de la session</h4>
                                <span className="text-xs text-indigo-400">{exportQueue.length} éléments en file d'attente</span>
                             </div>
                             <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full w-full animate-pulse"></div>
                            </div>
                        </div>

                        <button 
                            onClick={() => {setStep(1); setMetadata(null); setGeneratedVideoUrl(null); setThumbnailImage(null); setGeneratedAudioUrl(null); setComposedVideoUrl(null);}}
                            className="w-full py-3 border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 rounded-lg transition-colors text-sm"
                        >
                            Annuler & Créer nouveau
                        </button>
                    </div>
                </div>
           </div>
       )}

       {/* SAVE TEMPLATE MODAL */}
       {showTemplateModal && (
           <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
               <div className="bg-[#161616] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
                   <h3 className="text-xl font-bold text-white mb-4">Sauvegarder le modèle</h3>
                   <p className="text-sm text-gray-400 mb-4">Donnez un nom à cette configuration pour la réutiliser plus tard.</p>
                   <input 
                        type="text" 
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="Nom du modèle (ex: Série Historique)"
                        className="w-full bg-[#0f0f0f] border border-gray-600 rounded-lg px-4 py-3 text-white mb-6"
                        autoFocus
                   />
                   <div className="flex gap-3">
                       <button onClick={() => setShowTemplateModal(false)} className="flex-1 py-2 text-gray-400 hover:text-white">Annuler</button>
                       <button onClick={handleSaveAsTemplate} disabled={!newTemplateName} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold disabled:opacity-50">Sauvegarder</button>
                   </div>
               </div>
           </div>
       )}

       {/* PUBLISH ASSISTANT MODAL */}
       {showPublishModal && metadata && (
           <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
               <div className="bg-[#161616] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl p-4 md:p-8 relative max-h-[90vh] overflow-y-auto">
                    <button 
                        onClick={() => setShowPublishModal(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        aria-label="Fermer l'assistant de publication"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>

                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-red-600/20 rounded-full flex-shrink-0">
                            <YoutubeIcon className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg md:text-2xl font-bold text-white">Assistant de Publication</h2>
                            <p className="text-gray-400 text-xs md:text-sm">Copiez les données vers YouTube Studio pour {channels.find(c => c.id === selectedChannelId)?.name}</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="bg-[#1f1f1f] p-4 rounded-lg border border-gray-700">
                            <div className="flex justify-between text-sm text-gray-400 mb-1">
                                <span>Titre</span>
                                <button onClick={() => copyToClipboard(metadata.title)} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><CopyIcon className="w-3 h-3"/> Copier</button>
                            </div>
                            <div className="text-white font-medium truncate">{metadata.title}</div>
                        </div>

                        <div className="bg-[#1f1f1f] p-4 rounded-lg border border-gray-700">
                            <div className="flex justify-between text-sm text-gray-400 mb-1">
                                <span>Description</span>
                                <button onClick={() => copyToClipboard(metadata.description)} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><CopyIcon className="w-3 h-3"/> Copier</button>
                            </div>
                            <div className="text-white text-sm line-clamp-2">{metadata.description}</div>
                        </div>
                        
                        <div className="bg-orange-900/20 p-4 rounded-lg border border-orange-900/50">
                             <div className="flex justify-between text-sm text-orange-400 mb-1">
                                <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3"/> Post Communauté (Pour Teasing)</span>
                                <button onClick={() => copyToClipboard(metadata.communityPost || '')} className="text-orange-400 hover:text-orange-300 flex items-center gap-1"><CopyIcon className="w-3 h-3"/> Copier</button>
                            </div>
                            <div className="text-white text-sm italic">{metadata.communityPost}</div>
                        </div>

                        <div className="bg-[#1f1f1f] p-4 rounded-lg border border-gray-700">
                            <div className="flex justify-between text-sm text-gray-400 mb-1">
                                <span>Tags</span>
                                <button onClick={() => copyToClipboard(metadata.tags.join(','))} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><CopyIcon className="w-3 h-3"/> Copier</button>
                            </div>
                            <div className="text-white text-xs truncate">{metadata.tags.join(', ')}</div>
                        </div>
                        
                        <div className="text-xs text-yellow-500/80 bg-yellow-900/20 p-3 rounded border border-yellow-700/30">
                            Note: Vous devrez uploader manuellement le fichier vidéo (MP4), le fichier audio (WAV) et la miniature (PNG) que vous avez téléchargés.
                        </div>
                    </div>

                    <a 
                        href={`https://studio.youtube.com/channel/${channels.find(c => c.id === selectedChannelId)?.id}/videos/upload?d=ud`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                        Ouvrir YouTube Studio
                        <ExternalLinkIcon className="w-5 h-5" />
                    </a>
               </div>
           </div>
       )}

       {/* BATCH EXPORT MODAL */}
       {showBatchModal && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
               <div className="bg-[#161616] border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                   <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center">
                       <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                           <ArchiveIcon className="w-5 h-5 text-indigo-500" />
                           File d'attente d'export groupé
                       </h2>
                       <button onClick={() => setShowBatchModal(false)} className="text-gray-400 hover:text-white" aria-label="Fermer la file d'attente d'export">
                           <XMarkIcon className="w-6 h-6" />
                       </button>
                   </div>
                   
                   <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-4">
                       {exportQueue.length === 0 ? (
                           <div className="text-center py-12 text-gray-500">
                               Votre file d'attente est vide. Créez des vidéos pour les ajouter ici.
                           </div>
                       ) : (
                           exportQueue.map(asset => (
                               <div key={asset.id} className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border transition-colors ${selectedAssetIds.has(asset.id) ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-[#1f1f1f] border-gray-700'}`}>
                                   <div className="flex items-center gap-4 w-full sm:w-auto">
                                       <button onClick={() => toggleAssetSelection(asset.id)} className="text-indigo-400 hover:text-indigo-300">
                                           {selectedAssetIds.has(asset.id) ? <CheckSquareIcon className="w-6 h-6" /> : <SquareIcon className="w-6 h-6 text-gray-500" />}
                                       </button>
                                       
                                       <div className="w-16 h-16 bg-black rounded-lg overflow-hidden flex-shrink-0 relative">
                                           {asset.thumbnailImage ? (
                                               <img src={asset.thumbnailImage} className="w-full h-full object-cover" alt={`Thumbnail pour ${asset.metadata.title}`} />
                                           ) : (
                                               <div className="w-full h-full flex items-center justify-center text-gray-700"><FilmIcon className="w-6 h-6"/></div>
                                           )}
                                           {asset.voiceoverBlob && (
                                               <div className="absolute bottom-0 right-0 bg-pink-600 p-0.5 rounded-tl"><MicIcon className="w-3 h-3 text-white"/></div>
                                           )}
                                       </div>
                                   </div>
                                   
                                   <div className="flex-grow min-w-0">
                                       <h4 className="font-semibold text-white truncate">{asset.metadata.title}</h4>
                                       <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-1">
                                            <span className="text-indigo-400">{asset.channelName}</span>
                                            <span>•</span>
                                            <span>{new Date(asset.timestamp).toLocaleString()}</span>
                                            {asset.metadata.episodeNumber && (
                                                <span className="text-xs bg-purple-900/40 px-1.5 rounded text-purple-300">Ép. {asset.metadata.episodeNumber}</span>
                                            )}
                                       </div>
                                   </div>

                                    <button 
                                        onClick={() => {
                                            setExportQueue(prev => prev.filter(p => p.id !== asset.id));
                                            selectedAssetIds.delete(asset.id);
                                        }}
                                        className="p-2 hover:bg-red-900/30 rounded-lg text-gray-500 hover:text-red-400 transition-colors self-end sm:self-center"
                                        aria-label="Supprimer de la file d'attente"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                               </div>
                           ))
                       )}
                   </div>

                   <div className="p-4 md:p-6 border-t border-gray-800 bg-[#1f1f1f] rounded-b-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                       <div className="text-sm text-gray-400">
                           {selectedAssetIds.size} sélectionnés
                       </div>
                       <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => setShowBatchModal(false)}
                                className="px-4 py-2 text-gray-300 hover:text-white font-medium w-full sm:w-auto"
                            >
                                Fermer
                            </button>
                            <button 
                                onClick={handleBatchDownload}
                                disabled={selectedAssetIds.size === 0}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                Télécharger ZIP
                            </button>
                       </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default CreatorStudio;
