import logger from '../utils/logger.js';

export type VisualEffect =
  | 'ken_burns_zoom_in'
  | 'ken_burns_zoom_out'
  | 'pan_left'
  | 'pan_right'
  | 'pan_up'
  | 'pan_down'
  | 'diagonal_pan'
  | 'slow_zoom'
  | 'drift'
  | 'static'
  | 'pulse'
  | 'vignette_zoom';

export type TransitionType =
  | 'fade'
  | 'dissolve'
  | 'dip_to_black'
  | 'wipe_left'
  | 'wipe_right'
  | 'zoom_in'
  | 'zoom_out'
  | 'blur_transition';

export type ColorGrade =
  | 'cinematic_blue_orange'
  | 'warm_vintage'
  | 'cold_desaturated'
  | 'high_contrast'
  | 'film_noir'
  | 'golden_hour'
  | 'mysterious_dark'
  | 'neutral';

export interface VisualEffectConfig {
  effect: VisualEffect;
  intensity?: number; // 0-1, default 0.5
  direction?: 'normal' | 'reverse';
}

export interface TransitionConfig {
  type: TransitionType;
  duration?: number; // seconds, default 0.5
}

export interface ColorGradeConfig {
  grade: ColorGrade;
  intensity?: number; // 0-1, default 0.7
}

// Map themes to appropriate color grades
const THEME_COLOR_GRADES: Record<string, ColorGrade> = {
  'sci-fi': 'cinematic_blue_orange',
  'historical': 'warm_vintage',
  'mysterious': 'mysterious_dark'
};

// Effects suitable for different content types
const CONTENT_EFFECTS: Record<string, VisualEffect[]> = {
  hook: ['ken_burns_zoom_in', 'slow_zoom', 'vignette_zoom'],
  reveal: ['ken_burns_zoom_in', 'slow_zoom', 'pulse'],
  exposition: ['pan_left', 'pan_right', 'drift', 'ken_burns_zoom_out'],
  action: ['diagonal_pan', 'ken_burns_zoom_in', 'pan_up'],
  conclusion: ['ken_burns_zoom_out', 'drift', 'static'],
  transition_moment: ['static', 'drift', 'slow_zoom'],
  generic: ['ken_burns_zoom_in', 'ken_burns_zoom_out', 'pan_left', 'pan_right', 'drift']
};

export class VisualEffectsEngine {
  private lastEffect: VisualEffect | null = null;
  private effectIndex = 0;

  /**
   * Select an appropriate visual effect based on content type
   */
  selectEffect(
    contentType: 'hook' | 'reveal' | 'exposition' | 'action' | 'conclusion' | 'transition_moment' | 'generic',
    seed?: number
  ): VisualEffect {
    const effects = CONTENT_EFFECTS[contentType] || [
      'ken_burns_zoom_in',
      'ken_burns_zoom_out',
      'pan_left',
      'pan_right',
      'drift'
    ];

    // Avoid repeating the same effect
    let selectedEffect: VisualEffect;
    const rng = seed !== undefined ? this.seededRandom(seed + this.effectIndex) : Math.random();

    do {
      const idx = Math.floor(rng * effects.length);
      selectedEffect = effects[idx];
    } while (selectedEffect === this.lastEffect && effects.length > 1);

    this.lastEffect = selectedEffect;
    this.effectIndex++;

    return selectedEffect;
  }

  /**
   * Get color grade for a theme
   */
  getColorGrade(theme: 'sci-fi' | 'historical' | 'mysterious'): ColorGrade {
    return THEME_COLOR_GRADES[theme] || 'neutral';
  }

  /**
   * Generate FFmpeg filter for a visual effect on an image
   */
  generateImageEffectFilter(
    effect: VisualEffect,
    durationSeconds: number,
    width: number = 1920,
    height: number = 1080,
    fps: number = 30,
    intensity: number = 0.5
  ): string {
    const frames = Math.ceil(durationSeconds * fps);
    const scaleFactor = 1.3; // Scale up for movement room

    // Base scale to have room for movement
    const baseScale = `scale=${Math.round(width * scaleFactor)}:${Math.round(height * scaleFactor)}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

    switch (effect) {
      case 'ken_burns_zoom_in': {
        const startZoom = 1.0;
        const endZoom = 1.0 + (0.35 * intensity);
        return `${baseScale},zoompan=z='${startZoom}+(${endZoom}-${startZoom})*on/${frames}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps}`;
      }

      case 'ken_burns_zoom_out': {
        const startZoom = 1.0 + (0.35 * intensity);
        const endZoom = 1.0;
        return `${baseScale},zoompan=z='${startZoom}-(${startZoom}-${endZoom})*on/${frames}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps}`;
      }

      case 'pan_left': {
        const panDistance = Math.round(width * 0.15 * intensity);
        return `${baseScale},zoompan=z='1.1':d=${frames}:x='${panDistance}-(${panDistance}*2)*on/${frames}':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps}`;
      }

      case 'pan_right': {
        const panDistance = Math.round(width * 0.15 * intensity);
        return `${baseScale},zoompan=z='1.1':d=${frames}:x='-${panDistance}+(${panDistance}*2)*on/${frames}':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps}`;
      }

      case 'pan_up': {
        const panDistance = Math.round(height * 0.1 * intensity);
        return `${baseScale},zoompan=z='1.1':d=${frames}:x='iw/2-(iw/zoom/2)':y='${panDistance}-(${panDistance}*2)*on/${frames}':s=${width}x${height}:fps=${fps}`;
      }

      case 'pan_down': {
        const panDistance = Math.round(height * 0.1 * intensity);
        return `${baseScale},zoompan=z='1.1':d=${frames}:x='iw/2-(iw/zoom/2)':y='-${panDistance}+(${panDistance}*2)*on/${frames}':s=${width}x${height}:fps=${fps}`;
      }

      case 'diagonal_pan': {
        const panX = Math.round(width * 0.1 * intensity);
        const panY = Math.round(height * 0.08 * intensity);
        return `${baseScale},zoompan=z='1.05+0.1*on/${frames}':d=${frames}:x='${panX}-(${panX}*2)*on/${frames}':y='${panY}-(${panY}*2)*on/${frames}':s=${width}x${height}:fps=${fps}`;
      }

      case 'slow_zoom': {
        const zoomAmount = 0.15 * intensity;
        return `${baseScale},zoompan=z='1+${zoomAmount}*on/${frames}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps}`;
      }

      case 'drift': {
        // Subtle floating movement
        const driftX = Math.round(width * 0.03 * intensity);
        const driftY = Math.round(height * 0.02 * intensity);
        return `${baseScale},zoompan=z='1.05':d=${frames}:x='${driftX}*sin(on/${frames}*PI)':y='${driftY}*cos(on/${frames}*PI)':s=${width}x${height}:fps=${fps}`;
      }

      case 'vignette_zoom': {
        const zoomAmount = 0.2 * intensity;
        return `${baseScale},zoompan=z='1+${zoomAmount}*on/${frames}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps},vignette=PI/4`;
      }

      case 'pulse': {
        // Subtle pulsing zoom
        return `${baseScale},zoompan=z='1.05+0.03*sin(on/${frames}*PI*2)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps}`;
      }

      case 'static':
      default:
        return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
    }
  }

  /**
   * Generate FFmpeg filter for a video clip
   */
  generateVideoEffectFilter(
    effect: VisualEffect,
    durationSeconds: number,
    width: number = 1920,
    height: number = 1080,
    intensity: number = 0.5
  ): string {
    // For videos, we use simpler effects to avoid complexity
    switch (effect) {
      case 'ken_burns_zoom_in':
      case 'slow_zoom': {
        const zoomAmount = 0.1 * intensity;
        return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,zoompan=z='1+${zoomAmount}*on/25':d=1:s=${width}x${height}`;
      }

      case 'ken_burns_zoom_out': {
        const zoomAmount = 0.1 * intensity;
        return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,zoompan=z='${1 + zoomAmount}-${zoomAmount}*on/25':d=1:s=${width}x${height}`;
      }

      default:
        // Most videos just need scaling
        return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
    }
  }

  /**
   * Generate FFmpeg filter for color grading
   */
  generateColorGradeFilter(grade: ColorGrade, intensity: number = 0.7): string {
    const i = intensity; // Shorthand

    switch (grade) {
      case 'cinematic_blue_orange':
        // Teal/orange look popular in sci-fi
        return `eq=saturation=${1 + 0.2 * i}:contrast=${1 + 0.1 * i},` +
          `colorbalance=rs=${-0.1 * i}:gs=${-0.05 * i}:bs=${0.15 * i}:rm=${0.1 * i}:gm=${0.02 * i}:bm=${-0.05 * i}:rh=${0.15 * i}:gh=${0.05 * i}:bh=${-0.1 * i}`;

      case 'warm_vintage':
        // Golden, warm tones for historical content
        return `eq=saturation=${0.9 + 0.1 * i}:contrast=${1 + 0.05 * i}:brightness=${0.02 * i},` +
          `colorbalance=rs=${0.1 * i}:gs=${0.05 * i}:bs=${-0.1 * i}:rm=${0.15 * i}:gm=${0.08 * i}:bm=${-0.05 * i},` +
          `curves=vintage`;

      case 'cold_desaturated':
        // Cold, muted look
        return `eq=saturation=${0.7 + 0.1 * i}:contrast=${1 + 0.15 * i},` +
          `colorbalance=rs=${-0.1 * i}:gs=${-0.05 * i}:bs=${0.1 * i}`;

      case 'high_contrast':
        return `eq=contrast=${1 + 0.3 * i}:saturation=${1 + 0.1 * i}`;

      case 'film_noir':
        // Dark, high contrast, desaturated
        return `eq=saturation=${0.3 + 0.2 * i}:contrast=${1 + 0.4 * i}:brightness=${-0.05 * i},` +
          `vignette=PI/3`;

      case 'golden_hour':
        // Warm golden light
        return `eq=saturation=${1 + 0.15 * i}:brightness=${0.03 * i},` +
          `colorbalance=rs=${0.2 * i}:gs=${0.1 * i}:bs=${-0.15 * i}:rm=${0.15 * i}:gm=${0.1 * i}:bm=${-0.1 * i}`;

      case 'mysterious_dark':
        // Dark, slightly blue, mysterious
        return `eq=saturation=${0.85 + 0.1 * i}:contrast=${1 + 0.2 * i}:brightness=${-0.08 * i},` +
          `colorbalance=rs=${-0.05 * i}:gs=${-0.02 * i}:bs=${0.1 * i},` +
          `vignette=PI/4`;

      case 'neutral':
      default:
        return 'null'; // No color grading
    }
  }

  /**
   * Generate FFmpeg transition filter between two clips
   */
  generateTransitionFilter(
    transition: TransitionType,
    duration: number = 0.5,
    clipALabel: string,
    clipBLabel: string,
    outputLabel: string
  ): string {
    const frames = Math.ceil(duration * 30); // Assuming 30fps

    switch (transition) {
      case 'dissolve':
      case 'fade':
        return `[${clipALabel}][${clipBLabel}]xfade=transition=fade:duration=${duration}:offset=0[${outputLabel}]`;

      case 'dip_to_black':
        return `[${clipALabel}][${clipBLabel}]xfade=transition=fadeblack:duration=${duration}:offset=0[${outputLabel}]`;

      case 'wipe_left':
        return `[${clipALabel}][${clipBLabel}]xfade=transition=wipeleft:duration=${duration}:offset=0[${outputLabel}]`;

      case 'wipe_right':
        return `[${clipALabel}][${clipBLabel}]xfade=transition=wiperight:duration=${duration}:offset=0[${outputLabel}]`;

      case 'zoom_in':
        return `[${clipALabel}][${clipBLabel}]xfade=transition=zoomin:duration=${duration}:offset=0[${outputLabel}]`;

      case 'zoom_out':
        return `[${clipALabel}][${clipBLabel}]xfade=transition=squeezeh:duration=${duration}:offset=0[${outputLabel}]`;

      case 'blur_transition':
        // Blur out then in (approximation with fadeblack)
        return `[${clipALabel}][${clipBLabel}]xfade=transition=fadeblack:duration=${duration}:offset=0[${outputLabel}]`;

      default:
        return `[${clipALabel}][${clipBLabel}]xfade=transition=fade:duration=${duration}:offset=0[${outputLabel}]`;
    }
  }

  /**
   * Select appropriate transition based on content change
   */
  selectTransition(
    fromContent: 'hook' | 'section' | 'reveal' | 'conclusion',
    toContent: 'hook' | 'section' | 'reveal' | 'conclusion'
  ): TransitionType {
    // Dramatic transitions for reveals
    if (toContent === 'reveal') {
      return Math.random() > 0.5 ? 'dip_to_black' : 'zoom_in';
    }

    // Smooth transitions for sections
    if (fromContent === 'section' && toContent === 'section') {
      const options: TransitionType[] = ['dissolve', 'fade', 'wipe_left'];
      return options[Math.floor(Math.random() * options.length)];
    }

    // Conclusion gets special treatment
    if (toContent === 'conclusion') {
      return 'dip_to_black';
    }

    return 'fade';
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }
}
