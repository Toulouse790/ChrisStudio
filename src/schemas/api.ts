import { z } from 'zod';

export const generateVideoSchema = z.object({
  channelId: z
    .string()
    .min(1, 'channelId is required')
    .max(50, 'channelId too long'),
  topic: z
    .string()
    .min(3, 'topic must be at least 3 characters')
    .max(500, 'topic must be at most 500 characters'),
  mode: z.enum(['full', 'script-only', 'audio-only']).default('full')
});

export const scheduleVideoSchema = z.object({
  channelId: z
    .string()
    .min(1, 'channelId is required')
    .max(50, 'channelId too long'),
  topic: z
    .string()
    .min(3, 'topic must be at least 3 characters')
    .max(500, 'topic must be at most 500 characters'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format'
  })
});

export const updateScheduleSchema = z.object({
  topic: z.string().min(3).max(500).optional(),
  status: z.enum(['pending', 'generating', 'ready', 'published', 'failed']).optional(),
  scheduledDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format'
  }).optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

export const youtubeUploadSchema = z.object({
  videoId: z.string().min(1, 'videoId is required'),
  config: z.object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(5000).optional(),
    tags: z.array(z.string().max(30)).max(500).optional(),
    category: z.string().optional(),
    privacy: z.enum(['private', 'unlisted', 'public']).optional()
  }).optional()
});

export const youtubePublishSchema = z.object({
  videoPath: z.string().min(1, 'videoPath is required'),
  metadata: z.object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(5000).optional(),
    tags: z.array(z.string().max(30)).max(500).optional(),
    categoryId: z.string().optional(),
    privacyStatus: z.enum(['private', 'unlisted', 'public']).optional()
  }).optional()
});

export const prepublishValidateSchema = z.object({
  videoPath: z.string().min(1, 'videoPath is required'),
  metadata: z.object({
    title: z.string().max(100).optional(),
    description: z.string().max(5000).optional(),
    tags: z.array(z.string().max(30)).optional()
  }).optional()
});

export const regenerateAssetsSchema = z.object({
  videoPath: z.string().min(1, 'videoPath is required'),
  forceImagesOnly: z.boolean().optional(),
  minClips: z.number().int().min(0).max(100).optional()
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'id is required').max(100)
});

export const filenameParamSchema = z.object({
  filename: z
    .string()
    .min(1, 'filename is required')
    .max(255)
    .refine((val) => !val.includes('..') && !val.includes('/'), {
      message: 'Invalid filename'
    })
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;
export type ScheduleVideoInput = z.infer<typeof scheduleVideoSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type YouTubeUploadInput = z.infer<typeof youtubeUploadSchema>;
export type YouTubePublishInput = z.infer<typeof youtubePublishSchema>;
export type PrepublishValidateInput = z.infer<typeof prepublishValidateSchema>;
export type RegenerateAssetsInput = z.infer<typeof regenerateAssetsSchema>;
