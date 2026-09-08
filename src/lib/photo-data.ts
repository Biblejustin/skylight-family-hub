import type { MediaListItem } from '@/types/config';

export type PhotoData = string[] | MediaListItem[];

/** Apple CDN URLs carry their expiry as Unix seconds in `e`. Other URL
 * shapes fall back to the feed's freshness window, never a guessed Apple
 * lifetime. Local/other-source feeds keep their usual stale-data behavior. */
function expiresAt(url: string, fallback: number): number {
  try {
    const value = new URL(url).searchParams.get('e');
    if (value !== null && /^\d+$/.test(value)) {
      const seconds = Number(value);
      if (Number.isSafeInteger(seconds * 1000)) return seconds * 1000;
    }
  } catch {
    // An unrecognized URL cannot establish a longer safe cache lifetime.
  }
  return fallback;
}

/**
 * A dormant Photos screen can restore yesterday's feed from displayCache.
 * Keeping that feed is useful for ordinary data, but expired signed URLs
 * are no longer usable images. Do not seed rotation with them: a same-size
 * fresh batch would otherwise wait for the entire dead pass to finish.
 * `null` means waiting for usable data; `[]` still means an empty album.
 */
export function usablePhotoData(
  data: PhotoData | null,
  source: string | undefined,
  fetchedAt: number | null,
  refreshMs: number,
  now = Date.now(),
): PhotoData | null {
  if (source !== 'icloud' || data === null || data.length === 0) return data;
  const fallback = fetchedAt === null ? 0 : fetchedAt + refreshMs;
  const expired = data.some((item) => {
    if (typeof item === 'string') return expiresAt(item, fallback) <= now;
    return expiresAt(item.url, fallback) <= now
      || (!!item.posterUrl && expiresAt(item.posterUrl, fallback) <= now);
  });
  return expired ? null : data;
}
