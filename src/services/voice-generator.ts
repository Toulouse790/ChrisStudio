import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir } from 'fs/promises';
import { VoiceConfig } from '../types/index.js';

const execAsync = promisify(exec);

export class VoiceGenerator {
  private outputDir: string;

  constructor(outputDir: string = './output/audio') {
    this.outputDir = outputDir;
  }

  async generateAudio(
    text: string,
    voiceConfig: VoiceConfig,
    outputFile: string
  ): Promise<string> {
    await mkdir(this.outputDir, { recursive: true });
    
    const outputPath = `${this.outputDir}/${outputFile}`;
    
    // Clean text for shell command
    const cleanText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
    
    // Edge TTS command
    const command = `edge-tts --voice ${voiceConfig.voice} --rate=${voiceConfig.rate} --pitch=${voiceConfig.pitch} --text "${cleanText}" --write-media ${outputPath}`;
    
    console.log(`🎤 Generating audio with ${voiceConfig.voice}...`);
    
    try {
      await execAsync(command);
      console.log(`✅ Audio generated: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('❌ Edge TTS error:', error);
      throw error;
    }
  }

  async listAvailableVoices(): Promise<void> {
    console.log('🎙️ Available English voices:\n');
    try {
      const { stdout } = await execAsync('edge-tts --list-voices | grep "en-"');
      console.log(stdout);
    } catch (error) {
      console.error('Make sure edge-tts is installed: pip install edge-tts');
      throw error;
    }
  }
}
