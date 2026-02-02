import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import logger from '../utils/logger.js';

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  handler: (req: Request, res: Response) => {
    logger.warn({ ip: getClientIp(req), path: req.path }, 'Rate limit exceeded');
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
  keyGenerator: getClientIp,
  handler: (req: Request, res: Response) => {
    logger.warn({ ip: getClientIp(req) }, 'Generate rate limit exceeded');
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
  keyGenerator: getClientIp,
  handler: (req: Request, res: Response) => {
    logger.warn({ ip: getClientIp(req) }, 'Upload rate limit exceeded');
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
  keyGenerator: getClientIp,
  handler: (req: Request, res: Response) => {
    logger.warn({ ip: getClientIp(req) }, 'Auth rate limit exceeded');
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please try again in 15 minutes',
      retryAfter: Math.ceil(15 * 60)
    });
  }
});
