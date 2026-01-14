import { Channel } from '../types/index.js';

export const channels: Record<string, Channel> = {
  'what-if': {
    id: 'what-if',
    name: 'What If...',
    description: 'Hypothetical scenarios and future possibilities',
    assetReuseMix: {
      evergreen: 0.6,
      episode_specific: 0.4
    },
    pacing: {
      minShotSeconds: 4,
      maxShotSeconds: 7
    },
    visualMix: {
      image: 0.8,
      video: 0.2
    },
    branding: {
      stingText: '{ChannelName} presents',
      softCtaText: 'If you like these thought experiments, subscribe for more.',
      finalCtaText: 'Subscribe and turn on notifications so you don\'t miss what\'s next.',
      outroTeaserText: 'Next time, we\'ll push the scenario even further.',
      overlay: {
        stingStartSeconds: 7,
        stingDurationSeconds: 3,
        softCtaStartSeconds: 80,
        softCtaDurationSeconds: 5
      },
      overlayStyle: {
        fontSize: 50,
        fontColor: 'white',
        boxColor: '0x001a33',
        boxOpacity: 0.48,
        boxBorderW: 18
      }
    },
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
    assetReuseMix: {
      evergreen: 0.7,
      episode_specific: 0.3
    },
    pacing: {
      minShotSeconds: 6,
      maxShotSeconds: 8
    },
    visualMix: {
      image: 0.9,
      video: 0.1
    },
    branding: {
      stingText: '{ChannelName} presents',
      softCtaText: 'If you enjoy human history told cinematically, subscribe.',
      finalCtaText: 'Subscribe and turn on notifications for the next chapter.',
      outroTeaserText: 'In our next journey, we\'ll uncover another hidden origin.',
      overlay: {
        stingStartSeconds: 7,
        stingDurationSeconds: 3,
        softCtaStartSeconds: 80,
        softCtaDurationSeconds: 5
      },
      overlayStyle: {
        fontSize: 48,
        fontColor: 'white',
        boxColor: '0x2a1a00',
        boxOpacity: 0.5,
        boxBorderW: 18
      }
    },
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
    assetReuseMix: {
      evergreen: 0.8,
      episode_specific: 0.2
    },
    pacing: {
      minShotSeconds: 6,
      maxShotSeconds: 8
    },
    visualMix: {
      image: 0.85,
      video: 0.15
    },
    branding: {
      stingText: '{ChannelName} presents',
      softCtaText: 'For more case files like this, subscribe.',
      finalCtaText: 'Subscribe and turn on notifications to stay informed.',
      outroTeaserText: 'Next file: a case that should not exist on paper.',
      overlay: {
        stingStartSeconds: 7,
        stingDurationSeconds: 3,
        softCtaStartSeconds: 80,
        softCtaDurationSeconds: 5
      },
      overlayStyle: {
        fontSize: 48,
        fontColor: 'white',
        boxColor: 'black',
        boxOpacity: 0.55,
        boxBorderW: 18
      }
    },
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
