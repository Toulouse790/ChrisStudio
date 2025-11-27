/**
 * ChrisStudio - Plateforme de Création Vidéo IA
 * © 2025 Toulouse790. Tous droits réservés.
 */
import React, {useState, useEffect} from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
import {
  LayoutDashboardIcon,
  VideoIcon,
  LibraryIcon,
  SettingsIcon,
  MenuIcon,
  XMarkIcon,
  CalendarIcon,
} from './components/icons';
import Dashboard from './components/Dashboard';
import CreatorStudio from './components/CreatorStudio';
import AssetsSettings from './components/AssetsSettings';
import TemplateManager from './components/TemplateManager';
import ContentCalendarView from './components/ContentCalendar';
import {View, WatermarkSettings, IntroOutroSettings, Channel, GeneratedAsset, Template, MusicTrack, AppSettings, ContentCalendar, CalendarItem} from './types';

const STORAGE_KEY = 'chrisstudio_settings_v2';

const DEFAULT_CHANNELS: Channel[] = [
    {
      id: 'etsi',
      name: "Et Si...",
      theme: "Scénarios alternatifs, hypothèses historiques et scientifiques, expériences de pensée.",
      color: "text-cyan-500",
      connected: false,
      rpm: 0, 
      avgViews: 0
    },
    {
      id: 'odyssee',
      name: "L'Odyssée Humaine",
      theme: "Histoire de l'humanité, grandes civilisations, moments clés de notre évolution.",
      color: "text-amber-500",
      connected: false,
      rpm: 0, 
      avgViews: 0
    },
    {
      id: 'dossiers',
      name: "Dossiers Classifiés",
      theme: "Mystères, affaires non résolues, secrets historiques, enquêtes fascinantes.",
      color: "text-purple-500",
      connected: false,
      rpm: 0, 
      avgViews: 0
    }
];

const DEFAULT_TEMPLATES: Template[] = [
    {
        id: 'tpl_1',
        name: 'What If Scientifique',
        description: 'Format hypothèse scientifique avec suspense et révélations progressives.',
        channelId: 'etsi',
        niche: 'Et si la Terre s\'arrêtait de tourner',
        format: 'long-form',
        language: 'fr',
        isSeries: false
    },
    {
        id: 'tpl_2',
        name: 'Documentaire Préhistoire',
        description: 'Format chronologique pour raconter l\'évolution humaine étape par étape.',
        channelId: 'odyssee',
        niche: 'Les premiers Homo Sapiens',
        format: 'long-form',
        language: 'fr',
        isSeries: true
    },
    {
        id: 'tpl_3',
        name: 'Affaire Non Résolue',
        description: 'Format enquête True Crime avec suspense et analyse des indices.',
        channelId: 'dossiers',
        niche: 'Jack l\'Eventreur',
        format: 'long-form',
        language: 'fr',
        isSeries: false
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
  
  // State
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [watermarkSettings, setWatermarkSettings] = useState<WatermarkSettings>(DEFAULT_WATERMARK);
  
  // Non-persisted State (Files)
  const [projects, setProjects] = useState<GeneratedAsset[]>([]);
  const [introOutroSettings, setIntroOutroSettings] = useState<IntroOutroSettings>({
    intro: { enabled: false, file: null, previewUrl: null },
    outro: { enabled: false, file: null, previewUrl: null }
  });
  const [musicLibrary, setMusicLibrary] = useState<MusicTrack[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [calendar, setCalendar] = useState<ContentCalendar | null>(null);
  const [calendarItemToGenerate, setCalendarItemToGenerate] = useState<CalendarItem | null>(null);

  // Load Settings from LocalStorage on Mount
  useEffect(() => {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
          try {
              const parsed: AppSettings = JSON.parse(savedData);
              if (parsed.channels) setChannels(parsed.channels);
              if (parsed.templates) setTemplates(parsed.templates);
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
          templates,
          watermarkSettings,
          calendar: calendar ?? undefined
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
  }, [channels, templates, watermarkSettings, calendar]);

  // Check for API key on initial load
  useEffect(() => {
    const checkApiKey = () => {
      const storedApiKey = localStorage.getItem('AI_API_KEY');
      if (!storedApiKey) {
        setShowApiKeyDialog(true);
      }
    };
    checkApiKey();
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
  
  const handleUseTemplate = (template: Template) => {
      setSelectedTemplate(template);
      setCurrentView(View.STUDIO);
  };
  
  const handleSaveTemplate = (newTemplate: Template) => {
      setTemplates(prev => [...prev, newTemplate]);
  };
  
  const handleDeleteTemplate = (id: string) => {
      setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleCalendarUpdate = (updatedCalendar: ContentCalendar) => {
    setCalendar(updatedCalendar);
  };

  const handleGenerateFromCalendar = (item: CalendarItem) => {
    // Créer un template temporaire à partir de l'item du calendrier
    const channel = channels.find(c => c.id === item.channelId);
    if (channel) {
      const tempTemplate: Template = {
        id: `cal_${item.id}`,
        name: item.title,
        description: item.description,
        channelId: item.channelId,
        niche: item.title,
        format: 'long-form',
        language: 'fr',
        isSeries: false,
      };
      setSelectedTemplate(tempTemplate);
      setCurrentView(View.STUDIO);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleNavClick = (view: View) => {
    if (view === View.STUDIO) {
        setSelectedTemplate(null);
    }
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
            view={View.STUDIO}
            icon={VideoIcon}
            label="Studio de création"
          />
          <NavItem
            view={View.TEMPLATES}
            icon={LibraryIcon}
            label="Modèles"
          />
          <NavItem
            view={View.ASSETS}
            icon={SettingsIcon}
            label="Ressources & Paramètres"
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
            />
        )}
        {currentView === View.CALENDAR && (
          <ContentCalendarView
            channels={channels}
            calendar={calendar}
            onCalendarUpdate={handleCalendarUpdate}
            onGenerateVideo={handleGenerateFromCalendar}
          />
        )}
        {currentView === View.STUDIO && (
          <CreatorStudio 
            watermarkSettings={watermarkSettings} 
            introOutroSettings={introOutroSettings}
            musicLibrary={musicLibrary}
            channels={channels}
            onProjectCreated={handleProjectCreated}
            initialTemplate={selectedTemplate}
            onSaveTemplate={handleSaveTemplate}
          />
        )}
        {currentView === View.TEMPLATES && (
          <TemplateManager 
              templates={templates}
              channels={channels}
              onUseTemplate={handleUseTemplate}
              onDeleteTemplate={handleDeleteTemplate}
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
  );
};

export default App;
