import { describe, it, expect } from 'vitest';
import { channels } from '../config/channels.js';

describe('Channel Configuration', () => {
  it('should have all required channels', () => {
    expect(channels).toHaveProperty('what-if');
    expect(channels).toHaveProperty('human-odyssey');
    expect(channels).toHaveProperty('classified-files');
  });

  describe.each(Object.entries(channels))('Channel: %s', (channelId, channel) => {
    it('should have required properties', () => {
      expect(channel.id).toBe(channelId);
      expect(channel.name).toBeDefined();
      expect(channel.description).toBeDefined();
    });

    it('should have valid style configuration', () => {
      expect(channel.style).toBeDefined();
      expect(channel.style.theme).toBeDefined();
      expect(['sci-fi', 'historical', 'mysterious']).toContain(channel.style.theme);
      expect(channel.style.musicGenre).toBeDefined();
      expect(channel.style.visualStyle).toBeDefined();
      expect(channel.style.colorGrading).toBeDefined();
    });

    it('should have valid voice configuration', () => {
      expect(channel.voice).toBeDefined();
      expect(channel.voice.provider).toBeDefined();
      expect(['elevenlabs', 'edge-tts']).toContain(channel.voice.provider);
      expect(channel.voice.voiceId).toBeDefined();
      expect(channel.voice.voiceId.length).toBeGreaterThan(0);

      if (channel.voice.provider === 'elevenlabs') {
        if (channel.voice.stability !== undefined) {
          expect(channel.voice.stability).toBeGreaterThanOrEqual(0);
          expect(channel.voice.stability).toBeLessThanOrEqual(1);
        }
        if (channel.voice.similarityBoost !== undefined) {
          expect(channel.voice.similarityBoost).toBeGreaterThanOrEqual(0);
          expect(channel.voice.similarityBoost).toBeLessThanOrEqual(1);
        }
        if (channel.voice.style !== undefined) {
          expect(channel.voice.style).toBeGreaterThanOrEqual(0);
          expect(channel.voice.style).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should have valid pacing configuration', () => {
      if (channel.pacing) {
        expect(channel.pacing.minShotSeconds).toBeGreaterThan(0);
        expect(channel.pacing.maxShotSeconds).toBeGreaterThan(channel.pacing.minShotSeconds);
      }
    });

    it('should have valid visual mix configuration', () => {
      if (channel.visualMix) {
        expect(channel.visualMix.image).toBeGreaterThanOrEqual(0);
        expect(channel.visualMix.image).toBeLessThanOrEqual(1);
        expect(channel.visualMix.video).toBeGreaterThanOrEqual(0);
        expect(channel.visualMix.video).toBeLessThanOrEqual(1);
        expect(channel.visualMix.image + channel.visualMix.video).toBeCloseTo(1, 1);
      }
    });

    it('should have valid asset reuse mix configuration', () => {
      if (channel.assetReuseMix) {
        expect(channel.assetReuseMix.evergreen).toBeGreaterThanOrEqual(0);
        expect(channel.assetReuseMix.evergreen).toBeLessThanOrEqual(1);
        expect(channel.assetReuseMix.episode_specific).toBeGreaterThanOrEqual(0);
        expect(channel.assetReuseMix.episode_specific).toBeLessThanOrEqual(1);
        expect(channel.assetReuseMix.evergreen + channel.assetReuseMix.episode_specific).toBeCloseTo(1, 1);
      }
    });

    it('should have valid branding configuration', () => {
      if (channel.branding) {
        expect(channel.branding.stingText).toBeDefined();
        expect(channel.branding.softCtaText).toBeDefined();
        expect(channel.branding.finalCtaText).toBeDefined();
        expect(channel.branding.outroTeaserText).toBeDefined();

        if (channel.branding.overlay) {
          expect(channel.branding.overlay.stingStartSeconds).toBeGreaterThanOrEqual(0);
          expect(channel.branding.overlay.stingDurationSeconds).toBeGreaterThan(0);
          expect(channel.branding.overlay.softCtaStartSeconds).toBeGreaterThan(0);
          expect(channel.branding.overlay.softCtaDurationSeconds).toBeGreaterThan(0);
        }

        if (channel.branding.overlayStyle) {
          if (channel.branding.overlayStyle.fontSize) {
            expect(channel.branding.overlayStyle.fontSize).toBeGreaterThan(0);
          }
          if (channel.branding.overlayStyle.boxOpacity !== undefined) {
            expect(channel.branding.overlayStyle.boxOpacity).toBeGreaterThanOrEqual(0);
            expect(channel.branding.overlayStyle.boxOpacity).toBeLessThanOrEqual(1);
          }
        }
      }
    });
  });

  describe('what-if channel specifics', () => {
    it('should have sci-fi theme', () => {
      expect(channels['what-if'].style.theme).toBe('sci-fi');
    });

    it('should use ElevenLabs voice', () => {
      expect(channels['what-if'].voice.provider).toBe('elevenlabs');
      expect(channels['what-if'].voice.voiceId).toBe('gnPxliFHTp6OK6tcoA6i');
    });
  });

  describe('human-odyssey channel specifics', () => {
    it('should have historical theme', () => {
      expect(channels['human-odyssey'].style.theme).toBe('historical');
    });

    it('should use ElevenLabs voice', () => {
      expect(channels['human-odyssey'].voice.provider).toBe('elevenlabs');
      expect(channels['human-odyssey'].voice.voiceId).toBe('QIhD5ivPGEoYZQDocuHI');
    });
  });

  describe('classified-files channel specifics', () => {
    it('should have mysterious theme', () => {
      expect(channels['classified-files'].style.theme).toBe('mysterious');
    });

    it('should use ElevenLabs voice', () => {
      expect(channels['classified-files'].voice.provider).toBe('elevenlabs');
      expect(channels['classified-files'].voice.voiceId).toBe('2gPFXx8pN3Avh27Dw5Ma');
    });
  });
});
