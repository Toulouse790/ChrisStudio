import { Channel } from '../types/index.js';

export const channels: Record<string, Channel> = {
  'what-if': {
    id: 'what-if',
    name: 'What If...',
    description: 'Hypothetical scenarios and future possibilities',
    style: {
      theme: 'sci-fi',
      musicGenre: 'epic-cinematic',
      visualStyle: 'futuristic-conceptual',
      colorGrading: 'blue-orange'
    },
    voice: {
      language: 'en-US',
      voice: 'en-US-GuyNeural', // Professional male voice
      rate: '+5%',
      pitch: '+0Hz'
    }
  },
  'human-odyssey': {
    id: 'human-odyssey',
    name: 'The Human Odyssey',
    description: 'History and civilization exploration',
    style: {
      theme: 'historical',
      musicGenre: 'orchestral',
      visualStyle: 'documentary-classic',
      colorGrading: 'warm-vintage'
    },
    voice: {
      language: 'en-GB',
      voice: 'en-GB-RyanNeural', // British narrator
      rate: '+0%',
      pitch: '+0Hz'
    }
  },
  'classified-files': {
    id: 'classified-files',
    name: 'Classified Files',
    description: 'Mysteries and unexplained phenomena',
    style: {
      theme: 'mysterious',
      musicGenre: 'dark-ambient',
      visualStyle: 'noir-documentary',
      colorGrading: 'desaturated-cold'
    },
    voice: {
      language: 'en-US',
      voice: 'en-US-ChristopherNeural', // Reliable authority voice
      rate: '-5%',
      pitch: '+0Hz'
    }
  }
};
