import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-utils', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api-utils')>(),
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from '@/lib/api-utils';
import { clearICloudCaches, fetchSharedStreamsAlbum } from '@/lib/icloud-album';

beforeEach(() => {
  vi.clearAllMocks();
  clearICloudCaches();
});

describe('large shared albums', () => {
  it('resolves every batch with bounded concurrency and preserves album order', async () => {
    const guids = Array.from({ length: 127 }, (_, i) => `photo-${i}`);
    let active = 0;
    let peak = 0;
    const requested: string[] = [];
    vi.mocked(fetchWithTimeout).mockImplementation(async (url, init) => {
      if (String(url).endsWith('/webstream')) {
        // This album needs ~31 seconds in the real Apple service.
        expect(init?.timeout).toBeGreaterThan(31_000);
        return new Response(JSON.stringify({ photos: guids.map((guid) => ({
          photoGuid: guid,
          derivatives: { '2049': { checksum: guid } },
        })) }));
      }
      const batch = JSON.parse(String(init?.body)).photoGuids as string[];
      expect(batch.length).toBeLessThanOrEqual(25);
      requested.push(...batch);
      active++;
      peak = Math.max(peak, active);
      // Finish batches out of order, as the network can do.
      await new Promise((resolve) => setTimeout(resolve, batch[0] === 'photo-0' ? 10 : 1));
      active--;
      return new Response(JSON.stringify({ items: Object.fromEntries(batch.map((guid) => [guid, {
        url_location: 'photos.icloud-content.com', url_path: `/${guid}`,
      }])) }));
    });

    const result = await fetchSharedStreamsAlbum('D1tExample_Album-Token');
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
    expect(requested).toEqual(guids);
    expect(result.map((photo) => photo.guid)).toEqual(guids);
    expect(result.every((photo) => photo.type === 'image')).toBe(true);
  });
});
