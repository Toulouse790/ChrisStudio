import { VoiceConfig } from '../types/index.js';
import { VoiceGenerator } from './voice-generator.js';
import { ElevenLabsVoiceGenerator } from './elevenlabs-voice-generator.js';
import logger from '../utils/logger.js';

export interface UnifiedVoiceGenerator {
  generateAudio(text: string, voiceConfig: VoiceConfig, outputFile: string): Promise<string>;
}

class ElevenLabsAdapter implements UnifiedVoiceGenerator {
  private generator: ElevenLabsVoiceGenerator;

  constructor(outputDir: string) {
    this.generator = new ElevenLabsVoiceGenerator(outputDir);
  }

  async generateAudio(text: string, voiceConfig: VoiceConfig, outputFile: string): Promise<string> {
    return this.generator.generateAudio(text, {
      voiceId: voiceConfig.voiceId,
      stability: voiceConfig.stability,
      similarityBoost: voiceConfig.similarityBoost,
      style: voiceConfig.style
    }, outputFile);
  }
}

class EdgeTTSAdapter implements UnifiedVoiceGenerator {
  private generator: VoiceGenerator;

  constructor(outputDir: string) {
    this.generator = new VoiceGenerator(outputDir);
  }

  async generateAudio(text: string, voiceConfig: VoiceConfig, outputFile: string): Promise<string> {
    return this.generator.generateAudio(text, {
      language: voiceConfig.language || 'en-US',
      voice: voiceConfig.voiceId,
      rate: voiceConfig.rate || '+0%',
      pitch: voiceConfig.pitch || '+0Hz'
    }, outputFile);
  }
}

export class VoiceGeneratorFactory {
  private outputDir: string;
  private elevenLabsGenerator: ElevenLabsAdapter | null = null;
  private edgeTTSGenerator: EdgeTTSAdapter | null = null;

  constructor(outputDir: string = './output/audio') {
    this.outputDir = outputDir;
  }

  getGenerator(voiceConfig: VoiceConfig): UnifiedVoiceGenerator {
    const provider = voiceConfig.provider || 'edge-tts';

    if (provider === 'elevenlabs') {
      if (!this.elevenLabsGenerator) {
        logger.info('Initializing ElevenLabs voice generator');
        this.elevenLabsGenerator = new ElevenLabsAdapter(this.outputDir);
      }
      return this.elevenLabsGenerator;
    }

    if (!this.edgeTTSGenerator) {
      logger.info('Initializing Edge TTS voice generator');
      this.edgeTTSGenerator = new EdgeTTSAdapter(this.outputDir);
    }
    return this.edgeTTSGenerator;
  }

  async generateAudio(text: string, voiceConfig: VoiceConfig, outputFile: string): Promise<string> {
    const generator = this.getGenerator(voiceConfig);
    return generator.generateAudio(text, voiceConfig, outputFile);
  }
}
