import { describe, it, expect } from 'vitest';
import {
  generateVideoSchema,
  scheduleVideoSchema,
  updateScheduleSchema,
  youtubeUploadSchema,
  youtubePublishSchema,
  prepublishValidateSchema,
  regenerateAssetsSchema,
  idParamSchema,
  filenameParamSchema
} from '../schemas/api.js';

describe('API Validation Schemas', () => {
  describe('generateVideoSchema', () => {
    it('should accept valid input', () => {
      const input = {
        channelId: 'what-if',
        topic: 'What if humans could fly?',
        mode: 'full'
      };
      const result = generateVideoSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject missing channelId', () => {
      const input = {
        topic: 'What if humans could fly?'
      };
      const result = generateVideoSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject topic too short', () => {
      const input = {
        channelId: 'what-if',
        topic: 'ab'
      };
      const result = generateVideoSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject topic too long', () => {
      const input = {
        channelId: 'what-if',
        topic: 'a'.repeat(501)
      };
      const result = generateVideoSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should default mode to full', () => {
      const input = {
        channelId: 'what-if',
        topic: 'What if humans could fly?'
      };
      const result = generateVideoSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('full');
      }
    });

    it('should reject invalid mode', () => {
      const input = {
        channelId: 'what-if',
        topic: 'What if humans could fly?',
        mode: 'invalid'
      };
      const result = generateVideoSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('scheduleVideoSchema', () => {
    it('should accept valid input', () => {
      const input = {
        channelId: 'human-odyssey',
        topic: 'The Rise of Rome',
        date: '2026-02-15T10:00:00Z'
      };
      const result = scheduleVideoSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid date', () => {
      const input = {
        channelId: 'human-odyssey',
        topic: 'The Rise of Rome',
        date: 'not-a-date'
      };
      const result = scheduleVideoSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateScheduleSchema', () => {
    it('should accept valid partial update', () => {
      const input = {
        topic: 'Updated topic'
      };
      const result = updateScheduleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept status update', () => {
      const input = {
        status: 'ready'
      };
      const result = updateScheduleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty object', () => {
      const input = {};
      const result = updateScheduleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const input = {
        status: 'invalid-status'
      };
      const result = updateScheduleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('youtubeUploadSchema', () => {
    it('should accept valid input', () => {
      const input = {
        videoId: 'video-123',
        config: {
          title: 'My Video Title',
          description: 'Video description',
          tags: ['tag1', 'tag2'],
          privacy: 'unlisted'
        }
      };
      const result = youtubeUploadSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept minimal input', () => {
      const input = {
        videoId: 'video-123'
      };
      const result = youtubeUploadSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject missing videoId', () => {
      const input = {
        config: {
          title: 'My Video'
        }
      };
      const result = youtubeUploadSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('youtubePublishSchema', () => {
    it('should accept valid input', () => {
      const input = {
        videoPath: '/output/videos/my-video.mp4',
        metadata: {
          title: 'My Video',
          description: 'Description',
          tags: ['tag1'],
          privacyStatus: 'private'
        }
      };
      const result = youtubePublishSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid privacy status', () => {
      const input = {
        videoPath: '/output/videos/my-video.mp4',
        metadata: {
          privacyStatus: 'invalid'
        }
      };
      const result = youtubePublishSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('prepublishValidateSchema', () => {
    it('should accept valid input', () => {
      const input = {
        videoPath: '/output/videos/test.mp4',
        metadata: {
          title: 'Test Video',
          description: 'Test description'
        }
      };
      const result = prepublishValidateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject title too long', () => {
      const input = {
        videoPath: '/output/videos/test.mp4',
        metadata: {
          title: 'a'.repeat(101)
        }
      };
      const result = prepublishValidateSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('regenerateAssetsSchema', () => {
    it('should accept valid input', () => {
      const input = {
        videoPath: '/output/videos/test.mp4',
        forceImagesOnly: true,
        minClips: 5
      };
      const result = regenerateAssetsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject negative minClips', () => {
      const input = {
        videoPath: '/output/videos/test.mp4',
        minClips: -1
      };
      const result = regenerateAssetsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject minClips > 100', () => {
      const input = {
        videoPath: '/output/videos/test.mp4',
        minClips: 101
      };
      const result = regenerateAssetsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('idParamSchema', () => {
    it('should accept valid id', () => {
      const input = { id: 'video-123-abc' };
      const result = idParamSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty id', () => {
      const input = { id: '' };
      const result = idParamSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject id too long', () => {
      const input = { id: 'a'.repeat(101) };
      const result = idParamSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('filenameParamSchema', () => {
    it('should accept valid filename', () => {
      const input = { filename: 'my-video.mp4' };
      const result = filenameParamSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject path traversal', () => {
      const input = { filename: '../../../etc/passwd' };
      const result = filenameParamSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject filename with slash', () => {
      const input = { filename: 'path/to/file.mp4' };
      const result = filenameParamSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty filename', () => {
      const input = { filename: '' };
      const result = filenameParamSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
