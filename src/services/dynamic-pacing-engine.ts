import { ContentType, EmotionalTone } from './script-generator.js';
import logger from '../utils/logger.js';

export interface PacingConfig {
  /** Base duration range in seconds */
  minDuration: number;
  maxDuration: number;
  /** How much emotional intensity affects pacing (0-1) */
  emotionalInfluence: number;
  /** How much content type affects pacing (0-1) */
  contentTypeInfluence: number;
}

export interface ShotTiming {
  duration: number;
  /** Suggested number of visual cuts within this shot */
  cutCount: number;
  /** Duration for each sub-cut if multiple cuts */
  cutDurations: number[];
  /** Pacing feel description */
  feel: 'rapid' | 'quick' | 'moderate' | 'slow' | 'contemplative';
}

export interface PacingContext {
  contentType: ContentType;
  emotionalTone: EmotionalTone;
  emotionalIntensity: number; // 0-10
  act: 1 | 2 | 3;
  narrationDuration: number; // seconds (from audio)
  isClimaxSection: boolean;
  isMicroHook: boolean;
}

const DEFAULT_CONFIG: PacingConfig = {
  minDuration: 2,
  maxDuration: 12,
  emotionalInfluence: 0.4,
  contentTypeInfluence: 0.6
};

// Base duration multipliers by content type (relative to narration)
const CONTENT_TYPE_PACING: Record<ContentType, { multiplier: number; minCut: number; maxCut: number }> = {
  hook: { multiplier: 0.8, minCut: 2, maxCut: 4 },      // Fast cuts to grab attention
  reveal: { multiplier: 1.0, minCut: 1, maxCut: 2 },    // Hold for impact
  exposition: { multiplier: 1.1, minCut: 1, maxCut: 3 }, // Let info breathe
  action: { multiplier: 0.7, minCut: 3, maxCut: 6 },    // Dynamic, fast
  conclusion: { multiplier: 1.2, minCut: 1, maxCut: 2 }, // Slower, reflective
  transition_moment: { multiplier: 0.5, minCut: 1, maxCut: 2 } // Brief bridges
};

// Emotional intensity affects pacing speed
const EMOTION_PACING: Record<EmotionalTone, { speedFactor: number; cutBias: number }> = {
  curiosity: { speedFactor: 0.9, cutBias: 0 },    // Slightly quicker
  tension: { speedFactor: 0.75, cutBias: 1 },     // Fast, more cuts
  wonder: { speedFactor: 1.1, cutBias: -1 },      // Slower, let it breathe
  mystery: { speedFactor: 1.0, cutBias: 0 },      // Moderate
  excitement: { speedFactor: 0.7, cutBias: 2 },   // Fastest, most cuts
  resolution: { speedFactor: 1.2, cutBias: -1 },  // Slow, contemplative
  intrigue: { speedFactor: 0.85, cutBias: 1 }     // Quick, building
};

// Act-based pacing adjustments
const ACT_PACING: Record<1 | 2 | 3, { speedFactor: number; description: string }> = {
  1: { speedFactor: 0.95, description: 'Establishing pace' },
  2: { speedFactor: 0.85, description: 'Building momentum' },
  3: { speedFactor: 1.05, description: 'Resolving, breathing' }
};

export class DynamicPacingEngine {
  private config: PacingConfig;

  constructor(config?: Partial<PacingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate optimal shot timing based on context
   */
  calculateShotTiming(context: PacingContext): ShotTiming {
    const { contentType, emotionalTone, emotionalIntensity, act, narrationDuration, isClimaxSection, isMicroHook } = context;

    // Get base parameters
    const contentPacing = CONTENT_TYPE_PACING[contentType];
    const emotionPacing = EMOTION_PACING[emotionalTone];
    const actPacing = ACT_PACING[act];

    // Calculate base duration from narration
    let baseDuration = narrationDuration * contentPacing.multiplier;

    // Apply emotional speed factor
    baseDuration *= emotionPacing.speedFactor;

    // Apply act-based adjustment
    baseDuration *= actPacing.speedFactor;

    // Apply emotional intensity (higher intensity = faster pacing)
    const intensityFactor = 1 - ((emotionalIntensity / 10) * 0.3); // 0-10 intensity reduces duration by up to 30%
    baseDuration *= intensityFactor;

    // Climax sections are slightly faster
    if (isClimaxSection) {
      baseDuration *= 0.85;
    }

    // Micro-hooks are brief
    if (isMicroHook) {
      baseDuration = Math.min(baseDuration, 8);
    }

    // Clamp to configured range
    const duration = Math.max(
      this.config.minDuration,
      Math.min(this.config.maxDuration, baseDuration)
    );

    // Calculate number of cuts
    let cutCount = this.calculateCutCount(duration, contentPacing, emotionPacing, emotionalIntensity);

    // Calculate individual cut durations
    const cutDurations = this.distributeCutDurations(duration, cutCount);

    // Determine feel
    const feel = this.determineFeel(duration, cutCount);

    logger.debug({
      contentType,
      emotionalTone,
      intensity: emotionalIntensity,
      act,
      narrationDuration,
      calculatedDuration: duration,
      cutCount,
      feel
    }, 'Calculated shot timing');

    return {
      duration,
      cutCount,
      cutDurations,
      feel
    };
  }

  private calculateCutCount(
    duration: number,
    contentPacing: typeof CONTENT_TYPE_PACING[ContentType],
    emotionPacing: typeof EMOTION_PACING[EmotionalTone],
    emotionalIntensity: number
  ): number {
    // Base cut count from content type
    let cutCount = Math.round(
      (contentPacing.minCut + contentPacing.maxCut) / 2
    );

    // Adjust by emotion
    cutCount += emotionPacing.cutBias;

    // Higher intensity = more cuts
    cutCount += Math.floor(emotionalIntensity / 4);

    // Don't have more cuts than makes sense for duration
    // Minimum 2 seconds per cut for readability
    const maxCutsForDuration = Math.floor(duration / 2);
    cutCount = Math.min(cutCount, maxCutsForDuration);

    // Ensure within content type bounds
    cutCount = Math.max(contentPacing.minCut, Math.min(contentPacing.maxCut, cutCount));

    return Math.max(1, cutCount);
  }

  private distributeCutDurations(totalDuration: number, cutCount: number): number[] {
    if (cutCount === 1) {
      return [totalDuration];
    }

    const durations: number[] = [];
    let remaining = totalDuration;

    // Create slightly varied cut durations for natural feel
    for (let i = 0; i < cutCount; i++) {
      const isLast = i === cutCount - 1;

      if (isLast) {
        durations.push(remaining);
      } else {
        // Average duration with slight variation
        const avgRemaining = remaining / (cutCount - i);
        const variation = avgRemaining * 0.2; // ±20% variation
        const cutDuration = avgRemaining + (Math.random() * variation * 2 - variation);
        const finalCutDuration = Math.max(2, Math.min(remaining - 2, cutDuration));

        durations.push(finalCutDuration);
        remaining -= finalCutDuration;
      }
    }

    return durations.map(d => Math.round(d * 10) / 10); // Round to 1 decimal
  }

  private determineFeel(duration: number, cutCount: number): ShotTiming['feel'] {
    const avgCutDuration = duration / cutCount;

    if (avgCutDuration < 2.5) return 'rapid';
    if (avgCutDuration < 4) return 'quick';
    if (avgCutDuration < 6) return 'moderate';
    if (avgCutDuration < 9) return 'slow';
    return 'contemplative';
  }

  /**
   * Calculate pacing for an entire script's sections
   */
  calculateScriptPacing(
    sections: Array<{
      contentType: ContentType;
      emotionalTone: EmotionalTone;
      act: 1 | 2 | 3;
      narrationDuration: number;
      isMicroHook?: boolean;
    }>,
    climaxSectionIndex: number,
    emotionalArc: Array<{ timestamp: number; intensity: number }>
  ): ShotTiming[] {
    const timings: ShotTiming[] = [];
    let currentTimestamp = 0;

    sections.forEach((section, index) => {
      // Find emotional intensity at this timestamp
      const intensity = this.getIntensityAtTimestamp(currentTimestamp, emotionalArc);

      const timing = this.calculateShotTiming({
        contentType: section.contentType,
        emotionalTone: section.emotionalTone,
        emotionalIntensity: intensity,
        act: section.act,
        narrationDuration: section.narrationDuration,
        isClimaxSection: index === climaxSectionIndex,
        isMicroHook: section.isMicroHook || false
      });

      timings.push(timing);
      currentTimestamp += timing.duration;
    });

    return timings;
  }

  private getIntensityAtTimestamp(
    timestamp: number,
    emotionalArc: Array<{ timestamp: number; intensity: number }>
  ): number {
    if (emotionalArc.length === 0) return 5;
    if (emotionalArc.length === 1) return emotionalArc[0].intensity;

    // Find surrounding points and interpolate
    let before = emotionalArc[0];
    let after = emotionalArc[emotionalArc.length - 1];

    for (let i = 0; i < emotionalArc.length - 1; i++) {
      if (emotionalArc[i].timestamp <= timestamp && emotionalArc[i + 1].timestamp >= timestamp) {
        before = emotionalArc[i];
        after = emotionalArc[i + 1];
        break;
      }
    }

    // Linear interpolation
    const range = after.timestamp - before.timestamp;
    if (range === 0) return before.intensity;

    const progress = (timestamp - before.timestamp) / range;
    return before.intensity + (after.intensity - before.intensity) * progress;
  }

  /**
   * Get recommended visual effect intensity based on pacing feel
   */
  static getEffectIntensity(feel: ShotTiming['feel']): number {
    const intensityMap: Record<ShotTiming['feel'], number> = {
      rapid: 0.8,
      quick: 0.65,
      moderate: 0.5,
      slow: 0.4,
      contemplative: 0.3
    };
    return intensityMap[feel];
  }

  /**
   * Get recommended transition duration based on pacing feel
   */
  static getTransitionDuration(feel: ShotTiming['feel']): number {
    const durationMap: Record<ShotTiming['feel'], number> = {
      rapid: 0.2,
      quick: 0.3,
      moderate: 0.5,
      slow: 0.7,
      contemplative: 1.0
    };
    return durationMap[feel];
  }

  /**
   * Suggest visual effects that match the pacing feel
   */
  static getSuggestedEffects(feel: ShotTiming['feel']): string[] {
    const effectsMap: Record<ShotTiming['feel'], string[]> = {
      rapid: ['ken_burns_zoom_in', 'pan_left', 'pan_right'],
      quick: ['ken_burns_zoom_in', 'diagonal_pan', 'slow_zoom'],
      moderate: ['drift', 'ken_burns_zoom_out', 'pan_up'],
      slow: ['drift', 'slow_zoom', 'vignette_zoom'],
      contemplative: ['static', 'drift', 'ken_burns_zoom_out']
    };
    return effectsMap[feel];
  }
}
