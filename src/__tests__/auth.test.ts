import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateToken, verifyToken, hashPassword, verifyPassword, isAuthEnabled } from '../middleware/auth.js';

describe('Authentication', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    // Provide a strong JWT secret for token tests
    vi.stubEnv('JWT_SECRET', 'test-secret-that-is-at-least-32-characters-long!');
  });

  describe('generateToken and verifyToken', () => {
    it('should generate and verify a valid token', () => {
      const user = { username: 'testuser', role: 'admin' as const };
      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = verifyToken(token);
      expect(verified).toBeDefined();
      expect(verified?.username).toBe('testuser');
      expect(verified?.role).toBe('admin');
    });

    it('should return null for invalid token', () => {
      const result = verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for empty token', () => {
      const result = verifyToken('');
      expect(result).toBeNull();
    });
  });

  describe('hashPassword and verifyPassword', () => {
    it('should hash and verify password correctly', async () => {
      const password = 'mySecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const password = 'mySecurePassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('wrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'mySecurePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);

      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('isAuthEnabled', () => {
    it('should return false when AUTH_ENABLED is not set', () => {
      vi.stubEnv('AUTH_ENABLED', '');
      vi.stubEnv('ADMIN_PASSWORD_HASH', '');
      expect(isAuthEnabled()).toBe(false);
    });

    it('should return false when AUTH_ENABLED is true but no password hash', () => {
      vi.stubEnv('AUTH_ENABLED', 'true');
      vi.stubEnv('ADMIN_PASSWORD_HASH', '');
      expect(isAuthEnabled()).toBe(false);
    });
  });
});
