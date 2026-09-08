import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  requireSession: vi.fn(),
  requireDisplayAuth: vi.fn(),
  isAuthEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/icloud-album', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/icloud-album')>();
  return {
    ...actual,
    fetchSharedStreamsAlbum: vi.fn(),
  };
});

vi.mock('@/lib/icloud-link', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/icloud-link')>();
  return {
    ...actual,
    fetchCloudKitAlbum: vi.fn(),
  };
});

import { fetchSharedStreamsAlbum } from '@/lib/icloud-album';
import { fetchCloudKitAlbum } from '@/lib/icloud-link';
import type { ICloudAlbumItem } from '@/lib/icloud-types';
import { GET } from '@/app/api/icloud/photos/route';

const mockFetchAlbum = vi.mocked(fetchSharedStreamsAlbum);
const mockCloudKit = vi.mocked(fetchCloudKitAlbum);

const ALBUM_URL = encodeURIComponent('https://www.icloud.com/sharedalbum/#B125ON9t3mbLNC');
const NEW_ALBUM_URL = encodeURIComponent('https://photos.icloud.com/shared/album/03c4SA2q7HwyPw7YOwfXTn0mg');

function req(query = '') {
  return new NextRequest(`http://localhost/api/icloud/photos${query}`);
}

function albumItems(): ICloudAlbumItem[] {
  return [
    { url: 'https://cvws.icloud-content.com/S/p1', type: 'image', guid: 'p1' },
    { url: 'https://cvws.icloud-content.com/S/p2', type: 'image', guid: 'p2' },
    {
      url: 'https://cvws.icloud-content.com/S/v1',
      type: 'video',
      guid: 'v1',
      posterUrl: 'https://cvws.icloud-content.com/S/v1-poster',
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchAlbum.mockResolvedValue(albumItems());
});

afterEach(() => vi.restoreAllMocks());

function datedImage(guid: string, addedAt?: number): ICloudAlbumItem {
  return { url: `https://cvws.icloud-content.com/S/${guid}`, type: 'image', guid, addedAt };
}

describe('GET /api/icloud/photos', () => {
  it('reserves newest photo slots in descending order, fills remaining slots, and keeps metadata internal', async () => {
    mockFetchAlbum.mockResolvedValue([
      datedImage('old', 10), datedImage('middle', 20), datedImage('new', 30), datedImage('undated'),
    ]);
    const res = await GET(req(`?album=${ALBUM_URL}&media=photos&count=4&recent=2`));
    const items: Array<Record<string, unknown>> = await res.json();

    expect(items.map((item) => item.url).slice(0, 2)).toEqual([
      'https://cvws.icloud-content.com/S/new', 'https://cvws.icloud-content.com/S/middle',
    ]);
    expect(items.map((item) => item.url).slice(2).sort()).toEqual([
      'https://cvws.icloud-content.com/S/old', 'https://cvws.icloud-content.com/S/undated',
    ]);
    for (const item of items) expect(Object.keys(item).sort()).toEqual(['type', 'url']);
  });

  it('clamps newest slots to count and retains legacy string responses', async () => {
    mockFetchAlbum.mockResolvedValue([datedImage('old', 10), datedImage('new', 30), datedImage('middle', 20)]);
    const res = await GET(req(`?album=${ALBUM_URL}&count=2&recent=500`));
    expect(await res.json()).toEqual([
      'https://cvws.icloud-content.com/S/new', 'https://cvws.icloud-content.com/S/middle',
    ]);
  });

  it('deduplicates reserved and random entries by stable guid', async () => {
    mockFetchAlbum.mockResolvedValue([
      datedImage('new', 30), datedImage('old', 10), datedImage('new', 30), datedImage('old', 10), datedImage('other'),
    ]);
    const res = await GET(req(`?album=${ALBUM_URL}&count=10&recent=1`));
    const urls: string[] = await res.json();
    expect(urls).toHaveLength(3);
    expect(new Set(urls).size).toBe(3);
    expect(urls[0]).toBe('https://cvws.icloud-content.com/S/new');
  });

  it('uses only valid dated photos for recent slots and keeps undated photos and videos in the random remainder', async () => {
    const video = { ...albumItems()[2], addedAt: 100 };
    mockFetchAlbum.mockResolvedValue([
      video, datedImage('invalid', Number.NaN), datedImage('infinite', Infinity), datedImage('undated'), datedImage('dated', 20),
    ]);
    const res = await GET(req(`?album=${ALBUM_URL}&media=both&count=5&recent=5`));
    const items: Array<{ url: string; type: string }> = await res.json();
    expect(items).toHaveLength(5);
    expect(items[0].url).toBe('https://cvws.icloud-content.com/S/dated');
    expect(items.filter((item) => item.type === 'video')).toHaveLength(1);
  });

  it('fills the requested batch when no dates are available', async () => {
    const res = await GET(req(`?album=${ALBUM_URL}&count=2&recent=5`));
    const urls: string[] = await res.json();
    expect(urls.sort()).toEqual(['https://cvws.icloud-content.com/S/p1', 'https://cvws.icloud-content.com/S/p2']);
  });

  it.each(['', '&recent=0', '&recent=-5', '&recent=invalid', '&recent=Infinity'])(
    'keeps random selection with no usable recent parameter (%s)', async (suffix) => {
      mockFetchAlbum.mockResolvedValue([datedImage('new', 30), datedImage('old', 10)]);
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const res = await GET(req(`?album=${ALBUM_URL}&count=1${suffix}`));
      expect(await res.json()).toEqual(['https://cvws.icloud-content.com/S/old']);
    },
  );

  it('parses the token out of a pasted share link', async () => {
    await GET(req(`?album=${ALBUM_URL}`));
    expect(mockFetchAlbum).toHaveBeenCalledWith('B125ON9t3mbLNC');
    expect(mockCloudKit).not.toHaveBeenCalled();
  });

  it('routes a new-format album link through the CloudKit backend', async () => {
    mockCloudKit.mockResolvedValue(albumItems());

    const res = await GET(req(`?album=${NEW_ALBUM_URL}&media=both`));
    const json: Array<{ type: string }> = await res.json();

    expect(json).toHaveLength(3);
    expect(json.filter((i) => i.type === 'video')).toHaveLength(1);
    expect(mockCloudKit).toHaveBeenCalledWith('03c4SA2q7HwyPw7YOwfXTn0mg');
    expect(mockFetchAlbum).not.toHaveBeenCalled();
  });

  it('returns an empty list for a private or expired new-format album', async () => {
    mockCloudKit.mockResolvedValue(null);

    const res = await GET(req(`?album=${NEW_ALBUM_URL}&media=both`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('without media= returns the legacy string[] of image URLs only', async () => {
    const res = await GET(req(`?album=${ALBUM_URL}`));
    const json: string[] = await res.json();

    expect(res.status).toBe(200);
    expect(json.sort()).toEqual([
      'https://cvws.icloud-content.com/S/p1',
      'https://cvws.icloud-content.com/S/p2',
    ]);
  });

  it('media=photos returns typed image entries without guid', async () => {
    const res = await GET(req(`?album=${ALBUM_URL}&media=photos`));
    const json: Array<Record<string, unknown>> = await res.json();

    expect(json).toHaveLength(2);
    for (const item of json) {
      expect(item.type).toBe('image');
      expect(item).not.toHaveProperty('guid');
    }
  });

  it('media=videos returns video entries with posterUrl', async () => {
    const res = await GET(req(`?album=${ALBUM_URL}&media=videos`));
    const json: Array<Record<string, unknown>> = await res.json();

    expect(json).toEqual([{
      url: 'https://cvws.icloud-content.com/S/v1',
      type: 'video',
      posterUrl: 'https://cvws.icloud-content.com/S/v1-poster',
    }]);
  });

  it('media=both returns the full mix', async () => {
    const res = await GET(req(`?album=${ALBUM_URL}&media=both`));
    const json: Array<{ type: string }> = await res.json();

    expect(json).toHaveLength(3);
    expect(json.filter((i) => i.type === 'image')).toHaveLength(2);
    expect(json.filter((i) => i.type === 'video')).toHaveLength(1);
  });

  it('trims results to count', async () => {
    const res = await GET(req(`?album=${ALBUM_URL}&media=both&count=2`));
    const json: unknown[] = await res.json();
    expect(json).toHaveLength(2);
  });

  it('rejects an unknown media value', async () => {
    const res = await GET(req(`?album=${ALBUM_URL}&media=audio`));
    expect(res.status).toBe(400);
  });

  it('returns an empty list when the album param is missing', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockFetchAlbum).not.toHaveBeenCalled();
  });

  it('returns an empty list for an unparseable album link', async () => {
    const res = await GET(req('?album=not%20a%20link&media=both'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockFetchAlbum).not.toHaveBeenCalled();
  });

  it('surfaces upstream failures as a 500 with a friendly message', async () => {
    mockFetchAlbum.mockRejectedValue(new Error('iCloud webstream failed with status 503'));

    const res = await GET(req(`?album=${ALBUM_URL}&media=both`));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to fetch iCloud album');
  });
});
