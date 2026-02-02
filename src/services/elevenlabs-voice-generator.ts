import axios from 'axios';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import logger from '../utils/logger.js';

export interface ElevenLabsVoiceConfig {
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface ElevenLabsConfig {
  apiKey: string;
  modelId?: string;
}

const DEFAULT_MODEL = 'eleven_multilingual_v2';

export class ElevenLabsVoiceGenerator {
  private apiKey: string;
  private modelId: string;
  private outputDir: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(outputDir: string = './output/audio', config?: Partial<ElevenLabsConfig>) {
    this.apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY || '';
    this.modelId = config?.modelId || process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL;
    this.outputDir = outputDir;

    if (!this.apiKey) {
      logger.warn('ELEVENLABS_API_KEY not set - voice generation will fail');
    }
  }

  async generateAudio(
    text: string,
    voiceConfig: ElevenLabsVoiceConfig,
    outputFile: string
  ): Promise<string> {
    await mkdir(this.outputDir, { recursive: true });

    const outputPath = `${this.outputDir}/${outputFile}`;

    logger.info(
      { voiceId: voiceConfig.voiceId, outputPath, textLength: text.length },
      'Generating audio with ElevenLabs'
    );

    try {
      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/text-to-speech/${voiceConfig.voiceId}`,
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        data: {
          text,
          model_id: this.modelId,
          voice_settings: {
            stability: voiceConfig.stability ?? 0.5,
            similarity_boost: voiceConfig.similarityBoost ?? 0.75,
            style: voiceConfig.style ?? 0,
            use_speaker_boost: voiceConfig.useSpeakerBoost ?? true
          }
        },
        responseType: 'stream',
        timeout: 300000
      });

      const writer = createWriteStream(outputPath);
      await pipeline(response.data, writer);

      logger.info({ outputPath }, 'Audio generated successfully with ElevenLabs');
      return outputPath;
    } catch (error) {
      const err = error as Error & { response?: { status: number; data: unknown } };

      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        let errorMessage = `ElevenLabs API error (${status})`;

        if (status === 401) {
          errorMessage = 'Invalid ElevenLabs API key';
        } else if (status === 429) {
          errorMessage = 'ElevenLabs rate limit exceeded - try again later';
        } else if (status === 400) {
          errorMessage = 'Invalid request to ElevenLabs - check voice ID and text';
        }

        logger.error({ status, voiceId: voiceConfig.voiceId }, errorMessage);
        throw new Error(errorMessage);
      }

      logger.error({ error: err.message }, 'ElevenLabs generation failed');
      throw new Error(`ElevenLabs generation failed: ${err.message}`);
    }
  }

  async getAvailableVoices(): Promise<Array<{ voice_id: string; name: string; category: string }>> {
    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.data.voices.map((v: { voice_id: string; name: string; category: string }) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category
      }));
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Failed to fetch ElevenLabs voices');
      throw new Error(`Failed to fetch voices: ${err.message}`);
    }
  }

  async getUserSubscription(): Promise<{
    character_count: number;
    character_limit: number;
    can_extend_character_limit: boolean;
    allowed_to_extend_character_limit: boolean;
    next_character_count_reset_unix: number;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/user/subscription`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Failed to fetch subscription info');
      throw new Error(`Failed to fetch subscription: ${err.message}`);
    }
  }

  async checkQuota(requiredCharacters: number): Promise<{ ok: boolean; remaining: number; limit: number }> {
    try {
      const sub = await this.getUserSubscription();
      const remaining = sub.character_limit - sub.character_count;

      return {
        ok: remaining >= requiredCharacters,
        remaining,
        limit: sub.character_limit
      };
    } catch {
      return { ok: true, remaining: 0, limit: 0 };
    }
  }
}
