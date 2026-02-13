import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export type SFXType =
  | 'whoosh'
  | 'impact'
  | 'reveal'
  | 'tension'
  | 'transition'
  | 'drone'
  | 'riser'
  | 'hit'
  | 'sweep';

export interface SoundEffect {
  path: string;
  filename: string;
  type: SFXType;
  durationSeconds: number;
}

export interface SFXCue {
  type: SFXType;
  /** Time in seconds when to play the SFX */
  timestamp: number;
  /** Volume multiplier (0-1) */
  volume?: number;
}

export interface SoundDesignConfig {
  sfxDir?: string;
  defaultVolume?: number;
}

const DEFAULT_CONFIG: Required<SoundDesignConfig> = {
  sfxDir: './assets/sfx',
  defaultVolume: 0.7
};

// Map filename patterns to SFX types
const FILENAME_PATTERNS: Array<{ pattern: RegExp; type: SFXType }> = [
  { pattern: /whoosh/i, type: 'whoosh' },
  { pattern: /impact/i, type: 'impact' },
  { pattern: /hit/i, type: 'hit' },
  { pattern: /reveal/i, type: 'reveal' },
  { pattern: /tension/i, type: 'tension' },
  { pattern: /riser/i, type: 'riser' },
  { pattern: /transition/i, type: 'transition' },
  { pattern: /drone/i, type: 'drone' },
  { pattern: /sweep/i, type: 'sweep' },
  { pattern: /swipe/i, type: 'whoosh' },
  { pattern: /boom/i, type: 'impact' },
  { pattern: /sting/i, type: 'reveal' }
];

export class SoundDesignManager {
  private config: Required<SoundDesignConfig>;
  private sfxCache: Map<SFXType, SoundEffect[]> = new Map();
  private initialized = false;

  constructor(config?: SoundDesignConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!existsSync(this.config.sfxDir)) {
      logger.warn({ dir: this.config.sfxDir }, 'SFX directory not found');
      this.initialized = true;
      return;
    }

    const files = await readdir(this.config.sfxDir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!['.mp3', '.wav', '.m4a', '.ogg'].includes(ext)) continue;

      const filePath = path.join(this.config.sfxDir, file);
      const type = this.detectSFXType(file);

      try {
        const duration = await this.probeDuration(filePath);
        const sfx: SoundEffect = {
          path: filePath,
          filename: file,
          type,
          durationSeconds: duration
        };

        const existing = this.sfxCache.get(type) || [];
        existing.push(sfx);
        this.sfxCache.set(type, existing);
      } catch (error) {
        logger.warn({ file, error }, 'Failed to probe SFX file');
      }
    }

    const totalSFX = Array.from(this.sfxCache.values()).reduce((sum, arr) => sum + arr.length, 0);
    logger.info({ totalSFX, types: Array.from(this.sfxCache.keys()) }, 'Loaded sound effects');

    this.initialized = true;
  }

  private detectSFXType(filename: string): SFXType {
    for (const { pattern, type } of FILENAME_PATTERNS) {
      if (pattern.test(filename)) {
        return type;
      }
    }
    return 'transition'; // Default type
  }

  private async probeDuration(filePath: string): Promise<number> {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-i', filePath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0']
    );
    const duration = parseFloat(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : 1;
  }

  /**
   * Get a random SFX of a specific type
   */
  async getSFX(type: SFXType): Promise<SoundEffect | null> {
    await this.initialize();

    const effects = this.sfxCache.get(type);
    if (!effects || effects.length === 0) {
      // Try fallback types
      const fallbacks: Record<SFXType, SFXType[]> = {
        whoosh: ['sweep', 'transition'],
        impact: ['hit', 'reveal'],
        reveal: ['impact', 'riser'],
        tension: ['riser', 'drone'],
        transition: ['whoosh', 'sweep'],
        drone: ['tension'],
        riser: ['tension', 'reveal'],
        hit: ['impact'],
        sweep: ['whoosh', 'transition']
      };

      for (const fallback of fallbacks[type] || []) {
        const fallbackEffects = this.sfxCache.get(fallback);
        if (fallbackEffects && fallbackEffects.length > 0) {
          const idx = Math.floor(Math.random() * fallbackEffects.length);
          return fallbackEffects[idx];
        }
      }

      return null;
    }

    const idx = Math.floor(Math.random() * effects.length);
    return effects[idx];
  }

  /**
   * Generate SFX cues based on script structure
   */
  generateSFXCues(
    sections: Array<{ startTime: number; duration: number; type: 'hook' | 'section' | 'reveal' | 'conclusion' }>,
    videoDuration: number
  ): SFXCue[] {
    const cues: SFXCue[] = [];

    for (const section of sections) {
      // Add transition sound at section start (except first)
      if (section.startTime > 0) {
        cues.push({
          type: 'whoosh',
          timestamp: section.startTime - 0.3, // Slightly before
          volume: 0.5
        });
      }

      // Add reveal sound for important moments
      if (section.type === 'reveal') {
        cues.push({
          type: 'reveal',
          timestamp: section.startTime + 0.5,
          volume: 0.6
        });
      }

      // Add impact for conclusion
      if (section.type === 'conclusion') {
        cues.push({
          type: 'impact',
          timestamp: section.startTime,
          volume: 0.4
        });
      }
    }

    // Add tension riser before climax (around 70% of video)
    const climaxTime = videoDuration * 0.7;
    cues.push({
      type: 'riser',
      timestamp: climaxTime - 3, // 3 seconds before climax
      volume: 0.3
    });

    return cues.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Generate FFmpeg filter for overlaying SFX at specific timestamps
   */
  async generateSFXFilter(
    cues: SFXCue[],
    baseAudioInput: number,
    sfxStartInput: number
  ): Promise<{ filter: string; outputLabel: string; additionalInputs: string[] }> {
    await this.initialize();

    const additionalInputs: string[] = [];
    const filters: string[] = [];
    let currentLabel = `${baseAudioInput}:a`;
    let sfxIndex = 0;

    for (const cue of cues) {
      const sfx = await this.getSFX(cue.type);
      if (!sfx) continue;

      const volume = cue.volume ?? this.config.defaultVolume;
      const inputIndex = sfxStartInput + sfxIndex;
      const outputLabel = `sfx_mix_${sfxIndex}`;

      additionalInputs.push(sfx.path);

      // Delay and mix the SFX
      filters.push(
        `[${inputIndex}:a]adelay=${Math.round(cue.timestamp * 1000)}|${Math.round(cue.timestamp * 1000)},` +
        `volume=${volume}[sfx_${sfxIndex}]`
      );

      filters.push(
        `[${currentLabel}][sfx_${sfxIndex}]amix=inputs=2:duration=first[${outputLabel}]`
      );

      currentLabel = outputLabel;
      sfxIndex++;
    }

    return {
      filter: filters.join(';'),
      outputLabel: currentLabel,
      additionalInputs
    };
  }

  /**
   * Check if SFX are available
   */
  async hasSFX(): Promise<boolean> {
    await this.initialize();
    return this.sfxCache.size > 0;
  }

  /**
   * Get all available SFX for debugging
   */
  async getAllSFX(): Promise<Map<SFXType, SoundEffect[]>> {
    await this.initialize();
    return this.sfxCache;
  }
}
