import { readdir, stat, unlink, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

export interface AssetCleanupConfig {
  downloadsDir?: string;
  retentionDays?: number;
  dryRun?: boolean;
}

export interface CleanupResult {
  deletedFiles: string[];
  deletedDirs: string[];
  freedBytes: number;
  errors: string[];
}

export class AssetCleanup {
  private downloadsDir: string;
  private retentionDays: number;
  private dryRun: boolean;

  constructor(config: AssetCleanupConfig = {}) {
    this.downloadsDir = config.downloadsDir || process.env.ASSETS_DOWNLOADS_DIR || './assets/downloads';
    this.retentionDays = config.retentionDays ?? parseInt(process.env.ASSET_RETENTION_DAYS || '7', 10);
    this.dryRun = config.dryRun ?? false;
  }

  async cleanupOldAssets(): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedFiles: [],
      deletedDirs: [],
      freedBytes: 0,
      errors: []
    };

    if (!existsSync(this.downloadsDir)) {
      logger.info({ dir: this.downloadsDir }, 'Downloads directory does not exist, nothing to clean');
      return result;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    const cutoffTime = cutoffDate.getTime();

    logger.info(
      { dir: this.downloadsDir, retentionDays: this.retentionDays, cutoffDate: cutoffDate.toISOString(), dryRun: this.dryRun },
      'Starting asset cleanup'
    );

    try {
      await this.cleanDirectory(this.downloadsDir, cutoffTime, result);
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Cleanup failed');
      result.errors.push(err.message);
    }

    logger.info(
      {
        deletedFiles: result.deletedFiles.length,
        deletedDirs: result.deletedDirs.length,
        freedMB: (result.freedBytes / 1024 / 1024).toFixed(2),
        errors: result.errors.length
      },
      'Asset cleanup complete'
    );

    return result;
  }

  private async cleanDirectory(dirPath: string, cutoffTime: number, result: CleanupResult): Promise<boolean> {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let isEmpty = true;

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      try {
        if (entry.isDirectory()) {
          const subDirEmpty = await this.cleanDirectory(fullPath, cutoffTime, result);
          if (subDirEmpty) {
            if (!this.dryRun) {
              await rmdir(fullPath);
            }
            result.deletedDirs.push(fullPath);
            logger.debug({ path: fullPath, dryRun: this.dryRun }, 'Deleted empty directory');
          } else {
            isEmpty = false;
          }
        } else if (entry.isFile()) {
          const stats = await stat(fullPath);
          const fileAge = stats.mtime.getTime();

          if (fileAge < cutoffTime) {
            if (!this.dryRun) {
              await unlink(fullPath);
            }
            result.deletedFiles.push(fullPath);
            result.freedBytes += stats.size;
            logger.debug(
              { path: fullPath, sizeMB: (stats.size / 1024 / 1024).toFixed(2), dryRun: this.dryRun },
              'Deleted old file'
            );
          } else {
            isEmpty = false;
          }
        }
      } catch (error) {
        const err = error as Error;
        result.errors.push(`Failed to process ${fullPath}: ${err.message}`);
        logger.warn({ path: fullPath, error: err.message }, 'Failed to process entry');
        isEmpty = false;
      }
    }

    return isEmpty;
  }

  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSizeMB: number;
    oldestFile: Date | null;
    newestFile: Date | null;
  }> {
    const stats = {
      totalFiles: 0,
      totalSizeMB: 0,
      oldestFile: null as Date | null,
      newestFile: null as Date | null
    };

    if (!existsSync(this.downloadsDir)) {
      return stats;
    }

    await this.collectStats(this.downloadsDir, stats);
    return stats;
  }

  private async collectStats(
    dirPath: string,
    stats: { totalFiles: number; totalSizeMB: number; oldestFile: Date | null; newestFile: Date | null }
  ): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.collectStats(fullPath, stats);
      } else if (entry.isFile()) {
        const fileStat = await stat(fullPath);
        stats.totalFiles++;
        stats.totalSizeMB += fileStat.size / 1024 / 1024;

        const mtime = fileStat.mtime;
        if (!stats.oldestFile || mtime < stats.oldestFile) {
          stats.oldestFile = mtime;
        }
        if (!stats.newestFile || mtime > stats.newestFile) {
          stats.newestFile = mtime;
        }
      }
    }
  }
}

export const startScheduledCleanup = (intervalHours: number = 24): NodeJS.Timeout => {
  const cleanup = new AssetCleanup();

  const runCleanup = async () => {
    logger.info('Running scheduled asset cleanup');
    await cleanup.cleanupOldAssets();
  };

  runCleanup();

  const intervalMs = intervalHours * 60 * 60 * 1000;
  return setInterval(runCleanup, intervalMs);
};
