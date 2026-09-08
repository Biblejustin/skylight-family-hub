import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withDisplayAuth } from '@/lib/api-utils';
import { fetchICloudMedia } from '@/lib/icloud-media';
import { shuffleArray } from '@/lib/shuffle';
import type { MediaListItem } from '@/types/config';
import type { ICloudAlbumItem } from '@/lib/icloud-types';

export const dynamic = 'force-dynamic';

function selectItems(wanted: ICloudAlbumItem[], count: number, recent: number): ICloudAlbumItem[] {
  // Keep callers without recent= on their existing all-random contract.
  if (recent === 0) return shuffleArray(wanted).slice(0, count);

  const seen = new Set<string>();
  const unique = wanted.filter((item) => {
    if (seen.has(item.guid)) return false;
    seen.add(item.guid);
    return true;
  });
  const newest = unique.filter((item) => item.type === 'image'
      && typeof item.addedAt === 'number' && Number.isFinite(item.addedAt))
    .sort((a, b) => b.addedAt! - a.addedAt!)
    .slice(0, recent);
  const reserved = new Set(newest.map((item) => item.guid));
  const remaining = shuffleArray(unique.filter((item) => !reserved.has(item.guid)))
    .slice(0, count - newest.length);
  // New additions lead the pass; shuffling this combined list would delay them.
  return [...newest, ...remaining];
}

/**
 * GET /api/icloud/photos?album=<share-url-or-token>&media=photos|videos|both&count=N&recent=N
 * Optional recent= reserves the first N slots for newest dated photos, with
 * random remaining items. Missing timestamps simply leave more random slots.
 *
 * Same typed contract as /api/immich/photos. Asset URLs are Apple-signed and
 * public — the browser loads media straight from Apple's CDN, so no `mt`
 * tokens and no streaming proxy; the hub resolves album metadata and batched
 * asset URLs per refresh.
 *
 * A missing or malformed album link resolves to an empty list rather than an
 * error: the slideshow's iCloud empty state tells the user to check the link,
 * which is friendlier than a red error card for what's almost always a
 * paste-or-settings problem.
 */
export const GET = withDisplayAuth(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const media = params.get('media');
  if (media && !['photos', 'videos', 'both'].includes(media)) {
    return NextResponse.json({ error: 'Invalid media parameter' }, { status: 400 });
  }
  const count = Math.min(Math.max(Number(params.get('count')) || 50, 1), 200);
  const requestedRecent = Number(params.get('recent'));
  const recent = Number.isFinite(requestedRecent)
    ? Math.min(Math.max(Math.floor(requestedRecent), 0), Math.floor(count)) : 0;

  // fetchICloudMedia dispatches by link shape (new CloudKit album vs. legacy
  // sharedstreams) and caches per token (5 min); shuffling per request keeps
  // the rotation varied between refreshes without re-hitting Apple.
  const all = await fetchICloudMedia(params.get('album') || '');

  // No media param → legacy string[] of image URLs, matching the other list
  // endpoints so photo-only configs never see the typed shape.
  if (!media) {
    const urls = selectItems(all.filter((item) => item.type === 'image'), count, recent)
      .map((item) => item.url);
    return NextResponse.json(urls);
  }

  const wanted = media === 'both' ? all : all.filter((item) =>
    media === 'videos' ? item.type === 'video' : item.type === 'image');
  // Map explicitly so internal fields (guid, addedAt) stay out of the wire shape.
  const items: MediaListItem[] = selectItems(wanted, count, recent).map((item) => ({
    url: item.url,
    type: item.type,
    ...(item.posterUrl ? { posterUrl: item.posterUrl } : {}),
  }));
  return NextResponse.json(items);
}, 'Failed to fetch iCloud album');
