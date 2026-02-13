import { promisify } from 'util';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { channels } from '../config/channels.js';
import { VideoScript } from '../types/index.js';

const execFileAsync = promisify(execFile);

export type PrepublishActionKind =
  | 'regen_assets'
  | 'regen_assets_images_only'
  | 'regen_assets_more_clips'
  | 'regen_full';

export interface PrepublishAction {
  kind: PrepublishActionKind;
  label: string;
  payload?: Record<string, any>;
}

export interface PrepublishCheck {
  id: string;
  label: string;
  ok: boolean;
  details?: string;
  actions?: PrepublishAction[];
}

export interface PrepublishReport {
  ok: boolean;
  projectId: string;
  channelId?: string;
  durations?: { audioSeconds: number; videoSeconds: number; deltaSeconds: number };
  stats?: { beatsUsable: number; clipsUsable: number; placeholders: number };
  checks: PrepublishCheck[];
}

export class PrepublishValidator {
  async validate(params: {
    videoAbsPath: string;
    videoUiPath: string;
    metadata?: { title?: string; description?: string; tags?: string[] };
  }): Promise<PrepublishReport> {
    const projectId = path.basename(params.videoAbsPath).replace(/\.mp4$/i, '');
    const scriptPath = path.resolve(process.cwd(), 'output', 'scripts', `${projectId}.json`);
    const audioPath = path.resolve(process.cwd(), 'output', 'audio', `${projectId}.mp3`);
    const metaPath = path.resolve(process.cwd(), 'output', 'meta', `${projectId}.json`);

    const channelId = this.inferChannelIdFromProjectId(projectId);
    const channel = channelId ? channels[channelId] : undefined;

    const checks: PrepublishCheck[] = [];

    // Load durations
    const audioSeconds = existsSync(audioPath) ? await this.probeDurationSeconds(audioPath) : NaN;
    const videoSeconds = existsSync(params.videoAbsPath) ? await this.probeDurationSeconds(params.videoAbsPath) : NaN;
    const deltaSeconds = Number.isFinite(audioSeconds) && Number.isFinite(videoSeconds)
      ? Math.abs(audioSeconds - videoSeconds)
      : NaN;

    // Load script (optional, used for sanity)
    let script: VideoScript | null = null;
    try {
      script = JSON.parse(await readFile(scriptPath, 'utf-8')) as VideoScript;
    } catch {
      script = null;
    }

    // Load manifest (required for “never publish ratée” guarantees)
    let manifest: any = null;
    try {
      manifest = JSON.parse(await readFile(metaPath, 'utf-8'));
    } catch {
      manifest = null;
    }

    const beatsPlanned = typeof manifest?.beatsPlanned === 'number' ? manifest.beatsPlanned : null;

    const beatsUsable = Array.isArray(manifest?.downloadedAssets)
      ? manifest.downloadedAssets.filter((a: any) => a?.localPath && existsSync(a.localPath)).length
      : 0;

    const clipsUsable = Array.isArray(manifest?.downloadedAssets)
      ? manifest.downloadedAssets.filter((a: any) => a?.type === 'video' && a?.localPath && existsSync(a.localPath)).length
      : 0;

    const placeholders = Array.isArray(manifest?.collectedAssets)
      ? manifest.collectedAssets.filter((a: any) => this.isPlaceholderAsset(a)).length
      : (Array.isArray(manifest?.downloadedAssets)
        ? manifest.downloadedAssets.filter((a: any) => this.isPlaceholderAsset(a)).length
        : 0);

    const forceImagesOnly = !!manifest?.forceImagesOnly;

    // ✅ Audio duration = Video duration (match)
    {
      const ok = Number.isFinite(deltaSeconds) && deltaSeconds <= 0.35;
      checks.push({
        id: 'audio_video_match',
        label: 'Audio duration = Video duration',
        ok,
        details: Number.isFinite(deltaSeconds)
          ? `Δ ${(deltaSeconds).toFixed(2)}s`
          : 'Durée inconnue (ffprobe)'
      });
    }

    // ✅ Durée totale ≥ 9:00
    {
      const ok = Number.isFinite(audioSeconds) && audioSeconds >= 9 * 60;
      checks.push({
        id: 'min_duration',
        label: 'Durée totale ≥ 9:00',
        ok,
        details: Number.isFinite(audioSeconds) ? `${this.formatDuration(audioSeconds)}` : 'Audio introuvable',
        actions: ok
          ? undefined
          : [
            { kind: 'regen_full', label: 'Allonger script (relancer génération complète)' }
          ]
      });
    }

    // ✅ Beats count ≥ 60 (use planned beats when available; fallback to usable)
    {
      const beatsCount = typeof beatsPlanned === 'number' && beatsPlanned > 0 ? beatsPlanned : beatsUsable;
      const ok = beatsCount >= 60;
      const actions: PrepublishAction[] = [];
      if (!ok) {
        actions.push({ kind: 'regen_assets', label: 'Regénérer assets (garder script/audio)' });
      }
      checks.push({
        id: 'beats_min',
        label: 'Beats count ≥ 60',
        ok,
        details: manifest
          ? (typeof beatsPlanned === 'number' && beatsPlanned > 0
            ? `${beatsPlanned} beats planifiés (${beatsUsable} utilisables)`
            : `${beatsUsable} beats utilisables`)
          : 'Manifest manquant (impossible de vérifier)',
        actions: actions.length ? actions : undefined
      });
    }

    // ✅ 0 placeholder
    {
      const ok = manifest ? placeholders === 0 : false;
      const actions: PrepublishAction[] = [];
      if (!ok) {
        actions.push({ kind: 'regen_assets', label: 'Regénérer assets' });
        actions.push({ kind: 'regen_assets_images_only', label: 'Forcer images-only + regénérer assets' });
      }
      checks.push({
        id: 'no_placeholders',
        label: '0 placeholder',
        ok,
        details: manifest ? `${placeholders} placeholder(s)` : 'Manifest manquant (bloquant)',
        actions: actions.length ? actions : undefined
      });
    }

    // ✅ Ratio visuels : au moins 10 clips (si chaîne le permet) sinon tout en images OK
    {
      const channelAllowsClips = !!channel && (channel.visualMix?.video ?? 0) > 0;
      const ok = !channelAllowsClips || forceImagesOnly || clipsUsable >= 10;

      const actions: PrepublishAction[] = [];
      if (channelAllowsClips && !ok) {
        actions.push({ kind: 'regen_assets_more_clips', label: 'Regénérer assets (viser ≥10 clips)', payload: { minClips: 10 } });
        actions.push({ kind: 'regen_assets_images_only', label: 'Forcer images-only (OK si clips impossibles)' });
      }

      checks.push({
        id: 'clips_ratio',
        label: 'Ratio visuels (clips)',
        ok,
        details: channelAllowsClips
          ? (forceImagesOnly ? 'images-only forcé' : `${clipsUsable} clip(s) utilisables`)
          : 'clips non requis (chaîne images-only)',
        actions: actions.length ? actions : undefined
      });
    }

    // ✅ Titre/description/tags non vides
    {
      const title = (params.metadata?.title || script?.title || '').trim();
      const description = (params.metadata?.description || '').trim();
      const tags = Array.isArray(params.metadata?.tags) ? params.metadata!.tags.filter(Boolean) : [];

      const ok = !!title && !!description && tags.length > 0;
      checks.push({
        id: 'metadata_non_empty',
        label: 'Titre/description/tags non vides',
        ok,
        details: ok ? 'OK' : 'Remplir les champs avant upload'
      });
    }

    // Extra safety: if no manifest, block publish (we cannot guarantee no placeholder / beats / clips)
    if (!manifest) {
      checks.push({
        id: 'manifest_present',
        label: 'Manifest de génération présent',
        ok: false,
        details: 'Fichier output/meta/*.json manquant — impossible de garantir la qualité',
        actions: [{ kind: 'regen_assets', label: 'Regénérer assets (créera un manifest)' }]
      });
    }

    const ok = checks.every(c => c.ok);

    return {
      ok,
      projectId,
      channelId: channel?.id,
      durations: {
        audioSeconds: Number.isFinite(audioSeconds) ? audioSeconds : 0,
        videoSeconds: Number.isFinite(videoSeconds) ? videoSeconds : 0,
        deltaSeconds: Number.isFinite(deltaSeconds) ? deltaSeconds : 0
      },
      stats: { beatsUsable, clipsUsable, placeholders },
      checks
    };
  }

  private inferChannelIdFromProjectId(projectId: string): string | null {
    // projectId format is usually `${channel.id}-${timestamp}` where channel.id can contain '-'
    const keys = Object.keys(channels);
    const matches = keys
      .filter((k) => projectId === k || projectId.startsWith(k + '-'))
      .sort((a, b) => b.length - a.length);
    return matches[0] || null;
  }

  private isPlaceholderAsset(asset: any): boolean {
    const url = String(asset?.url || '');
    const attribution = String(asset?.attribution || '');
    return url.includes('via.placeholder.com') || /placeholder/i.test(attribution);
  }

  private async probeDurationSeconds(mediaPath: string): Promise<number> {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-i', mediaPath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0']
    );
    const value = parseFloat(String(stdout || '').trim());
    if (!Number.isFinite(value) || value <= 0) {
      return NaN;
    }
    return value;
  }

  private formatDuration(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }
}
