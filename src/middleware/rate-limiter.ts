import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import logger from '../utils/logger.js';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Rate limit exceeded');
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later',
      retryAfter: Math.ceil(15 * 60)
    });
  }
});

export const generateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 video generations per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({ ip: req.ip }, 'Generate rate limit exceeded');
    res.status(429).json({
      error: 'Too many generation requests',
      message: 'Video generation is limited to 10 per hour',
      retryAfter: Math.ceil(60 * 60)
    });
  }
});

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({ ip: req.ip }, 'Upload rate limit exceeded');
    res.status(429).json({
      error: 'Too many upload requests',
      message: 'YouTube uploads are limited to 20 per hour',
      retryAfter: Math.ceil(60 * 60)
    });
  }
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({ ip: req.ip }, 'Auth rate limit exceeded');
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please try again in 15 minutes',
      retryAfter: Math.ceil(15 * 60)
    });
  }
});
