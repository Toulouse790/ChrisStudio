
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import {View, Channel, GeneratedAsset} from '../types';
import {ArrowRightIcon, PlusIcon, VideoIcon, FilmIcon} from './icons';
import {YouTubeConnectionButton} from './YouTubeConnection';

interface DashboardProps {
    onViewChange: (view: View) => void;
    channels: Channel[];
    projects: GeneratedAsset[];
    onChannelConnectionChange?: (channelId: string, connected: boolean) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  onViewChange,
  channels,
  projects,
  onChannelConnectionChange
}) => {
  const totalVideos = projects.length;

  // Calculate Stats based on Channel Performance Estimates
  let totalEstimatedViews = 0;
  let totalEstimatedRevenue = 0;

  projects.forEach(project => {
      const channel = channels.find(c => c.name === project.channelName);
      if (channel && channel.avgViews && channel.rpm) {
          totalEstimatedViews += channel.avgViews;
          totalEstimatedRevenue += (channel.avgViews / 1000) * channel.rpm;
      }
  });

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-primary">Tableau de bord</h2>
          <p className="text-sm md:text-base text-muted mt-1">
            Gérez vos chaînes et suivez votre production de session.
          </p>
        </div>
        <button
          onClick={() => onViewChange(View.CALENDAR)}
          className="btn-primary w-full md:w-auto">
          <PlusIcon className="w-5 h-5" />
          Voir le calendrier
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
        <div className="stat-card">
          <div className="stat-card-glow glow-primary"></div>
          <h4 className="text-muted text-xs font-medium uppercase tracking-wider mb-2">
            Vidéos Créées (Session)
          </h4>
          <p className="stat-value">{totalVideos}</p>
          <span className="badge badge-primary mt-2">
            Prêtes à exporter
          </span>
        </div>
        <div className="stat-card">
          <div className="stat-card-glow glow-accent"></div>
          <h4 className="text-muted text-xs font-medium uppercase tracking-wider mb-2">
            Vues Projetées
          </h4>
          <p className="stat-value">{totalEstimatedViews.toLocaleString()}</p>
          <span className="text-muted text-xs mt-2 block">
            Basé sur la moyenne de vos niches
          </span>
        </div>
        <div className="stat-card">
          <div className="stat-card-glow glow-success"></div>
          <h4 className="text-muted text-xs font-medium uppercase tracking-wider mb-2">
            Revenu Potentiel
          </h4>
          <p className="stat-value">{totalEstimatedRevenue.toFixed(2)} €</p>
          <span className="badge badge-success mt-2">
            Estimation RPM combinée
          </span>
        </div>
      </div>

      {/* Channels Overview */}
      <div className="mb-8 md:mb-12">
        <h3 className="text-xl font-bold text-primary mb-4 md:mb-6 flex items-center gap-2">
          <span className="w-1 h-6 bg-linear-to-b from-indigo-500 to-purple-500 rounded-full"></span>
          Vos Chaînes Actives
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {channels.map(channel => {
                const channelClass = channel.name.includes('Et Si') ? 'channel-etsi' : 
                                    channel.name.includes('Odyssée') ? 'channel-odyssee' : 
                                    channel.name.includes('Dossiers') ? 'channel-dossiers' : '';
                return (
                <div key={channel.id} className={`channel-card glass-card ${channelClass}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-bold text-primary">{channel.name}</div>
                      {channel.youtubeHandle && (
                        <span className="text-[10px] text-muted font-mono bg-surface px-2 py-1 rounded">{channel.youtubeHandle}</span>
                      )}
                    </div>
                    <p className="text-xs text-secondary h-10 line-clamp-2 mb-4">{channel.theme}</p>
                    
                    {/* YouTube Connection */}
                    <div className="mb-4 pb-4 border-b border-default">
                      <YouTubeConnectionButton 
                        channel={channel}
                        onConnectionChange={(id, connected) => onChannelConnectionChange?.(id, connected)}
                      />
                    </div>
                    
                    <div className="flex justify-between items-end">
                        <div className="text-xs">
                             <span className="block text-[10px] uppercase text-muted tracking-wider mb-1">RPM Moyen</span>
                             <span className="font-mono text-primary font-bold">{channel.rpm} €</span>
                        </div>
                        <div className="text-xs text-right">
                             <span className="block text-[10px] uppercase text-muted tracking-wider mb-1">Vues/Vidéo</span>
                             <span className="font-mono text-primary font-bold">{channel.avgViews?.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )})}
        </div>
      </div>

      {/* Recent Production (Real Data) */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-primary flex items-center gap-2">
            <span className="w-1 h-6 bg-linear-to-b from-purple-500 to-pink-500 rounded-full"></span>
            Production Récente
          </h3>
        </div>

        <div className="space-y-3">
          {projects.length === 0 ? (
              <div className="text-center py-16 glass-panel border-dashed px-4">
                  <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
                    <FilmIcon className="w-8 h-8 text-muted" />
                  </div>
                  <p className="text-secondary mb-2">Aucune vidéo créée dans cette session.</p>
                  <button 
                    onClick={() => onViewChange(View.CALENDAR)}
                    className="btn-ghost text-sm"
                  >
                      Planifier des vidéos →
                  </button>
              </div>
          ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 glass-card hover:bg-surface-hover transition-all group gap-4">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-20 h-11 bg-black rounded-xl overflow-hidden shrink-0 border border-default shadow-lg">
                         {project.thumbnailImage ? (
                             <img src={project.thumbnailImage} alt={project.metadata.title} className="w-full h-full object-cover" />
                         ) : (
                             <div className="w-full h-full flex items-center justify-center bg-surface">
                               <VideoIcon className="w-5 h-5 text-muted"/>
                             </div>
                         )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-primary line-clamp-1 group-hover:text-white transition-colors">{project.metadata.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted mt-1">
                          <span className="text-primary-light">{project.channelName}</span>
                          {project.metadata.episodeNumber && (
                              <span className="badge badge-accent text-[10px]">Épisode {project.metadata.episodeNumber}</span>
                          )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full md:w-auto gap-6">
                    <div className="text-left md:text-right">
                      <span className="badge badge-success">
                        Prêt
                      </span>
                      <p className="text-xs text-muted mt-1">{new Date(project.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
