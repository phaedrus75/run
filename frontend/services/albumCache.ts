/**
 * 📸 ALBUM CACHE
 * ===============
 *
 * Tiny module-level (in-memory) cache for the Album feed. The Album tab
 * was previously throwing away its loaded photos on every unmount /
 * tab-switch, so re-opening the tab always "started from scratch" —
 * page 1 fetch, slow base64 decode, more pages on scroll. This made the
 * tab feel uncached and broken even though the backend was fine.
 *
 * The cache lives for the lifetime of the JS bundle, which is good enough
 * for our needs:
 *   • On AlbumScreen mount we read from the cache immediately and render
 *     instantly with whatever we have.
 *   • A background revalidate runs only when the cache is stale (default
 *     60 s) — we never block the UI.
 *   • Pagination appends into the cache so scroll position picks up where
 *     the user left off.
 *   • Pull-to-refresh and the EditRunModal photo-share toggle invalidate
 *     the cache so the next view sees fresh data.
 */

import { AlbumPhoto } from './api';

interface CachedAlbum {
  items: AlbumPhoto[];
  cursor: string | null;
  hasMore: boolean;
  fetchedAt: number;
}

let cache: CachedAlbum | null = null;

const DEFAULT_TTL_MS = 60_000;

export const albumCache = {
  /** Read the current cache snapshot, or null if nothing cached yet. */
  read(): CachedAlbum | null {
    return cache;
  },

  /** Replace the cache with a fresh first page. */
  writeFirstPage(items: AlbumPhoto[], cursor: string | null) {
    cache = {
      items,
      cursor,
      hasMore: cursor !== null,
      fetchedAt: Date.now(),
    };
  },

  /** Append a paginated page to the cached list. */
  appendPage(items: AlbumPhoto[], cursor: string | null) {
    if (!cache) {
      cache = {
        items,
        cursor,
        hasMore: cursor !== null,
        fetchedAt: Date.now(),
      };
      return;
    }
    cache = {
      items: [...cache.items, ...items],
      cursor,
      hasMore: cursor !== null,
      fetchedAt: cache.fetchedAt,
    };
  },

  /** Whether the cache is older than `ttlMs` (default 60 s). */
  isStale(ttlMs: number = DEFAULT_TTL_MS): boolean {
    return !cache || Date.now() - cache.fetchedAt > ttlMs;
  },

  /** Drop the cache (e.g. after the user shares a run, deletes a photo). */
  invalidate() {
    cache = null;
  },
};
