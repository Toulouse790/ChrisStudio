import { mkdir, readFile, writeFile, rename } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';
import { Asset, AssetCategory } from '../types/index.js';

const execAsync = promisify(exec);

export interface AssetLibraryEntry {
  id: string;
  localPath: string;
  type: 'image' | 'video';
  source: 'pexels';
  channelId?: string;
  searchQuery?: string;
  tags: string[];
  /** Reuse category: evergreen (generic) vs episode_specific (topic-specific). */
  category?: AssetCategory;
  /** Normalized keywords derived from searchQuery/tags. */
  keywords?: string[];
  createdAt: string;
  lastUsedAt?: string;
  timesUsed?: number;
  /** For videos if ffprobe is available. */
  mediaDurationSeconds?: number;
  /** Optional lightweight dedup key (mostly for images). */
  sha1?: string;
}

export interface AssetLibraryIndex {
  version: number;
  entries: AssetLibraryEntry[];
}

export interface AssetLibraryConfig {
  indexPath?: string;
  /** Prefer local assets before calling Pexels. Default: true */
  preferLocalAssets?: boolean;
  /** Avoid reuse within X days for evergreen assets (unless library insufficient). Default: 7 */
  reuseWindowDays?: number;
  /** Avoid reuse within X days for episode-specific assets (unless library insufficient). Default: 30 */
  episodeSpecificReuseWindowDays?: number;
  /**
   * If true, allows reusing assets even inside the reuse window when the library cannot satisfy a request.
   * Default: false (prefer filling via Pexels instead of breaking anti-repetition rules).
   */
  allowRecentWhenInsufficient?: boolean;
  /** Minimum score to accept local match. Default: 1 */
  minScore?: number;
}

export interface FindLocalOptions {
  query: string;
  preferredType: 'image' | 'video';
  count: number;
  channelId?: string;
  category?: AssetCategory;
  excludeIds?: Set<string>;
  excludeLocalPaths?: Set<string>;
}

export class AssetLibrary {
  private indexPath: string;
  private preferLocalAssets: boolean;
  private evergreenReuseWindowDays: number;
  private episodeSpecificReuseWindowDays: number;
  private allowRecentWhenInsufficient: boolean;
  private minScore: number;

  private loaded = false;
  private index: AssetLibraryIndex = { version: 1, entries: [] };

  private saveTimer: NodeJS.Timeout | null = null;

  constructor(config: AssetLibraryConfig = {}) {
    this.indexPath = config.indexPath || process.env.ASSET_LIBRARY_PATH || './assets/library.json';
    this.preferLocalAssets =
      typeof config.preferLocalAssets === 'boolean'
        ? config.preferLocalAssets
        : (process.env.PREFER_LOCAL_ASSETS ?? 'true').toLowerCase() !== 'false';
    this.evergreenReuseWindowDays = config.reuseWindowDays ?? parseInt(process.env.ASSET_REUSE_DAYS || '7', 10);
    this.episodeSpecificReuseWindowDays =
      config.episodeSpecificReuseWindowDays ?? parseInt(process.env.ASSET_EPISODE_SPECIFIC_REUSE_DAYS || '30', 10);
    this.allowRecentWhenInsufficient =
      typeof config.allowRecentWhenInsufficient === 'boolean'
        ? config.allowRecentWhenInsufficient
        : (process.env.ALLOW_RECENT_ASSET_REUSE ?? 'false').toLowerCase() === 'true';
    this.minScore = config.minScore ?? parseFloat(process.env.ASSET_LIBRARY_MIN_SCORE || '1');
  }

  isPreferLocalEnabled(): boolean {
    return this.preferLocalAssets;
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    const dir = path.dirname(this.indexPath);
    await mkdir(dir, { recursive: true });

    if (!existsSync(this.indexPath)) {
      this.index = { version: 1, entries: [] };
      this.loaded = true;
      return;
    }

    try {
      const raw = await readFile(this.indexPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.entries)) {
        this.index = { version: parsed.version || 1, entries: parsed.entries };
      } else if (Array.isArray(parsed)) {
        // Legacy fallback if someone stored an array.
        this.index = { version: 1, entries: parsed };
      }
    } catch {
      // Corrupt index: start fresh (robustness over failure).
      this.index = { version: 1, entries: [] };
    }

    // Backward-compat: derive missing category/keywords for older entries.
    let changed = false;
    for (const e of this.index.entries) {
      if (!e.category) {
        e.category = this.deriveCategory(e.searchQuery || e.tags?.join(' ') || '');
        changed = true;
      }
      if (!e.keywords || e.keywords.length === 0) {
        e.keywords = this.tokenizeTags(e.searchQuery || e.tags?.join(' ') || '');
        changed = true;
      }
    }
    if (changed) {
      // Don’t block startup; persist soon.
      this.scheduleSave();
    }

    this.loaded = true;
  }

  async save(): Promise<void> {
    await this.ensureLoaded();
    const dir = path.dirname(this.indexPath);
    await mkdir(dir, { recursive: true });

    const tmp = `${this.indexPath}.tmp`;
    await writeFile(tmp, JSON.stringify(this.index, null, 2));
    await rename(tmp, this.indexPath);
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save().catch(() => undefined);
    }, 250);
  }

  getStats(): { total: number; images: number; videos: number } {
    const total = this.index.entries.length;
    const images = this.index.entries.filter(e => e.type === 'image').length;
    const videos = this.index.entries.filter(e => e.type === 'video').length;
    return { total, images, videos };
  }

  async markUsedById(id: string): Promise<void> {
    await this.ensureLoaded();
    const entry = this.index.entries.find(e => e.id === id);
    if (!entry) return;
    entry.lastUsedAt = new Date().toISOString();
    entry.timesUsed = (entry.timesUsed || 0) + 1;
    this.scheduleSave();
  }

  async markUsedByPath(localPath: string): Promise<void> {
    await this.ensureLoaded();
    const norm = path.normalize(localPath);
    const entry = this.index.entries.find(e => path.normalize(e.localPath) === norm);
    if (!entry) return;
    entry.lastUsedAt = new Date().toISOString();
    entry.timesUsed = (entry.timesUsed || 0) + 1;
    this.scheduleSave();
  }

  async upsertFromDownload(asset: Asset, localPath: string): Promise<AssetLibraryEntry | null> {
    await this.ensureLoaded();

    if (!localPath) return null;
    const normPath = path.normalize(localPath);

    // De-dupe by localPath first.
    let entry = this.index.entries.find(e => path.normalize(e.localPath) === normPath);

    const now = new Date().toISOString();
    const tags = this.tokenizeTags(asset.tags?.length ? asset.tags.join(' ') : (asset.searchQuery || ''));
    const searchQuery = asset.searchQuery || '';
    const category = this.deriveCategory(searchQuery);
    const keywords = this.tokenizeTags(searchQuery || tags.join(' '));

    // Optional sha1 dedup for images
    let sha1: string | undefined;
    if (asset.type === 'image') {
      sha1 = await this.computeSha1(normPath).catch(() => undefined);
      if (sha1) {
        const dup = this.index.entries.find(e => e.sha1 && e.sha1 === sha1);
        if (dup && (!entry || dup.id !== entry.id)) {
          // Don’t index the same content twice.
          return dup;
        }
      }
    }

    const mediaDurationSeconds = asset.type === 'video'
      ? await this.probeDurationSeconds(normPath)
      : undefined;

    if (!entry) {
      entry = {
        id: crypto.randomUUID(),
        localPath: normPath,
        type: asset.type,
        source: 'pexels',
        channelId: asset.channelId,
        searchQuery: asset.searchQuery,
        tags,
        category,
        keywords,
        createdAt: now,
        lastUsedAt: now,
        timesUsed: 1,
        mediaDurationSeconds,
        sha1
      };
      this.index.entries.push(entry);
    } else {
      entry.type = asset.type;
      entry.channelId = entry.channelId || asset.channelId;
      entry.searchQuery = entry.searchQuery || asset.searchQuery;
      entry.tags = Array.from(new Set([...(entry.tags || []), ...tags]));
      entry.category = entry.category || category;
      entry.keywords = Array.from(new Set([...(entry.keywords || []), ...keywords]));
      entry.lastUsedAt = now;
      entry.timesUsed = (entry.timesUsed || 0) + 1;
      entry.mediaDurationSeconds = entry.mediaDurationSeconds || mediaDurationSeconds;
      entry.sha1 = entry.sha1 || sha1;
    }

    await this.save();
    return entry;
  }

  async findBestLocalAssets(options: FindLocalOptions): Promise<Asset[]> {
    await this.ensureLoaded();

    const queryTokens = this.tokenize(options.query);
    if (queryTokens.size === 0) return [];

    const excludeIds = options.excludeIds || new Set<string>();
    const excludeLocalPaths = options.excludeLocalPaths || new Set<string>();

    const candidates = this.index.entries
      .filter(e => e.type === options.preferredType)
      .filter(e => {
        if (!options.category) return true;
        const cat = e.category || this.deriveCategory(e.searchQuery || e.tags?.join(' ') || '');
        return cat === options.category;
      })
      .filter(e => !excludeIds.has(e.id))
      .filter(e => !excludeLocalPaths.has(path.normalize(e.localPath)))
      .filter(e => existsSync(e.localPath))
      .map(e => ({ entry: e, score: this.score(queryTokens, e, options.channelId) }))
      .filter(x => x.score >= this.minScore)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) return [];

    const now = Date.now();
    const evergreenWindowMs = this.evergreenReuseWindowDays * 24 * 60 * 60 * 1000;
    const episodeSpecificWindowMs = this.episodeSpecificReuseWindowDays * 24 * 60 * 60 * 1000;

    const notRecent = candidates.filter(c => {
      if (!c.entry.lastUsedAt) return true;
      const t = Date.parse(c.entry.lastUsedAt);
      const category = c.entry.category || this.deriveCategory(c.entry.searchQuery || c.entry.tags?.join(' ') || '');
      const windowMs = category === 'episode_specific' ? episodeSpecificWindowMs : evergreenWindowMs;
      return Number.isFinite(t) ? (now - t) > windowMs : true;
    });

    const selected: AssetLibraryEntry[] = [];
    for (const c of notRecent) {
      selected.push(c.entry);
      if (selected.length >= options.count) break;
    }

    // If library is insufficient, optionally allow recent assets.
    // Default behavior is strict: caller should fill via Pexels instead of violating anti-repetition.
    if (this.allowRecentWhenInsufficient && selected.length < options.count) {
      for (const c of candidates) {
        if (selected.some(s => s.id === c.entry.id)) continue;
        selected.push(c.entry);
        if (selected.length >= options.count) break;
      }
    }

    return selected.map((e) => ({
      type: e.type,
      url: e.localPath,
      localPath: e.localPath,
      source: 'library',
      libraryId: e.id,
      channelId: e.channelId,
      searchQuery: e.searchQuery,
      tags: e.tags,
      category: e.category || this.deriveCategory(e.searchQuery || e.tags?.join(' ') || ''),
      keywords: e.keywords?.length ? e.keywords : this.tokenizeTags(e.searchQuery || e.tags?.join(' ') || ''),
      mediaDurationSeconds: e.mediaDurationSeconds
    }));
  }

  private deriveCategory(searchQuery: string): AssetCategory {
    const qRaw = (searchQuery || '').trim();
    if (!qRaw) return 'evergreen';

    const q = this.normalizeText(qRaw);

    // Heuristics: treat highly specific entities/events/dates as episode_specific.
    // Intentionally conservative: better to label as episode_specific when unsure.
    const hasQuoted = /["“”'’]/.test(qRaw);
    const hasYear = /\b(1[0-9]{3}|20[0-9]{2}|[5-9][0-9]{2})\b/.test(q);
    const hasEraMarker = /\b(bc|bce|ad|ce)\b/.test(q);
    const hasOrdinalCentury = /\b\d{1,2}(st|nd|rd|th)\b/.test(q);
    const hasRomanNumeral = /\b[ivxlcdm]{2,}\b/.test(q);
    const hasCapitalizedToken = /\b[A-Z][a-z]{2,}\b/.test(qRaw);

    const specificEventKeywords = [
      'battle',
      'siege',
      'assassination',
      'treaty',
      'dynasty',
      'revolution',
      'uprising',
      'incident',
      'operation',
      'crisis',
      'war',
      'crusade',
      'coup',
      'massacre'
    ];
    const hasEventMarker = specificEventKeywords.some(h => q.includes(h));

    // Topic/entity-ish tokens that typically make a query “episode specific” even when lowercased.
    const topicSpecificTokens = [
      // Civilizations / eras / cultures
      'roman', 'rome', 'greek', 'greece', 'sparta', 'athens',
      'egypt', 'egyptian', 'pharaoh',
      'viking', 'norse',
      'medieval', 'middle ages',
      'byzantine', 'ottoman', 'persian', 'mongol',
      'aztec', 'maya', 'mayan', 'inca',
      // Places often used as specific anchors
      'england', 'france', 'spain', 'italy', 'germany',
      'china', 'japan', 'india',
      // People / titles
      'caesar', 'emperor', 'king', 'queen', 'pharaoh'
    ];
    const hasTopicToken = topicSpecificTokens.some(t => q.includes(t));

    if (hasQuoted || hasYear || hasEraMarker || hasOrdinalCentury || hasRomanNumeral || hasCapitalizedToken || hasEventMarker || hasTopicToken) {
      return 'episode_specific';
    }

    return 'evergreen';
  }

  private score(queryTokens: Set<string>, entry: AssetLibraryEntry, channelId?: string): number {
    const tagsTokens = new Set((entry.tags || []).map(t => t.toLowerCase()));
    let overlap = 0;
    for (const t of queryTokens) {
      if (tagsTokens.has(t)) overlap++;
    }

    let score = overlap;

    if (channelId && entry.channelId && channelId === entry.channelId) {
      score += 0.75;
    }

    // Penalize “too used” assets a bit.
    const times = entry.timesUsed || 0;
    score -= Math.min(2, times * 0.08);

    // Penalize very recent usage (even if we later allow it).
    if (entry.lastUsedAt) {
      const ageMs = Date.now() - Date.parse(entry.lastUsedAt);
      if (Number.isFinite(ageMs)) {
        const ageDays = ageMs / (24 * 60 * 60 * 1000);
        if (ageDays < 1) score -= 1.5;
        else if (ageDays < 3) score -= 0.8;
      }
    }

    return score;
  }

  private normalizeText(text: string): string {
    return (text || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      this.normalizeText(text)
        .split(/[^\p{L}\p{N}]+/gu)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => s.length > 2)
        .filter(s => !STOPWORDS.has(s))
    );
  }

  private tokenizeTags(text: string): string[] {
    return Array.from(this.tokenize(text));
  }

  private async computeSha1(filePath: string): Promise<string> {
    const data = await readFile(filePath);
    const hash = crypto.createHash('sha1');
    hash.update(data);
    return hash.digest('hex');
  }

  private async probeDurationSeconds(mediaPath: string): Promise<number | undefined> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -i "${mediaPath}" -show_entries format=duration -v quiet -of csv="p=0"`
      );
      const value = parseFloat(stdout.trim());
      return Number.isFinite(value) && value > 0 ? value : undefined;
    } catch {
      return undefined;
    }
  }
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'over', 'under',
  'about', 'your', 'you', 'are', 'was', 'were', 'has', 'have', 'had', 'will',
  'its', 'our', 'their', 'they', 'them', 'his', 'her', 'she', 'him', 'who',
  'what', 'when', 'where', 'why', 'how', 'a', 'an', 'to', 'of', 'in', 'on',
  'at', 'by', 'as', 'or', 'is', 'it', 'be', 'we', 'us', 'not', 'no', 'yes',
  'more', 'most', 'less', 'many', 'much', 'new', 'old', 'case', 'file',
  // French/common fillers
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'et', 'ou', 'pour',
  'avec', 'dans', 'sur', 'sous', 'ce', 'cet', 'cette', 'ces', 'comme',
  'plus', 'moins', 'tres', 'trop', 'sans',
]);
