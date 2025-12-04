
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useState } from 'react';
import { UploadCloudIcon, XMarkIcon, FilmIcon, YoutubeIcon, CheckCircleIcon, MusicIcon, TrashIcon } from './icons';
import { WatermarkSettings, WatermarkPosition, IntroOutroSettings, Channel, MusicTrack } from '../types';
import { YouTubeConnectionButton } from './YouTubeConnection';

interface AssetsSettingsProps {
  watermarkSettings: WatermarkSettings;
  onUpdateSettings: (settings: WatermarkSettings) => void;
  introOutroSettings: IntroOutroSettings;
  onUpdateIntroOutro: (settings: IntroOutroSettings) => void;
  musicLibrary: MusicTrack[];
  onUpdateMusicLibrary: (library: MusicTrack[]) => void;
  channels: Channel[];
  onUpdateChannels: (channels: Channel[]) => void;
}

const AssetsSettings: React.FC<AssetsSettingsProps> = ({
  watermarkSettings,
  onUpdateSettings,
  introOutroSettings,
  onUpdateIntroOutro,
  musicLibrary,
  onUpdateMusicLibrary,
  channels,
  onUpdateChannels
}) => {
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const introInputRef = useRef<HTMLInputElement>(null);
  const outroInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  
  // Local state for editing channel handles
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [tempHandle, setTempHandle] = useState('');

  // --- Watermark Handlers ---
  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdateSettings({
            ...watermarkSettings,
            dataUrl: event.target.result as string,
            enabled: true,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePositionChange = (pos: WatermarkPosition) => {
    onUpdateSettings({ ...watermarkSettings, position: pos });
  };

  // --- Intro/Outro Handlers ---
  const handleVideoUpload = (
    e: React.ChangeEvent<HTMLInputElement>, 
    type: 'intro' | 'outro'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpdateIntroOutro({
        ...introOutroSettings,
        [type]: {
          ...introOutroSettings[type],
          file: file,
          previewUrl: url,
          enabled: true,
        }
      });
    }
  };

  const removeVideo = (type: 'intro' | 'outro') => {
    if (introOutroSettings[type].previewUrl) {
      URL.revokeObjectURL(introOutroSettings[type].previewUrl!);
    }
    onUpdateIntroOutro({
      ...introOutroSettings,
      [type]: { enabled: false, file: null, previewUrl: null }
    });
  };

  const toggleVideoEnabled = (type: 'intro' | 'outro', enabled: boolean) => {
    onUpdateIntroOutro({
        ...introOutroSettings,
        [type]: { ...introOutroSettings[type], enabled }
    });
  };

  // --- Music Handlers ---
  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          const newTracks: MusicTrack[] = [];
          Array.from(files).forEach(file => {
              newTracks.push({
                  id: crypto.randomUUID(),
                  name: file.name.replace(/\.[^/.]+$/, ""),
                  file: file,
                  url: URL.createObjectURL(file)
              });
          });
          onUpdateMusicLibrary([...musicLibrary, ...newTracks]);
      }
      // Reset input
      if (musicInputRef.current) musicInputRef.current.value = '';
  };

  const removeMusicTrack = (id: string) => {
      const track = musicLibrary.find(t => t.id === id);
      if (track) {
          URL.revokeObjectURL(track.url);
          onUpdateMusicLibrary(musicLibrary.filter(t => t.id !== id));
      }
  };

  const getPositionClasses = (pos: WatermarkPosition) => {
    switch (pos) {
      case 'top-left': return 'top-[5%] left-[5%]';
      case 'top-right': return 'top-[5%] right-[5%]';
      case 'bottom-left': return 'bottom-[5%] left-[5%]';
      case 'bottom-right': return 'bottom-[5%] right-[5%]';
      default: return 'bottom-[5%] right-[5%]';
    }
  };

  // --- Channel Handlers ---
  const handleSaveHandle = (channelId: string) => {
    const updated = channels.map(c => 
        c.id === channelId ? { ...c, youtubeHandle: tempHandle } : c
    );
    onUpdateChannels(updated);
    setEditingChannelId(null);
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Ressources & Paramètres</h2>
      <p className="text-sm md:text-base text-gray-400 mb-6 md:mb-8">Gérez l'image de marque de votre chaîne et les intégrations.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 pb-20">
        {/* LEFT COLUMN: Branding */}
        <div className="space-y-6 md:space-y-8">
          
          {/* YOUTUBE INTEGRATION SECTION */}
          <div className="bg-[#1f1f1f] p-4 md:p-6 rounded-xl border border-gray-700">
             <h3 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6 flex items-center gap-2">
                 <YoutubeIcon className="w-6 h-6 text-red-500" />
                 Intégrations YouTube
             </h3>
             <p className="text-xs md:text-sm text-gray-400 mb-4">
                 Connectez vos chaînes pour activer l'assistant de publication rapide. (Simulation OAuth)
             </p>
             <div className="space-y-4">
                 {channels.map(channel => (
                     <div key={channel.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-black/30 rounded-lg border border-gray-800 gap-3">
                         <div className="grow">
                             <div className="text-sm font-bold text-gray-200">{channel.name}</div>
                             
                             {editingChannelId === channel.id ? (
                                 <div className="flex items-center gap-2 mt-1">
                                     <input 
                                        type="text" 
                                        value={tempHandle}
                                        onChange={(e) => setTempHandle(e.target.value)}
                                        placeholder="@MonHandle"
                                        aria-label="Identifiant YouTube"
                                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white w-32"
                                        autoFocus
                                     />
                                     <button type="button" onClick={() => handleSaveHandle(channel.id)} className="text-xs text-indigo-400 hover:underline">OK</button>
                                 </div>
                             ) : (
                                 <div className="flex items-center gap-2 mt-1">
                                     <span className="text-xs text-gray-500">{channel.youtubeHandle || 'Aucun identifiant'}</span>
                                     <button 
                                        onClick={() => { setEditingChannelId(channel.id); setTempHandle(channel.youtubeHandle || ''); }}
                                        className="text-[10px] text-gray-600 hover:text-gray-300 underline"
                                     >
                                         Modifier
                                     </button>
                                 </div>
                             )}
                         </div>
                         
                         <YouTubeConnectionButton 
                           channel={channel}
                           onConnectionChange={(id, connected) => {
                             const updated = channels.map(c => 
                               c.id === id ? { ...c, connected } : c
                             );
                             onUpdateChannels(updated);
                           }}
                        />
                     </div>
                 ))}
             </div>
          </div>

          {/* WATERMARK SECTION */}
          <div className="bg-[#1f1f1f] p-4 md:p-6 rounded-xl border border-gray-700">
            <h3 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6 flex items-center justify-between">
              Filigrane de la chaîne
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={watermarkSettings.enabled} 
                  onChange={(e) => onUpdateSettings({...watermarkSettings, enabled: e.target.checked})}
                  className="sr-only peer"
                  aria-label="Activer le filigrane"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </h3>

            {/* Upload */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-300 mb-3">Téléchargement du logo</label>
              <div 
                onClick={() => watermarkInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-xl p-6 md:p-8 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-500 hover:text-white hover:bg-gray-800/50 transition-all cursor-pointer group"
              >
                {watermarkSettings.dataUrl ? (
                   <div className="relative">
                       <img src={watermarkSettings.dataUrl} alt="Uploaded Logo" className="h-16 object-contain" />
                       <button 
                         type="button"
                         title="Supprimer le logo"
                         aria-label="Supprimer le logo"
                         onClick={(e) => {
                             e.stopPropagation();
                             onUpdateSettings({...watermarkSettings, dataUrl: null, enabled: false});
                         }}
                         className="absolute -top-3 -right-3 bg-red-500 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                           <XMarkIcon className="w-3 h-3" />
                       </button>
                   </div>
                ) : (
                    <>
                        <UploadCloudIcon className="w-8 h-8 mb-3 group-hover:scale-110 transition-transform" />
                        <span className="text-sm text-center">Cliquez pour uploader PNG ou JPG</span>
                    </>
                )}
                <input 
                    type="file" 
                    ref={watermarkInputRef} 
                    className="hidden" 
                    accept="image/png, image/jpeg" 
                    onChange={handleWatermarkUpload}
                    aria-label="Télécharger un logo"
                />
              </div>
            </div>

            {/* Position Grid */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-300 mb-3">Position</label>
              <div className="grid grid-cols-2 gap-3 max-w-[200px]">
                 {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                     <button
                        type="button"
                        key={pos}
                        title={`Position ${pos}`}
                        aria-label={`Position ${pos}`}
                        onClick={() => handlePositionChange(pos as WatermarkPosition)}
                        className={`h-16 rounded-lg border-2 flex items-center justify-center ${watermarkSettings.position === pos ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 bg-gray-800 hover:bg-gray-700'}`}
                     >
                         <div className={`w-3 h-3 rounded-full ${watermarkSettings.position === pos ? 'bg-indigo-500' : 'bg-gray-600'} ${
                             pos.includes('top') ? 'mb-4' : 'mt-4'
                         } ${
                             pos.includes('left') ? 'mr-4' : 'ml-4'
                         }`}></div>
                     </button>
                 ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-6">
                <div>
                    <label htmlFor="opacity-slider" className="flex justify-between text-sm mb-2">
                        <span className="text-gray-300">Opacité</span>
                        <span className="text-gray-500">{Math.round(watermarkSettings.opacity * 100)}%</span>
                    </label>
                    <input 
                        id="opacity-slider"
                        type="range" 
                        min="0.1" 
                        max="1" 
                        step="0.1"
                        value={watermarkSettings.opacity}
                        onChange={(e) => onUpdateSettings({...watermarkSettings, opacity: parseFloat(e.target.value)})}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                </div>
                <div>
                    <label htmlFor="scale-slider" className="flex justify-between text-sm mb-2">
                        <span className="text-gray-300">Échelle de taille</span>
                        <span className="text-gray-500">{Math.round(watermarkSettings.scale * 100)}%</span>
                    </label>
                    <input 
                        id="scale-slider"
                        type="range" 
                        min="0.1" 
                        max="0.5" 
                        step="0.05"
                        value={watermarkSettings.scale}
                        onChange={(e) => onUpdateSettings({...watermarkSettings, scale: parseFloat(e.target.value)})}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Intros, Outros, and Preview */}
        <div className="space-y-6 md:space-y-8">
          
           {/* MUSIC LIBRARY SECTION */}
           <div className="bg-[#1f1f1f] p-4 md:p-6 rounded-xl border border-gray-700">
               <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
                   <MusicIcon className="w-6 h-6 text-blue-400" />
                   Bibliothèque de Musiques (Ambiance)
               </h3>
               <p className="text-xs text-gray-400 mb-4">
                   Ajoutez des pistes MP3/WAV pour les utiliser en fond lors de l'export.
               </p>
               
               <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                   {musicLibrary.length === 0 && (
                       <div className="text-sm text-gray-600 italic text-center py-4">Aucune musique chargée</div>
                   )}
                   {musicLibrary.map(track => (
                       <div key={track.id} className="flex items-center justify-between bg-black/30 p-2 rounded border border-gray-800">
                           <span className="text-sm text-gray-300 truncate grow">{track.name}</span>
                           <button type="button" title="Supprimer la piste" aria-label="Supprimer la piste" onClick={() => removeMusicTrack(track.id)} className="text-gray-500 hover:text-red-400 p-1">
                               <TrashIcon className="w-4 h-4" />
                           </button>
                       </div>
                   ))}
               </div>

               <button 
                    onClick={() => musicInputRef.current?.click()}
                    className="w-full py-3 border border-gray-600 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm"
               >
                   <UploadCloudIcon className="w-4 h-4" />
                   Ajouter des musiques (MP3/WAV)
               </button>
               <input type="file" ref={musicInputRef} className="hidden" accept="audio/*" multiple onChange={handleMusicUpload} aria-label="Ajouter des musiques" />
           </div>

          {/* INTRO / OUTRO SECTION */}
          <div className="bg-[#1f1f1f] p-4 md:p-6 rounded-xl border border-gray-700">
            <h3 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6">Séquences Vidéo</h3>
            
            {/* Intro */}
            <div className="mb-6 p-4 bg-black/30 rounded-xl border border-gray-800">
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <FilmIcon className="w-5 h-5 text-indigo-400" />
                        <span className="font-semibold text-gray-200 text-sm md:text-base">Vidéo d'Intro</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                        type="checkbox" 
                        checked={introOutroSettings.intro.enabled} 
                        onChange={(e) => toggleVideoEnabled('intro', e.target.checked)}
                        className="sr-only peer"
                        aria-label="Activer la vidéo d'intro"
                        />
                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                 </div>
                 
                 {introOutroSettings.intro.previewUrl ? (
                     <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
                         <video src={introOutroSettings.intro.previewUrl} className="w-full h-full object-contain" controls />
                         <button 
                            type="button"
                            title="Supprimer la vidéo d'intro"
                            aria-label="Supprimer la vidéo d'intro"
                            onClick={() => removeVideo('intro')}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                             <XMarkIcon className="w-4 h-4" />
                         </button>
                     </div>
                 ) : (
                     <button 
                        onClick={() => introInputRef.current?.click()}
                        className="w-full py-8 border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-lg text-gray-500 hover:text-white transition-colors flex flex-col items-center gap-2"
                     >
                         <UploadCloudIcon className="w-6 h-6" />
                         <span className="text-xs text-center">Uploader Intro (MP4)</span>
                     </button>
                 )}
                 <input type="file" ref={introInputRef} className="hidden" accept="video/mp4" onChange={(e) => handleVideoUpload(e, 'intro')} aria-label="Télécharger une vidéo d'intro" />
            </div>

            {/* Outro */}
            <div className="p-4 bg-black/30 rounded-xl border border-gray-800">
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <FilmIcon className="w-5 h-5 text-purple-400" />
                        <span className="font-semibold text-gray-200 text-sm md:text-base">Vidéo de Fin (Outro)</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                        type="checkbox" 
                        checked={introOutroSettings.outro.enabled} 
                        onChange={(e) => toggleVideoEnabled('outro', e.target.checked)}
                        className="sr-only peer"
                        aria-label="Activer la vidéo de fin"
                        />
                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                 </div>
                 
                 {introOutroSettings.outro.previewUrl ? (
                     <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
                         <video src={introOutroSettings.outro.previewUrl} className="w-full h-full object-contain" controls />
                         <button 
                            type="button"
                            title="Supprimer la vidéo de fin"
                            aria-label="Supprimer la vidéo de fin"
                            onClick={() => removeVideo('outro')}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                             <XMarkIcon className="w-4 h-4" />
                         </button>
                     </div>
                 ) : (
                     <button 
                        onClick={() => outroInputRef.current?.click()}
                        className="w-full py-8 border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-lg text-gray-500 hover:text-white transition-colors flex flex-col items-center gap-2"
                     >
                         <UploadCloudIcon className="w-6 h-6" />
                         <span className="text-xs text-center">Uploader Outro (MP4)</span>
                     </button>
                 )}
                 <input type="file" ref={outroInputRef} className="hidden" accept="video/mp4" onChange={(e) => handleVideoUpload(e, 'outro')} aria-label="Télécharger une vidéo de fin" />
            </div>
          </div>

           {/* Branding Preview */}
           <div className="space-y-4">
                <span className="block text-sm font-medium text-gray-300">Aperçu de la marque</span>
                <div className="relative w-full aspect-video bg-black rounded-xl border border-gray-700 overflow-hidden shadow-2xl flex items-center justify-center group">
                    {/* Mock Video Background */}
                    <div className="absolute inset-0 bg-linear-to-br from-gray-800 to-gray-900 opacity-50"></div>
                    <div className="z-0 text-gray-600 font-bold text-lg md:text-xl">APERÇU VIDÉO</div>
                    
                    {/* Watermark Overlay - style inline nécessaire pour valeurs dynamiques */}
                    {watermarkSettings.enabled && watermarkSettings.dataUrl && (
                        <img 
                            src={watermarkSettings.dataUrl}
                            alt="Aperçu du filigrane"
                            className={`absolute transition-all duration-300 ease-out object-contain z-10 max-w-[50%] ${getPositionClasses(watermarkSettings.position)}`}
                            style={{
                                opacity: watermarkSettings.opacity,
                                width: `${watermarkSettings.scale * 100}%`
                            }}
                        />
                    )}
                </div>
                <p className="text-xs text-gray-500 text-center">
                    Aperçu du filigrane. Les intros/outros seront ajoutées lors de l'export groupé.
                </p>
            </div>

        </div>
      </div>
    </div>
  );
};

export default AssetsSettings;
