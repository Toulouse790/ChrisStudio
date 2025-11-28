/**
 * ChrisStudio - Plateforme de Création Vidéo IA
 * © 2025 Toulouse790. Tous droits réservés.
 */
import React, {useState, useEffect, useCallback} from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
import {
  LayoutDashboardIcon,
  SettingsIcon,
  MenuIcon,
  XMarkIcon,
  CalendarIcon,
} from './components/icons';
import Dashboard from './components/Dashboard';
import AssetsSettings from './components/AssetsSettings';
import ContentCalendarView from './components/ContentCalendar';
import OAuthCallback from './components/OAuthCallback';
import {View, WatermarkSettings, IntroOutroSettings, Channel, GeneratedAsset, MusicTrack, AppSettings, ContentCalendar, CalendarItem, ContentStatus} from './types';
import { generateVideo, GeneratedVideo } from './services/videoGenerationService';
import { uploadVideo as uploadToYouTube, isChannelConnected, getValidAccessToken } from './services/youtubeService';

const STORAGE_KEY = 'chrisstudio_settings_v2';

const DEFAULT_CHANNELS: Channel[] = [
    {
      id: 'etsi',
      youtubeChannelId: 'UCg5KvEQBZ90dsk5O0lXlqeg',
      youtubeHandle: '@EtSi-official',
      name: "Et Si...",
      theme: "Scénarios alternatifs, hypothèses historiques et scientifiques, expériences de pensée.",
      color: "text-cyan-500",
      connected: false,
      rpm: 0, 
      avgViews: 0
    },
    {
      id: 'odyssee',
      youtubeChannelId: 'UCWzrIQhDt6IKyVHroDoRWGw',
      youtubeHandle: '@LOdysseeHumaine',
      name: "L'Odyssée Humaine",
      theme: "Histoire de l'humanité, grandes civilisations, moments clés de notre évolution.",
      color: "text-amber-500",
      connected: false,
      rpm: 0, 
      avgViews: 0
    },
    {
      id: 'dossiers',
      youtubeChannelId: 'UCp3fqxkp3kgFJu33gpdcUtA',
      youtubeHandle: '@DossiersClassifies',
      name: "Dossiers Classifiés",
      theme: "Mystères, affaires non résolues, secrets historiques, enquêtes fascinantes.",
      color: "text-purple-500",
      connected: false,
      rpm: 0, 
      avgViews: 0
    }
];

const DEFAULT_WATERMARK: WatermarkSettings = {
    enabled: false,
    dataUrl: null,
    position: 'bottom-right',
    opacity: 0.8,
    scale: 0.15
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);
  
  // State
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [watermarkSettings, setWatermarkSettings] = useState<WatermarkSettings>(DEFAULT_WATERMARK);
  
  // Non-persisted State (Files)
  const [projects, setProjects] = useState<GeneratedAsset[]>([]);
  const [introOutroSettings, setIntroOutroSettings] = useState<IntroOutroSettings>({
    intro: { enabled: false, file: null, previewUrl: null },
    outro: { enabled: false, file: null, previewUrl: null }
  });
  const [musicLibrary, setMusicLibrary] = useState<MusicTrack[]>([]);
  const [calendar, setCalendar] = useState<ContentCalendar | null>(null);

  // Load Settings from LocalStorage on Mount
  useEffect(() => {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
          try {
              const parsed: AppSettings = JSON.parse(savedData);
              if (parsed.channels) setChannels(parsed.channels);
              if (parsed.watermarkSettings) setWatermarkSettings(parsed.watermarkSettings);
              if (parsed.calendar) setCalendar(parsed.calendar);
          } catch (e) {
              console.error("Failed to load settings", e);
          }
      }
  }, []);

  // Save Settings to LocalStorage on Change
  useEffect(() => {
      const settingsToSave: AppSettings = {
          channels,
          watermarkSettings,
          calendar: calendar ?? undefined
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
  }, [channels, watermarkSettings, calendar]);

  // Check for API key on initial load
  useEffect(() => {
    const checkApiKey = () => {
      // Check environment variable first (for Vercel deployment)
      const envApiKey = import.meta.env.VITE_API_KEY;
      if (envApiKey) {
        // API key is configured via environment, no need to show dialog
        return;
      }
      
      // Fallback to localStorage for local development
      const storedApiKey = localStorage.getItem('AI_API_KEY');
      if (!storedApiKey) {
        setShowApiKeyDialog(true);
      }
    };
    checkApiKey();
    
    // Check if this is an OAuth callback
    if (window.location.pathname === '/oauth/callback') {
      setIsOAuthCallback(true);
    }
  }, []);

  const handleApiKeyDialogContinue = async () => {
    setShowApiKeyDialog(false);
  };

  const handleProjectCreated = (newProject: GeneratedAsset) => {
    setProjects(prev => [newProject, ...prev]);
  };

  const handleUpdateChannels = (updatedChannels: Channel[]) => {
    setChannels(updatedChannels);
  };

  const handleChannelConnectionChange = (channelId: string, connected: boolean) => {
    setChannels(prev => prev.map(ch => 
      ch.id === channelId ? { ...ch, connected } : ch
    ));
  };

  const handleCalendarUpdate = (updatedCalendar: ContentCalendar) => {
    setCalendar(updatedCalendar);
  };

  // Store generated videos for upload
  const [generatedVideos, setGeneratedVideos] = useState<Map<string, GeneratedVideo>>(new Map());

  const handleGenerateFromCalendar = useCallback(async (item: CalendarItem) => {
    // Find the channel for this item
    const channel = channels.find(c => c.id === item.channelId);
    if (!channel) {
      console.error('Channel not found:', item.channelId);
      return;
    }

    // Update status to generating
    if (calendar) {
      const updatedItems = calendar.items.map(i => 
        i.id === item.id ? { ...i, status: ContentStatus.GENERATING } : i
      );
      setCalendar({ ...calendar, items: updatedItems });
    }

    try {
      // Generate the video content (now generates REAL video)
      const generatedVideo = await generateVideo(
        item,
        channel,
        (progress) => {
          console.log(`[${item.title}] ${progress.message} (${progress.progress}%)`);
          // Could update UI with progress here
        }
      );

      // Store generated video for later upload
      setGeneratedVideos(prev => new Map(prev).set(item.id, generatedVideo));

      // Create a project from the generated video
      const newProject: GeneratedAsset = {
        id: generatedVideo.id,
        channelName: channel.name,
        thumbnailImage: generatedVideo.thumbnailUrl || null,
        videoUrl: generatedVideo.finalVideoUrl || '',
        timestamp: new Date(),
        metadata: {
          title: item.title,
          description: item.description,
          tags: [],
          thumbnailIdea: `Miniature accrocheuse pour: ${item.title}`,
          script: generatedVideo.script,
        },
      };

      setProjects(prev => [newProject, ...prev]);

      // Update calendar item status to ready
      if (calendar) {
        const updatedItems = calendar.items.map(i => 
          i.id === item.id ? { ...i, status: ContentStatus.READY } : i
        );
        setCalendar({ ...calendar, items: updatedItems });
      }

      console.log('✅ Vidéo générée avec succès:', {
        title: item.title,
        hasVideo: !!generatedVideo.videoBlob,
        hasThumbnail: !!generatedVideo.thumbnailBlob,
        hasVoiceover: !!generatedVideo.voiceoverBlob
      });
      
    } catch (error) {
      console.error('❌ Erreur génération vidéo:', error);
      
      // Update status to error (back to approved for retry)
      if (calendar) {
        const updatedItems = calendar.items.map(i => 
          i.id === item.id ? { ...i, status: ContentStatus.APPROVED } : i
        );
        setCalendar({ ...calendar, items: updatedItems });
      }
    }
  }, [channels, calendar]);

  // Handle YouTube upload for a calendar item
  const handleUploadToYouTube = useCallback(async (item: CalendarItem) => {
    const channel = channels.find(c => c.id === item.channelId);
    if (!channel) {
      alert('Chaîne non trouvée');
      return;
    }

    if (!isChannelConnected(channel.id)) {
      alert('Chaîne non connectée à YouTube. Connectez-vous d\'abord dans les paramètres.');
      return;
    }

    const generatedVideo = generatedVideos.get(item.id);
    if (!generatedVideo || !generatedVideo.videoBlob) {
      alert('Aucune vidéo générée. Générez d\'abord la vidéo.');
      return;
    }

    // Update status to publishing
    if (calendar) {
      const updatedItems = calendar.items.map(i => 
        i.id === item.id ? { ...i, status: ContentStatus.PUBLISHING } : i
      );
      setCalendar({ ...calendar, items: updatedItems });
    }

    try {
      const result = await uploadToYouTube(
        {
          title: item.title,
          description: item.description,
          tags: ['IA', 'Automatisé', channel.name],
          categoryId: '22',
          privacyStatus: 'private', // Start as private for review
          videoFile: generatedVideo.videoBlob,
          thumbnailFile: generatedVideo.thumbnailBlob,
          channelId: channel.id,
        },
        (progress) => {
          console.log(`Upload: ${progress.percentage}% - ${progress.status}`);
        }
      );

      if (result.success) {
        console.log('✅ Upload réussi! Video ID:', result.videoId);
        
        // Update status to published
        if (calendar) {
          const updatedItems = calendar.items.map(i => 
            i.id === item.id ? { ...i, status: ContentStatus.PUBLISHED } : i
          );
          setCalendar({ ...calendar, items: updatedItems });
        }
        
        alert(`Vidéo uploadée avec succès!\nID: ${result.videoId}\nStatut: Privée (vérifiez avant de publier)`);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ Erreur upload:', error);
      
      // Revert status to ready
      if (calendar) {
        const updatedItems = calendar.items.map(i => 
          i.id === item.id ? { ...i, status: ContentStatus.READY } : i
        );
        setCalendar({ ...calendar, items: updatedItems });
      }
      
      alert(`Erreur d'upload: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }, [channels, calendar, generatedVideos]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    setIsSidebarOpen(false); 
  };

  const NavItem = ({
    view,
    icon: Icon,
    label,
  }: {
    view: View;
    icon: any;
    label: string;
  }) => (
    <button
      onClick={() => handleNavClick(view)}
      className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg transition-all duration-200 ${
        currentView === view
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
      }`}>
      <Icon className="w-5 h-5 shrink-0" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <>
      {/* OAuth Callback Handler */}
      {isOAuthCallback && (
        <OAuthCallback 
          onSuccess={() => setIsOAuthCallback(false)}
          onError={() => setIsOAuthCallback(false)}
        />
      )}
      
      {!isOAuthCallback && (
    <div className="h-screen bg-black text-gray-200 flex font-sans overflow-hidden">
      {showApiKeyDialog && (
        <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />
      )}

      {/* Mobile Header with Safe Area for PWA */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0f0f0f] border-b border-gray-800 z-40 flex items-center px-4 justify-between pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-linear-to-tr from-indigo-500 to-purple-500 rounded-lg shadow-indigo-500/20 shadow-lg"></div>
          <h1 className="text-lg font-bold bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            ChrisStudio
          </h1>
        </div>
        <button onClick={toggleSidebar} className="p-2 text-gray-400 hover:text-white">
          {isSidebarOpen ? <XMarkIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#0f0f0f] border-r border-gray-800 flex flex-col p-4 transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        mt-16 md:mt-0 pt-[env(safe-area-inset-top)] md:pt-4
      `}>
        {/* Desktop Logo (Hidden on mobile) */}
        <div className="hidden md:flex mb-8 px-2 items-center gap-2">
          <div className="w-8 h-8 bg-linear-to-tr from-indigo-500 to-purple-500 rounded-lg shadow-indigo-500/20 shadow-lg"></div>
          <h1 className="text-xl font-bold bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            ChrisStudio
          </h1>
        </div>

        <nav className="grow space-y-2">
          <NavItem
            view={View.DASHBOARD}
            icon={LayoutDashboardIcon}
            label="Tableau de bord"
          />
          <NavItem
            view={View.CALENDAR}
            icon={CalendarIcon}
            label="Calendrier"
          />
          <NavItem
            view={View.ASSETS}
            icon={SettingsIcon}
            label="Paramètres"
          />
        </nav>

        <div className="pt-4 border-t border-gray-800 mt-auto mb-20 md:mb-0">
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
            <p className="text-xs text-gray-500">Forfait Actuel</p>
            <p className="text-sm font-semibold text-indigo-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                Créateur Pro
            </p>
            <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-indigo-500 h-full w-3/4"></div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 text-right">
              Session en cours
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="grow flex flex-col bg-[#050505] overflow-hidden relative pt-16 md:pt-0 h-dvh">
        <div className="absolute top-0 left-0 w-full h-64 bg-indigo-900/10 blur-3xl pointer-events-none"></div>

        {currentView === View.DASHBOARD && (
            <Dashboard 
                onViewChange={handleNavClick} 
                channels={channels} 
                projects={projects}
                onChannelConnectionChange={handleChannelConnectionChange}
            />
        )}
        {currentView === View.CALENDAR && (
          <ContentCalendarView
            channels={channels}
            calendar={calendar}
            onCalendarUpdate={handleCalendarUpdate}
            onGenerateVideo={handleGenerateFromCalendar}
            onUploadVideo={handleUploadToYouTube}
            onProjectCreated={handleProjectCreated}
            watermarkSettings={watermarkSettings}
            introOutroSettings={introOutroSettings}
            musicLibrary={musicLibrary}
          />
        )}
        {currentView === View.ASSETS && (
           <AssetsSettings 
             watermarkSettings={watermarkSettings} 
             onUpdateSettings={setWatermarkSettings}
             introOutroSettings={introOutroSettings}
             onUpdateIntroOutro={setIntroOutroSettings}
             musicLibrary={musicLibrary}
             onUpdateMusicLibrary={setMusicLibrary}
             channels={channels}
             onUpdateChannels={handleUpdateChannels}
           />
        )}
      </main>
    </div>
      )}
    </>
  );
};

export default App;
