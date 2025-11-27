
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
    <div className="p-4 md:p-8 h-full overflow-y-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">Tableau de bord</h2>
          <p className="text-sm md:text-base text-gray-400 mt-1">
            Gérez vos chaînes et suivez votre production de session.
          </p>
        </div>
        <button
          onClick={() => onViewChange(View.STUDIO)}
          className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20">
          <PlusIcon className="w-5 h-5" />
          Créer une vidéo
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
        <div className="bg-[#1f1f1f] p-5 md:p-6 rounded-xl border border-gray-800">
          <h4 className="text-gray-500 text-sm font-medium uppercase">
            Vidéos Créées (Session)
          </h4>
          <p className="text-3xl font-bold text-white mt-2">{totalVideos}</p>
          <span className="text-indigo-400 text-xs font-medium mt-1 block">
            Prêtes à exporter
          </span>
        </div>
        <div className="bg-[#1f1f1f] p-5 md:p-6 rounded-xl border border-gray-800">
          <h4 className="text-gray-500 text-sm font-medium uppercase">
            Vues Projetées
          </h4>
          <p className="text-3xl font-bold text-white mt-2">{totalEstimatedViews.toLocaleString()}</p>
          <span className="text-gray-500 text-xs font-medium mt-1 block">
            Basé sur la moyenne de vos niches
          </span>
        </div>
        <div className="bg-[#1f1f1f] p-5 md:p-6 rounded-xl border border-gray-800">
          <h4 className="text-gray-500 text-sm font-medium uppercase">
            Revenu Potentiel
          </h4>
          <p className="text-3xl font-bold text-white mt-2">{totalEstimatedRevenue.toFixed(2)} €</p>
          <span className="text-green-500 text-xs font-medium mt-1 block">
            Estimation RPM combinée
          </span>
        </div>
      </div>

      {/* Channels Overview */}
      <div className="mb-8 md:mb-12">
        <h3 className="text-xl font-bold text-white mb-4 md:mb-6">Vos Chaînes Actives</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {channels.map(channel => (
                <div key={channel.id} className="bg-[#161616] p-5 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-sm font-bold ${channel.color}`}>{channel.name}</div>
                      {channel.youtubeHandle && (
                        <span className="text-[10px] text-gray-500 font-mono">{channel.youtubeHandle}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 h-10 line-clamp-2 mb-3">{channel.theme}</p>
                    
                    {/* YouTube Connection */}
                    <div className="mb-3 pb-3 border-b border-gray-800">
                      <YouTubeConnectionButton 
                        channel={channel}
                        onConnectionChange={(id, connected) => onChannelConnectionChange?.(id, connected)}
                      />
                    </div>
                    
                    <div className="flex justify-between items-end">
                        <div className="text-xs text-gray-400">
                             <span className="block text-[10px] uppercase">RPM Moyen</span>
                             <span className="font-mono">{channel.rpm} €</span>
                        </div>
                        <div className="text-xs text-gray-400 text-right">
                             <span className="block text-[10px] uppercase">Vues/Vidéo</span>
                             <span className="font-mono">{channel.avgViews?.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="absolute bottom-0 left-0 w-full bg-gray-800 h-1">
                         <div className={`h-full w-full opacity-50 ${channel.color.replace('text-', 'bg-')}`}></div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Recent Production (Real Data) */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Production Récente</h3>
        </div>

        <div className="space-y-4">
          {projects.length === 0 ? (
              <div className="text-center py-12 bg-[#161616] rounded-xl border border-gray-800 border-dashed px-4">
                  <FilmIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Aucune vidéo créée dans cette session.</p>
                  <button 
                    onClick={() => onViewChange(View.STUDIO)}
                    className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                  >
                      Commencer une nouvelle création
                  </button>
              </div>
          ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-[#161616] hover:bg-[#1f1f1f] rounded-xl border border-gray-800 transition-colors group gap-4">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-16 h-9 bg-black rounded-lg overflow-hidden shrink-0 border border-gray-800">
                         {project.thumbnailImage ? (
                             <img src={project.thumbnailImage} alt={project.metadata.title} className="w-full h-full object-cover" />
                         ) : (
                             <div className="w-full h-full flex items-center justify-center text-gray-600"><VideoIcon className="w-4 h-4"/></div>
                         )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-gray-200 line-clamp-1">{project.metadata.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="text-indigo-400">{project.channelName}</span>
                          {project.metadata.episodeNumber && (
                              <span className="bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded border border-purple-900/50">Épisode {project.metadata.episodeNumber}</span>
                          )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full md:w-auto gap-6">
                    <div className="text-left md:text-right">
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-900/30 text-green-400">
                        Prêt
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{new Date(project.timestamp).toLocaleTimeString()}</p>
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
