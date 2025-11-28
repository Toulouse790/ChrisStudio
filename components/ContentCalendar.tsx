/**
 * ChrisStudio - Composant Calendrier Éditorial
 * Interface de validation et gestion des contenus planifiés
 * © 2025 Toulouse790. Tous droits réservés.
 */

import React, { useState, useMemo } from 'react';
import {
  Channel,
  ContentCalendar,
  CalendarItem,
  ContentStatus,
  GeneratedAsset,
  WatermarkSettings,
  IntroOutroSettings,
  MusicTrack,
} from '../types';
import {
  generateCalendarItems,
  createCalendarWithSchedule,
  updateCalendarItemStatus,
  approveAllProposed,
  getCalendarStats,
} from '../services/calendarService';
import { isChannelConnected } from '../services/youtubeService';
import {
  CalendarIcon,
  CheckIcon,
  XIcon,
  EditIcon,
  SparklesIcon,
  RefreshIcon,
  PlayIcon,
  ChevronDownIcon,
  UploadCloudIcon,
} from './icons';
import LoadingIndicator from './LoadingIndicator';

interface ContentCalendarProps {
  channels: Channel[];
  calendar: ContentCalendar | null;
  onCalendarUpdate: (calendar: ContentCalendar) => void;
  onGenerateVideo: (item: CalendarItem) => void;
  onUploadVideo?: (item: CalendarItem) => void;
  onProjectCreated?: (project: GeneratedAsset) => void;
  watermarkSettings?: WatermarkSettings;
  introOutroSettings?: IntroOutroSettings;
  musicLibrary?: MusicTrack[];
}

const ContentCalendarView: React.FC<ContentCalendarProps> = ({
  channels,
  calendar,
  onCalendarUpdate,
  onGenerateVideo,
  onUploadVideo,
  onProjectCreated,
  watermarkSettings,
  introOutroSettings,
  musicLibrary,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingItems, setGeneratingItems] = useState<Set<string>>(new Set());
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 2, year: now.getFullYear() + (now.getMonth() === 11 ? 1 : 0) };
  });

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // Stats du calendrier
  const stats = useMemo(() => {
    if (!calendar) return null;
    return getCalendarStats(calendar);
  }, [calendar]);

  // Items filtrés par chaîne
  const filteredItems = useMemo(() => {
    if (!calendar) return [];
    if (selectedChannel === 'all') return calendar.items;
    return calendar.items.filter(item => item.channelId === selectedChannel);
  }, [calendar, selectedChannel]);

  // Grouper par chaîne
  const itemsByChannel = useMemo(() => {
    const grouped: Record<string, CalendarItem[]> = {};
    filteredItems.forEach(item => {
      if (!grouped[item.channelId]) grouped[item.channelId] = [];
      grouped[item.channelId].push(item);
    });
    return grouped;
  }, [filteredItems]);

  // Entrées typées pour le rendu
  const channelEntries = useMemo(() => {
    return Object.entries(itemsByChannel) as [string, CalendarItem[]][];
  }, [itemsByChannel]);

  // Générer le calendrier
  const handleGenerateCalendar = async () => {
    setIsGenerating(true);
    try {
      const allItems: CalendarItem[] = [];
      
      for (const channel of channels) {
        const items = await generateCalendarItems({
          channelId: channel.id,
          channelName: channel.name,
          channelTheme: channel.theme,
          month: selectedMonth.month,
          year: selectedMonth.year,
          count: 12,
          existingTitles: calendar?.items
            .filter(i => i.channelId === channel.id)
            .map(i => i.title),
        });
        allItems.push(...items);
      }

      const newCalendar = createCalendarWithSchedule(
        allItems,
        selectedMonth.month,
        selectedMonth.year
      );
      
      onCalendarUpdate(newCalendar);
    } catch (error) {
      console.error('Erreur génération calendrier:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Actions sur les items
  const handleApprove = (itemId: string) => {
    if (!calendar) return;
    const updated = updateCalendarItemStatus(calendar, itemId, ContentStatus.APPROVED);
    onCalendarUpdate(updated);
  };

  const handleReject = (itemId: string) => {
    if (!calendar) return;
    const updated = updateCalendarItemStatus(calendar, itemId, ContentStatus.REJECTED);
    onCalendarUpdate(updated);
  };

  const handleStartEdit = (item: CalendarItem) => {
    setEditingItem(item.id);
    setEditTitle(item.title);
  };

  const handleSaveEdit = () => {
    if (!calendar || !editingItem) return;
    const updated = updateCalendarItemStatus(
      calendar,
      editingItem,
      ContentStatus.MODIFIED,
      editTitle
    );
    onCalendarUpdate(updated);
    setEditingItem(null);
    setEditTitle('');
  };

  const handleApproveAll = () => {
    if (!calendar) return;
    const updated = approveAllProposed(calendar);
    onCalendarUpdate(updated);
  };

  // Couleur du statut
  const getStatusColor = (status: ContentStatus) => {
    switch (status) {
      case ContentStatus.PROPOSED: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case ContentStatus.APPROVED: return 'bg-green-500/20 text-green-400 border-green-500/30';
      case ContentStatus.MODIFIED: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case ContentStatus.REJECTED: return 'bg-red-500/20 text-red-400 border-red-500/30';
      case ContentStatus.GENERATING: return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case ContentStatus.READY: return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case ContentStatus.PUBLISHING: return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case ContentStatus.PUBLISHED: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusLabel = (status: ContentStatus) => {
    switch (status) {
      case ContentStatus.PROPOSED: return 'Proposé';
      case ContentStatus.APPROVED: return 'Validé';
      case ContentStatus.MODIFIED: return 'Modifié';
      case ContentStatus.REJECTED: return 'Rejeté';
      case ContentStatus.GENERATING: return 'En cours...';
      case ContentStatus.READY: return 'Prêt';
      case ContentStatus.PUBLISHING: return 'Upload...';
      case ContentStatus.PUBLISHED: return 'Publié';
      default: return status;
    }
  };

  const getChannelById = (id: string) => channels.find(c => c.id === id);

  return (
    <div className="grow overflow-y-auto p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-indigo-400" />
            Calendrier Éditorial
          </h1>
          <p className="text-gray-400 mt-2">
            Planifiez et validez vos contenus pour le mois à venir
          </p>
        </div>

        {/* Controls */}
        <div className="bg-gray-800/50 rounded-2xl p-6 mb-6 border border-gray-700/50">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* Sélection du mois */}
            <div className="flex items-center gap-3">
              <label className="text-gray-400 text-sm">Mois cible :</label>
              <select
                value={selectedMonth.month}
                onChange={(e) => setSelectedMonth(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                aria-label="Sélectionner le mois"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx} value={idx + 1}>{name}</option>
                ))}
              </select>
              <select
                value={selectedMonth.year}
                onChange={(e) => setSelectedMonth(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                aria-label="Sélectionner l'année"
              >
                {[2025, 2026, 2027].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Filtre par chaîne */}
            <div className="flex items-center gap-3">
              <label className="text-gray-400 text-sm">Chaîne :</label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                aria-label="Filtrer par chaîne"
              >
                <option value="all">Toutes les chaînes</option>
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>{channel.name}</option>
                ))}
              </select>
            </div>

            {/* Bouton générer */}
            <button
              onClick={handleGenerateCalendar}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold rounded-xl transition-colors"
            >
              {isGenerating ? (
                <>
                  <RefreshIcon className="w-5 h-5 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5" />
                  Générer {monthNames[selectedMonth.month - 1]}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-20">
            <LoadingIndicator text={`Génération des idées pour ${channels.length} chaînes...`} />
            <p className="text-gray-500 mt-4 text-sm">
              L'IA génère 12 sujets par chaîne, cela peut prendre quelques secondes.
            </p>
          </div>
        )}

        {/* Stats */}
        {stats && !isGenerating && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {[
              { label: 'Total', value: stats.total, color: 'text-white' },
              { label: 'Proposés', value: stats.proposed, color: 'text-yellow-400' },
              { label: 'Validés', value: stats.approved, color: 'text-green-400' },
              { label: 'Rejetés', value: stats.rejected, color: 'text-red-400' },
              { label: 'Prêts', value: stats.ready, color: 'text-indigo-400' },
              { label: 'Publiés', value: stats.published, color: 'text-emerald-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700/50">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Bouton Tout Valider */}
        {stats && stats.proposed > 0 && !isGenerating && (
          <div className="mb-6 flex justify-end">
            <button
              onClick={handleApproveAll}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <CheckIcon className="w-4 h-4" />
              Tout valider ({stats.proposed})
            </button>
          </div>
        )}

        {/* Liste des items par chaîne */}
        {!isGenerating && channelEntries.length > 0 && (
          <div className="space-y-6">
            {channelEntries.map(([channelId, items]) => {
              const channel = getChannelById(channelId);
              if (!channel) return null;

              return (
                <div key={channelId} className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                  {/* Channel Header */}
                  <div className={`px-6 py-4 border-b border-gray-700/50 flex items-center gap-3`}>
                    <div className={`w-3 h-3 rounded-full ${channel.color.replace('text-', 'bg-')}`}></div>
                    <h2 className={`text-xl font-bold ${channel.color}`}>{channel.name}</h2>
                    <span className="text-gray-500 text-sm">({items.length} vidéos)</span>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-gray-700/30">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className={`p-4 md:p-6 hover:bg-gray-700/20 transition-colors ${
                          item.status === ContentStatus.REJECTED ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                          {/* Numéro et Date */}
                          <div className="flex items-center gap-4 md:w-32 shrink-0">
                            <span className="text-gray-600 font-mono text-sm">#{index + 1}</span>
                            {item.scheduledDate && (
                              <span className="text-gray-400 text-sm">
                                {new Date(item.scheduledDate).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </span>
                            )}
                          </div>

                          {/* Contenu */}
                          <div className="grow">
                            {editingItem === item.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="grow bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                  aria-label="Modifier le titre"
                                  autoFocus
                                />
                                <button
                                  onClick={handleSaveEdit}
                                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                                >
                                  OK
                                </button>
                                <button
                                  onClick={() => setEditingItem(null)}
                                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <>
                                <h3 className="text-white font-medium">{item.title}</h3>
                                <p className="text-gray-400 text-sm mt-1">{item.description}</p>
                                {item.originalTitle && (
                                  <p className="text-gray-600 text-xs mt-1 italic">
                                    Original: {item.originalTitle}
                                  </p>
                                )}
                              </>
                            )}
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                              {getStatusLabel(item.status)}
                            </span>
                          </div>

                          {/* Actions */}
                          {editingItem !== item.id && (
                            <div className="flex items-center gap-2 shrink-0">
                              {item.status === ContentStatus.PROPOSED && (
                                <>
                                  <button
                                    onClick={() => handleApprove(item.id)}
                                    className="p-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg transition-colors"
                                    title="Valider"
                                    aria-label="Valider ce sujet"
                                  >
                                    <CheckIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleStartEdit(item)}
                                    className="p-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg transition-colors"
                                    title="Modifier"
                                    aria-label="Modifier ce sujet"
                                  >
                                    <EditIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleReject(item.id)}
                                    className="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
                                    title="Rejeter"
                                    aria-label="Rejeter ce sujet"
                                  >
                                    <XIcon className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {(item.status === ContentStatus.APPROVED || item.status === ContentStatus.MODIFIED) && (
                                <button
                                  onClick={() => {
                                    setGeneratingItems(prev => new Set(prev).add(item.id));
                                    onGenerateVideo(item);
                                  }}
                                  disabled={generatingItems.has(item.id)}
                                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-wait text-white rounded-lg transition-colors text-sm"
                                  aria-label="Générer la vidéo"
                                >
                                  {generatingItems.has(item.id) ? (
                                    <>
                                      <RefreshIcon className="w-4 h-4 animate-spin" />
                                      Génération...
                                    </>
                                  ) : (
                                    <>
                                      <PlayIcon className="w-4 h-4" />
                                      Générer
                                    </>
                                  )}
                                </button>
                              )}
                              {item.status === ContentStatus.GENERATING && (
                                <span className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg text-sm">
                                  <RefreshIcon className="w-4 h-4 animate-spin" />
                                  En cours...
                                </span>
                              )}
                              {item.status === ContentStatus.READY && (
                                <>
                                  <span className="flex items-center gap-2 px-3 py-2 bg-green-600/20 text-green-400 rounded-lg text-sm">
                                    <CheckIcon className="w-4 h-4" />
                                    Prêt
                                  </span>
                                  
                                  {/* Bouton Prévisualiser */}
                                  {item.generatedAsset?.videoUrl && (
                                    <button
                                      onClick={() => setPreviewVideo(item.generatedAsset!.videoUrl)}
                                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                                      aria-label="Prévisualiser la vidéo"
                                    >
                                      <PlayIcon className="w-4 h-4" />
                                      Prévisualiser
                                    </button>
                                  )}
                                  
                                  {isChannelConnected(item.channelId) && onUploadVideo ? (
                                    <button
                                      onClick={() => onUploadVideo(item)}
                                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                                      aria-label="Publier sur YouTube"
                                    >
                                      <UploadCloudIcon className="w-4 h-4" />
                                      Publier
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-500">
                                      Connectez la chaîne pour publier
                                    </span>
                                  )}
                                </>
                              )}
                              {item.status === ContentStatus.PUBLISHING && (
                                <span className="flex items-center gap-2 px-3 py-2 bg-orange-600/20 text-orange-400 rounded-lg text-sm">
                                  <div className="w-4 h-4 border-2 border-t-transparent border-orange-400 rounded-full animate-spin"></div>
                                  Upload en cours...
                                </span>
                              )}
                              {item.status === ContentStatus.PUBLISHED && (
                                <span className="flex items-center gap-2 px-3 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg text-sm">
                                  <CheckIcon className="w-4 h-4" />
                                  Publié ✓
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isGenerating && (!calendar || calendar.items.length === 0) && (
          <div className="text-center py-20">
            <CalendarIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-400 mb-2">
              Aucun calendrier généré
            </h3>
            <p className="text-gray-500 mb-6">
              Sélectionnez un mois et cliquez sur "Générer" pour créer votre calendrier éditorial.
            </p>
            <button
              onClick={handleGenerateCalendar}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
            >
              <SparklesIcon className="w-5 h-5" />
              Générer mon premier calendrier
            </button>
          </div>
        )}
      </div>

      {/* Modal de prévisualisation vidéo */}
      {previewVideo && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewVideo(null)}
        >
          <div 
            className="bg-gray-900 rounded-2xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">📺 Prévisualisation de la vidéo</h3>
              <button
                onClick={() => setPreviewVideo(null)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Fermer la prévisualisation"
                aria-label="Fermer la prévisualisation"
              >
                <XIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center bg-black">
              <video
                src={previewVideo}
                controls
                autoPlay
                className="max-w-full max-h-[70vh] rounded-lg aspect-video"
              >
                Votre navigateur ne supporte pas la lecture vidéo.
              </video>
            </div>
            <div className="p-4 border-t border-gray-800 flex justify-between items-center">
              <span className="text-sm text-gray-400">
                Vérifiez la qualité avant de publier sur YouTube
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setPreviewVideo(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Fermer
                </button>
                <a
                  href={previewVideo}
                  download="video-preview.webm"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  📥 Télécharger
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentCalendarView;
