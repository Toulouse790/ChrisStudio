import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'change-this-secret-in-production') {
    if (isAuthEnabled()) {
      throw new Error(
        'FATAL: JWT_SECRET is not set or is using the default value. ' +
        'Set a strong random secret (at least 32 characters) in your .env file.'
      );
    }
    // Auth disabled: use a random ephemeral secret so tokens still work for the session
    return `ephemeral-${Date.now()}-${Math.random()}`;
  }
  if (secret.length < 32) {
    logger.warn('JWT_SECRET is shorter than 32 characters. Use a stronger secret in production.');
  }
  return secret;
}

const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

/** Read ADMIN_PASSWORD_HASH dynamically so env changes are picked up. */
function getAdminPasswordHash(): string {
  return process.env.ADMIN_PASSWORD_HASH || '';
}

export interface AuthUser {
  username: string;
  role: 'admin' | 'user';
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const generateToken = (user: AuthUser): string => {
  return jwt.sign(user, getJwtSecret(), { expiresIn: JWT_EXPIRATION as jwt.SignOptions['expiresIn'] });
};

export const verifyToken = (token: string): AuthUser | null => {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthUser;
  } catch {
    return null;
  }
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!isAuthEnabled()) {
    req.user = { username: 'anonymous', role: 'admin' };
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  const user = verifyToken(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = user;
  logger.debug({ username: user.username }, 'User authenticated');
  next();
};

export const optionalAuthMiddleware = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
};

export const adminOnlyMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

export const isAuthEnabled = (): boolean => {
  return process.env.AUTH_ENABLED === 'true' && !!getAdminPasswordHash();
};

export const authenticateUser = async (username: string, password: string): Promise<AuthUser | null> => {
  const hash = getAdminPasswordHash();
  if (username === ADMIN_USERNAME && hash) {
    const valid = await verifyPassword(password, hash);
    if (valid) {
      return { username, role: 'admin' };
    }
  }
  return null;
};
