/**
 * photoArchiver
 * =============
 *
 * Archives in-run photos to the user's Photos library. The "Photos library"
 * is our last-resort backup: even if every backend upload fails forever, the
 * user still has the full-resolution originals in their camera roll.
 *
 * Strategy:
 *   - Permission scope is *write-only* — the friendly "Add to Photos?"
 *     single-button prompt. We never ask for full-library read access; we
 *     don't need it. (Pre-Build 32 we did, and silent denial cost a user
 *     their entire run's photos. Never again.)
 *   - The original (full-res, straight from the camera) is what we write to
 *     Photos, not the 2400px upload version. Users get the canonical file.
 *   - State is recorded in the manifest, not module memory, so a denied
 *     permission doesn't disappear when the app is reaped.
 *   - "ZenRun" album is best-effort. Album APIs require read permission we
 *     don't have under writeOnly; if it fails the photo still lands in the
 *     camera roll, which is the bit that matters.
 *
 * Public surface:
 *   - archivePhoto(sessionId, photoId, sourceUri) — save one
 *   - drainPendingArchives()                     — retry any pending
 *   - getMediaPermissionState()                  — for the banner UI
 *   - openPhotosSettings()                       — deep-link to Settings
 */

import { Linking } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { listSessions, loadManifest, updatePhoto } from './photoSession';

const ZENRUN_ALBUM_NAME = 'ZenRun';

/** Cached so we don't re-prompt every capture in the same session. */
type PermState = 'unknown' | 'granted' | 'denied';
let permState: PermState = 'unknown';

/**
 * Probe permission. If we don't yet know, ask once with the writeOnly
 * scope. If the user previously denied, we surface that without re-asking
 * (the OS won't show the prompt anyway after the first denial — we'd just
 * be no-op'ing). The banner UI is responsible for guiding the user to
 * Settings when they want to re-grant.
 */
export async function ensureMediaPermission(): Promise<boolean> {
  if (permState === 'granted') return true;
  if (permState === 'unknown') {
    const existing = await MediaLibrary.getPermissionsAsync(true);
    if (existing.granted) {
      permState = 'granted';
      return true;
    }
    if (!existing.canAskAgain) {
      permState = 'denied';
      return false;
    }
    const next = await MediaLibrary.requestPermissionsAsync(true);
    permState = next.granted ? 'granted' : 'denied';
    return next.granted;
  }
  // We saw 'denied' earlier — re-probe in case the user changed Settings
  // and came back without re-launching. iOS pushes the new state through
  // getPermissionsAsync.
  const fresh = await MediaLibrary.getPermissionsAsync(true);
  if (fresh.granted) {
    permState = 'granted';
    return true;
  }
  return false;
}

/** Read the cached permission state without prompting. UI helper. */
export async function getMediaPermissionState(): Promise<PermState> {
  if (permState !== 'unknown') return permState;
  const fresh = await MediaLibrary.getPermissionsAsync(true);
  permState = fresh.granted ? 'granted' : (fresh.canAskAgain ? 'unknown' : 'denied');
  return permState;
}

/** Force a re-probe (e.g. after the user comes back from Settings). */
export async function refreshMediaPermission(): Promise<PermState> {
  const fresh = await MediaLibrary.getPermissionsAsync(true);
  permState = fresh.granted ? 'granted' : 'denied';
  return permState;
}

/** Deep-link to the OS Settings app so the user can grant Photos access. */
export async function openPhotosSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Some platforms throw if Settings can't be opened; nothing useful to
    // do other than swallow.
  }
}

export type ArchiveOutcome = 'archived' | 'denied' | 'failed' | 'skipped';

/**
 * Save one photo's source file to the Photos library and update its
 * manifest entry accordingly. Safe to call on already-archived photos —
 * returns 'skipped' without re-saving.
 *
 * `sourceUri` is the full-resolution original from the camera. We pass it
 * in directly (rather than reading from the manifest) because the manifest
 * stores the 2400px upload version, not the original.
 */
export async function archivePhoto(
  sessionId: string,
  photoId: string,
  sourceUri: string,
): Promise<ArchiveOutcome> {
  const m = await loadManifest(sessionId);
  if (!m) return 'failed';
  const entry = m.photos.find((p) => p.id === photoId);
  if (!entry) return 'failed';
  if (entry.archive.status === 'done') return 'skipped';

  const granted = await ensureMediaPermission();
  if (!granted) {
    await updatePhoto(sessionId, photoId, {
      archive: { status: 'denied', error: 'Permission denied' },
    });
    return 'denied';
  }

  try {
    const asset = await MediaLibrary.createAssetAsync(sourceUri);
    await updatePhoto(sessionId, photoId, {
      archive: { status: 'done', phAssetId: asset.id },
    });

    // Best-effort album organisation. Album APIs require read perm we
    // don't have under writeOnly, so this often fails silently. The
    // photo is still in the camera roll either way.
    try {
      const album = await MediaLibrary.getAlbumAsync(ZENRUN_ALBUM_NAME);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(ZENRUN_ALBUM_NAME, asset, false);
      }
    } catch {
      // album write failed — non-fatal.
    }
    return 'archived';
  } catch (e) {
    await updatePhoto(sessionId, photoId, {
      archive: {
        status: 'failed',
        error: (e as Error)?.message ?? 'Unknown archive error',
      },
    });
    console.warn('Archive to Photos library failed:', e);
    return 'failed';
  }
}

/**
 * Walk every session's pending archives and retry. Called on app launch +
 * whenever the user toggles the permission. We can't retry the original-
 * resolution archive because we don't have the original any more (it lives
 * in iOS's ImagePicker cache which is volatile). What we *can* archive is
 * the 2400px upload version stored in the session — better than nothing.
 *
 * The caller is also responsible for checking the permission state before
 * draining; if denied, this is a no-op so we don't churn through every
 * pending entry uselessly.
 */
export async function drainPendingArchives(): Promise<{
  attempted: number;
  archived: number;
  denied: number;
  failed: number;
}> {
  const result = { attempted: 0, archived: 0, denied: 0, failed: 0 };
  const granted = await ensureMediaPermission();
  if (!granted) return result;

  for (const summary of await listSessions()) {
    if (summary.pendingArchiveCount === 0) continue;
    const m = await loadManifest(summary.sessionId);
    if (!m) continue;
    for (const entry of m.photos) {
      if (entry.archive.status !== 'pending') continue;
      result.attempted += 1;
      // We use the on-disk session photo as the source — the original
      // from camera is long gone by the time the drainer runs.
      const outcome = await archivePhoto(m.sessionId, entry.id, entry.uri);
      if (outcome === 'archived' || outcome === 'skipped') result.archived += 1;
      else if (outcome === 'denied') result.denied += 1;
      else result.failed += 1;
    }
  }
  return result;
}
