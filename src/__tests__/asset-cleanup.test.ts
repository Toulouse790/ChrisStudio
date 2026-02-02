import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { AssetCleanup } from '../services/asset-cleanup.js';

const TEST_DIR = './test-assets-cleanup';

describe('AssetCleanup', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('cleanupOldAssets', () => {
    it('should handle non-existent directory', async () => {
      const cleanup = new AssetCleanup({
        downloadsDir: './non-existent-dir',
        retentionDays: 7
      });

      const result = await cleanup.cleanupOldAssets();

      expect(result.deletedFiles).toHaveLength(0);
      expect(result.deletedDirs).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should delete old files', async () => {
      const oldFilePath = path.join(TEST_DIR, 'old-file.txt');
      await writeFile(oldFilePath, 'old content');

      const { utimes } = await import('fs/promises');
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      await utimes(oldFilePath, oldDate, oldDate);

      const cleanup = new AssetCleanup({
        downloadsDir: TEST_DIR,
        retentionDays: 7
      });

      const result = await cleanup.cleanupOldAssets();

      expect(result.deletedFiles).toHaveLength(1);
      expect(result.deletedFiles[0]).toContain('old-file.txt');
      expect(existsSync(oldFilePath)).toBe(false);
    });

    it('should keep recent files', async () => {
      const recentFilePath = path.join(TEST_DIR, 'recent-file.txt');
      await writeFile(recentFilePath, 'recent content');

      const cleanup = new AssetCleanup({
        downloadsDir: TEST_DIR,
        retentionDays: 7
      });

      const result = await cleanup.cleanupOldAssets();

      expect(result.deletedFiles).toHaveLength(0);
      expect(existsSync(recentFilePath)).toBe(true);
    });

    it('should work in dry run mode', async () => {
      const filePath = path.join(TEST_DIR, 'test-file.txt');
      await writeFile(filePath, 'test content');

      const { utimes } = await import('fs/promises');
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      await utimes(filePath, oldDate, oldDate);

      const cleanup = new AssetCleanup({
        downloadsDir: TEST_DIR,
        retentionDays: 7,
        dryRun: true
      });

      const result = await cleanup.cleanupOldAssets();

      expect(result.deletedFiles).toHaveLength(1);
      expect(existsSync(filePath)).toBe(true);
    });

    it('should delete empty directories', async () => {
      const subDir = path.join(TEST_DIR, 'empty-subdir');
      await mkdir(subDir, { recursive: true });

      const filePath = path.join(subDir, 'old-file.txt');
      await writeFile(filePath, 'content');

      const { utimes } = await import('fs/promises');
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      await utimes(filePath, oldDate, oldDate);

      const cleanup = new AssetCleanup({
        downloadsDir: TEST_DIR,
        retentionDays: 7
      });

      const result = await cleanup.cleanupOldAssets();

      expect(result.deletedFiles).toHaveLength(1);
      expect(result.deletedDirs).toHaveLength(1);
      expect(existsSync(subDir)).toBe(false);
    });
  });

  describe('getStorageStats', () => {
    it('should return zero stats for non-existent directory', async () => {
      const cleanup = new AssetCleanup({
        downloadsDir: './non-existent-dir'
      });

      const stats = await cleanup.getStorageStats();

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSizeMB).toBe(0);
      expect(stats.oldestFile).toBeNull();
      expect(stats.newestFile).toBeNull();
    });

    it('should calculate correct stats', async () => {
      await writeFile(path.join(TEST_DIR, 'file1.txt'), 'content1');
      await writeFile(path.join(TEST_DIR, 'file2.txt'), 'content2content2');

      const cleanup = new AssetCleanup({
        downloadsDir: TEST_DIR
      });

      const stats = await cleanup.getStorageStats();

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSizeMB).toBeGreaterThan(0);
      expect(stats.oldestFile).not.toBeNull();
      expect(stats.newestFile).not.toBeNull();
    });

    it('should handle nested directories', async () => {
      const subDir = path.join(TEST_DIR, 'subdir');
      await mkdir(subDir, { recursive: true });
      await writeFile(path.join(TEST_DIR, 'file1.txt'), 'content1');
      await writeFile(path.join(subDir, 'file2.txt'), 'content2');

      const cleanup = new AssetCleanup({
        downloadsDir: TEST_DIR
      });

      const stats = await cleanup.getStorageStats();

      expect(stats.totalFiles).toBe(2);
    });
  });
});
