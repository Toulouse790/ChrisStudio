import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export type MusicMood = 'epic' | 'mysterious' | 'orchestral' | 'ambient' | 'transitions';

export interface MusicTrack {
  path: string;
  filename: string;
  mood: MusicMood;
  durationSeconds: number;
}

export interface MusicConfig {
  /** Base directory for music assets */
  musicDir?: string;
  /** Volume level for background music (0-1) */
  musicVolume?: number;
  /** Volume level during narration (ducking) */
  duckingVolume?: number;
  /** Fade in/out duration in seconds */
  fadeDuration?: number;
  /** Attack time for ducking in seconds */
  duckingAttack?: number;
  /** Release time for ducking in seconds */
  duckingRelease?: number;
}

const THEME_TO_MOOD: Record<string, MusicMood> = {
  'sci-fi': 'epic',
  'historical': 'orchestral',
  'mysterious': 'mysterious'
};

const DEFAULT_CONFIG: Required<MusicConfig> = {
  musicDir: './assets/music',
  musicVolume: 0.25,
  duckingVolume: 0.08,
  fadeDuration: 2,
  duckingAttack: 0.3,
  duckingRelease: 0.8
};

export class MusicManager {
  private config: Required<MusicConfig>;
  private trackCache: Map<MusicMood, MusicTrack[]> = new Map();
  private initialized = false;

  constructor(config?: MusicConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const moods: MusicMood[] = ['epic', 'mysterious', 'orchestral', 'ambient', 'transitions'];

    for (const mood of moods) {
      const moodDir = path.join(this.config.musicDir, mood);
      if (existsSync(moodDir)) {
        const tracks = await this.scanMusicDirectory(moodDir, mood);
        this.trackCache.set(mood, tracks);
        logger.info({ mood, count: tracks.length }, 'Loaded music tracks');
      } else {
        this.trackCache.set(mood, []);
        logger.debug({ mood, dir: moodDir }, 'Music directory not found');
      }
    }

    this.initialized = true;
  }

  private async scanMusicDirectory(dir: string, mood: MusicMood): Promise<MusicTrack[]> {
    const tracks: MusicTrack[] = [];
    const files = await readdir(dir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) {
        const filePath = path.join(dir, file);
        try {
          const duration = await this.probeDuration(filePath);
          tracks.push({
            path: filePath,
            filename: file,
            mood,
            durationSeconds: duration
          });
        } catch (error) {
          logger.warn({ file, error }, 'Failed to probe music file');
        }
      }
    }

    return tracks;
  }

  private async probeDuration(filePath: string): Promise<number> {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-i', filePath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0']
    );
    const duration = parseFloat(stdout.trim());
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`Invalid duration for ${filePath}`);
    }
    return duration;
  }

  /**
   * Select a music track based on theme and required duration
   */
  async selectTrack(
    theme: 'sci-fi' | 'historical' | 'mysterious',
    requiredDuration: number
  ): Promise<MusicTrack | null> {
    await this.initialize();

    const mood = THEME_TO_MOOD[theme] || 'ambient';
    let tracks = this.trackCache.get(mood) || [];

    // Fallback to ambient if no tracks for specific mood
    if (tracks.length === 0) {
      tracks = this.trackCache.get('ambient') || [];
    }

    if (tracks.length === 0) {
      logger.warn({ mood, theme }, 'No music tracks available');
      return null;
    }

    // Prefer tracks that are longer than required duration
    const suitableTracks = tracks.filter(t => t.durationSeconds >= requiredDuration);

    if (suitableTracks.length > 0) {
      // Random selection from suitable tracks
      const idx = Math.floor(Math.random() * suitableTracks.length);
      return suitableTracks[idx];
    }

    // If no track is long enough, return the longest one (will be looped)
    const longestTrack = tracks.reduce((a, b) =>
      a.durationSeconds > b.durationSeconds ? a : b
    );

    logger.info(
      { track: longestTrack.filename, duration: longestTrack.durationSeconds, required: requiredDuration },
      'Selected track will be looped'
    );

    return longestTrack;
  }

  /**
   * Get a random transition sound effect
   */
  async getTransitionSound(): Promise<MusicTrack | null> {
    await this.initialize();

    const transitions = this.trackCache.get('transitions') || [];
    if (transitions.length === 0) return null;

    const idx = Math.floor(Math.random() * transitions.length);
    return transitions[idx];
  }

  /**
   * Generate FFmpeg filter for mixing music with narration
   * Includes auto-ducking (lowering music during speech)
   */
  generateMixFilter(
    narrationInput: number,
    musicInput: number,
    videoDuration: number,
    musicDuration: number
  ): { filter: string; outputLabel: string } {
    const {
      musicVolume,
      duckingVolume,
      fadeDuration,
      duckingAttack,
      duckingRelease
    } = this.config;

    const needsLoop = musicDuration < videoDuration;
    const loopCount = needsLoop ? Math.ceil(videoDuration / musicDuration) : 1;

    // Build the filter complex
    const filters: string[] = [];

    // Step 1: Prepare music (loop if needed, adjust volume, fade in/out)
    if (needsLoop) {
      filters.push(
        `[${musicInput}:a]aloop=loop=${loopCount - 1}:size=${Math.floor(musicDuration * 48000)}[music_looped]`
      );
      filters.push(
        `[music_looped]atrim=0:${videoDuration},asetpts=PTS-STARTPTS[music_trimmed]`
      );
    } else {
      filters.push(
        `[${musicInput}:a]atrim=0:${videoDuration},asetpts=PTS-STARTPTS[music_trimmed]`
      );
    }

    // Step 2: Apply volume and fades to music
    const fadeOutStart = Math.max(0, videoDuration - fadeDuration);
    filters.push(
      `[music_trimmed]volume=${musicVolume},` +
      `afade=t=in:st=0:d=${fadeDuration},` +
      `afade=t=out:st=${fadeOutStart}:d=${fadeDuration}[music_faded]`
    );

    // Step 3: Prepare narration (normalize)
    filters.push(
      `[${narrationInput}:a]apad=whole_dur=${videoDuration}[narration_padded]`
    );

    // Step 4: Apply sidechaining/ducking
    // Use compressor with sidechain to duck music when narration is present
    filters.push(
      `[music_faded][narration_padded]sidechaincompress=` +
      `threshold=0.02:ratio=4:attack=${duckingAttack * 1000}:release=${duckingRelease * 1000}:` +
      `level_sc=1:makeup=${duckingVolume / musicVolume}[music_ducked]`
    );

    // Step 5: Mix narration and ducked music
    filters.push(
      `[narration_padded][music_ducked]amix=inputs=2:duration=first:weights=1 0.8[audio_mixed]`
    );

    return {
      filter: filters.join(';'),
      outputLabel: 'audio_mixed'
    };
  }

  /**
   * Simpler mix filter without sidechaining (fallback)
   */
  generateSimpleMixFilter(
    narrationInput: number,
    musicInput: number,
    videoDuration: number,
    musicDuration: number
  ): { filter: string; outputLabel: string } {
    const { musicVolume, fadeDuration } = this.config;

    const needsLoop = musicDuration < videoDuration;
    const filters: string[] = [];

    // Prepare music
    if (needsLoop) {
      const loopCount = Math.ceil(videoDuration / musicDuration);
      filters.push(
        `[${musicInput}:a]aloop=loop=${loopCount - 1}:size=${Math.floor(musicDuration * 48000)},` +
        `atrim=0:${videoDuration},asetpts=PTS-STARTPTS[music_prep]`
      );
    } else {
      filters.push(
        `[${musicInput}:a]atrim=0:${videoDuration},asetpts=PTS-STARTPTS[music_prep]`
      );
    }

    // Apply volume and fades
    const fadeOutStart = Math.max(0, videoDuration - fadeDuration);
    filters.push(
      `[music_prep]volume=${musicVolume},` +
      `afade=t=in:st=0:d=${fadeDuration},` +
      `afade=t=out:st=${fadeOutStart}:d=${fadeDuration}[music_ready]`
    );

    // Pad narration
    filters.push(
      `[${narrationInput}:a]apad=whole_dur=${videoDuration}[narration_ready]`
    );

    // Simple mix
    filters.push(
      `[narration_ready][music_ready]amix=inputs=2:duration=first:weights=1 0.6[audio_out]`
    );

    return {
      filter: filters.join(';'),
      outputLabel: 'audio_out'
    };
  }

  /**
   * Check if music is available for a given theme
   */
  async hasMusicForTheme(theme: 'sci-fi' | 'historical' | 'mysterious'): Promise<boolean> {
    await this.initialize();
    const mood = THEME_TO_MOOD[theme];
    const tracks = this.trackCache.get(mood) || [];
    const ambientTracks = this.trackCache.get('ambient') || [];
    return tracks.length > 0 || ambientTracks.length > 0;
  }

  /**
   * Get all available tracks for debugging
   */
  async getAllTracks(): Promise<Map<MusicMood, MusicTrack[]>> {
    await this.initialize();
    return this.trackCache;
  }
}
