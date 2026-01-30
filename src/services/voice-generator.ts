import { spawn } from 'child_process';
import { mkdir } from 'fs/promises';
import logger from '../utils/logger.js';

export interface EdgeTTSVoiceConfig {
  language: string;
  voice: string;
  rate: string;
  pitch: string;
}

export class VoiceGenerator {
  private outputDir: string;

  constructor(outputDir: string = './output/audio') {
    this.outputDir = outputDir;
  }

  async generateAudio(
    text: string,
    voiceConfig: EdgeTTSVoiceConfig,
    outputFile: string
  ): Promise<string> {
    await mkdir(this.outputDir, { recursive: true });

    const outputPath = `${this.outputDir}/${outputFile}`;

    const cleanText = text.replace(/\n/g, ' ').trim();

    logger.info({ voice: voiceConfig.voice, outputPath }, 'Generating audio with Edge TTS');

    return new Promise((resolve, reject) => {
      const args = [
        '--voice', voiceConfig.voice,
        `--rate=${voiceConfig.rate}`,
        `--pitch=${voiceConfig.pitch}`,
        '--text', cleanText,
        '--write-media', outputPath
      ];

      const proc = spawn('edge-tts', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info({ outputPath }, 'Audio generated successfully');
          resolve(outputPath);
        } else {
          logger.error({ code, stderr }, 'Edge TTS failed');
          reject(new Error(`Edge TTS failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        logger.error({ error: err.message }, 'Edge TTS spawn error');
        reject(new Error(`Failed to spawn edge-tts: ${err.message}. Make sure edge-tts is installed: pip install edge-tts`));
      });
    });
  }

  async listAvailableVoices(): Promise<void> {
    logger.info('Listing available English voices');

    return new Promise((resolve, reject) => {
      const proc = spawn('edge-tts', ['--list-voices'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          const englishVoices = stdout
            .split('\n')
            .filter((line) => line.includes('en-'))
            .join('\n');

          console.log('Available English voices:\n');
          console.log(englishVoices);
          resolve();
        } else {
          logger.error({ code, stderr }, 'Failed to list voices');
          reject(new Error('Make sure edge-tts is installed: pip install edge-tts'));
        }
      });

      proc.on('error', (err) => {
        logger.error({ error: err.message }, 'Edge TTS spawn error');
        reject(new Error(`Failed to spawn edge-tts: ${err.message}. Make sure edge-tts is installed: pip install edge-tts`));
      });
    });
  }
}
