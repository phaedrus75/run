/**
 * photoRecovery
 * =============
 *
 * Last-resort recovery for in-run photos that never made it to the user's
 * Photos library. The Build 29 backup feature in `useActivityPhotoCapture`
 * tried to call `MediaLibrary.createAssetAsync` but silently no-op'd whenever
 * the user declined the over-broad full-library permission we asked for. The
 * underlying images, however, are still on disk inside the app sandbox —
 * `expo-image-picker` writes captures to `<sandbox>/Library/Caches/ImagePicker/`
 * before our manipulator step. iOS sweeps that cache opportunistically (when
 * disk is low, when the app is reaped, etc.) but never on a fixed schedule, so
 * recovery is plausible if the user runs this within a few days.
 *
 * Strategy:
 *   1. Walk a small set of known cache locations (legacy paths + the
 *      `ImagePicker/` subdir).
 *   2. Filter to image-extension files newer than a configurable cutoff.
 *   3. Surface them with their on-disk timestamps so the user can see "this is
 *      from Saturday's run" before saving.
 *   4. Save selected files to Photos via writeOnly MediaLibrary access (the
 *      friendly add-only prompt — no full-library access required).
 *
 * Best-effort. Never throws; returns whatever it could collect.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

const ZENRUN_ALBUM_NAME = 'ZenRun';

/** Image-extension allowlist. Anything that looks like a photo. */
const IMAGE_EXT_RE = /\.(jpe?g|heic|heif|png)$/i;

/**
 * Locations expo-image-picker / image-manipulator are known to write to. Order
 * matters only for the (rare) case where the same filename appears in two
 * places — first hit wins.
 */
function candidateDirs(): string[] {
  const dirs: string[] = [];
  if (FileSystem.cacheDirectory) {
    dirs.push(`${FileSystem.cacheDirectory}ImagePicker/`);
    dirs.push(`${FileSystem.cacheDirectory}ImageManipulator/`);
    dirs.push(FileSystem.cacheDirectory);
  }
  if (FileSystem.documentDirectory) {
    dirs.push(`${FileSystem.documentDirectory}ImagePicker/`);
    dirs.push(FileSystem.documentDirectory);
  }
  return dirs;
}

export interface RecoverablePhoto {
  uri: string;
  filename: string;
  /** Bytes. */
  size: number;
  /** UNIX seconds. May be 0 on platforms that don't expose mtime. */
  modificationTime: number;
}

export interface ScanResult {
  photos: RecoverablePhoto[];
  scannedDirs: string[];
  errors: string[];
}

/**
 * Scan the app's cache + document directories for orphaned image files.
 * Returns photos sorted newest-first.
 *
 * @param sinceUnixSeconds  Only return files modified at/after this timestamp.
 *                          Defaults to 0 (all). Pass `Date.now()/1000 - 7*86400`
 *                          to limit to the last week.
 */
export async function scanOrphanedPhotos(
  sinceUnixSeconds = 0,
): Promise<ScanResult> {
  const photos: RecoverablePhoto[] = [];
  const scannedDirs: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const rawDir of candidateDirs()) {
    const dir = rawDir.endsWith('/') ? rawDir : `${rawDir}/`;
    try {
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists || !dirInfo.isDirectory) continue;

      const entries = await FileSystem.readDirectoryAsync(dir);
      scannedDirs.push(dir);
      for (const name of entries) {
        if (!IMAGE_EXT_RE.test(name)) continue;
        const uri = `${dir}${name}`;
        if (seen.has(uri)) continue;
        seen.add(uri);
        try {
          const info = await FileSystem.getInfoAsync(uri, { md5: false });
          if (!info.exists || info.isDirectory) continue;
          const mtime =
            typeof info.modificationTime === 'number'
              ? Math.round(info.modificationTime)
              : 0;
          if (sinceUnixSeconds > 0 && mtime > 0 && mtime < sinceUnixSeconds) {
            continue;
          }
          photos.push({
            uri,
            filename: name,
            size: typeof info.size === 'number' ? info.size : 0,
            modificationTime: mtime,
          });
        } catch (e) {
          errors.push(`stat ${uri}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      errors.push(`readdir ${dir}: ${(e as Error).message}`);
    }
  }

  photos.sort((a, b) => b.modificationTime - a.modificationTime);
  return { photos, scannedDirs, errors };
}

/**
 * Request "Add to Photos" (write-only) permission. This is the friendly
 * single-button prompt — the user never has to grant full library access.
 *
 * Caches the granted state in module scope so we only ask once per session.
 */
let writeOnlyPermissionState: 'unknown' | 'granted' | 'denied' = 'unknown';

export async function ensureWritePhotosPermission(): Promise<boolean> {
  if (writeOnlyPermissionState === 'granted') return true;
  if (writeOnlyPermissionState === 'denied') {
    const current = await MediaLibrary.getPermissionsAsync(true);
    if (current.granted) {
      writeOnlyPermissionState = 'granted';
      return true;
    }
  }
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  writeOnlyPermissionState = perm.granted ? 'granted' : 'denied';
  return perm.granted;
}

export interface SaveResult {
  saved: number;
  failed: number;
  errors: string[];
}

/**
 * Copy a list of cached files to the user's Photos library, into the ZenRun
 * album when possible. Each photo is wrapped in its own try/catch so a single
 * unreadable file doesn't abort the whole batch.
 */
export async function saveRecoveredPhotos(
  photos: RecoverablePhoto[],
): Promise<SaveResult> {
  const granted = await ensureWritePhotosPermission();
  if (!granted) {
    return {
      saved: 0,
      failed: photos.length,
      errors: ['Permission to add photos was not granted.'],
    };
  }

  let saved = 0;
  let failed = 0;
  const errors: string[] = [];
  const savedAssets: MediaLibrary.Asset[] = [];

  for (const photo of photos) {
    try {
      const asset = await MediaLibrary.createAssetAsync(photo.uri);
      savedAssets.push(asset);
      saved += 1;
    } catch (e) {
      failed += 1;
      errors.push(`${photo.filename}: ${(e as Error).message}`);
    }
  }

  // Best-effort: file the rescued assets into a ZenRun album for easy
  // discovery. Album APIs require full read access, so this may fail under
  // writeOnly permission — that's fine, the assets are still in the camera
  // roll, which is the bit that matters.
  if (savedAssets.length > 0) {
    try {
      const album = await MediaLibrary.getAlbumAsync(ZENRUN_ALBUM_NAME);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync(savedAssets, album, false);
      } else {
        await MediaLibrary.createAlbumAsync(
          ZENRUN_ALBUM_NAME,
          savedAssets[0],
          false,
        );
        if (savedAssets.length > 1) {
          const created = await MediaLibrary.getAlbumAsync(ZENRUN_ALBUM_NAME);
          if (created) {
            await MediaLibrary.addAssetsToAlbumAsync(
              savedAssets.slice(1),
              created,
              false,
            );
          }
        }
      }
    } catch {
      /* album organisation is a nice-to-have, swallow */
    }
  }

  return { saved, failed, errors };
}

/** Sum a `RecoverablePhoto[]` size field for display. */
export function formatTotalSize(photos: RecoverablePhoto[]): string {
  const total = photos.reduce((sum, p) => sum + (p.size || 0), 0);
  if (total < 1024) return `${total} B`;
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(0)} KB`;
  return `${(total / 1024 / 1024).toFixed(1)} MB`;
}
