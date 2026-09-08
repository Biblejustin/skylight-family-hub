import { describe, expect, it } from 'vitest';
import { usablePhotoData, type PhotoData } from '../photo-data';

const NOW = Date.UTC(2026, 8, 8, 12);
const REFRESH = 600_000;
const url = (expiry: number) => `https://cvws.icloud-content.com/photo.jpg?e=${expiry / 1000}&token=example`;

describe('usablePhotoData', () => {
  it('rejects yesterday\'s expired Apple URLs even if metadata was just cached again', () => {
    expect(usablePhotoData([url(NOW - 1_000)], 'icloud', NOW, REFRESH, NOW)).toBeNull();
  });

  it('keeps still-valid signed URLs when the metadata cache is stale', () => {
    const data = [url(NOW + 3 * 3_600_000)];
    expect(usablePhotoData(data, 'icloud', NOW - 2 * REFRESH, REFRESH, NOW)).toBe(data);
  });

  it('treats the expiration instant as expired and checks every item', () => {
    const data = [url(NOW + 60_000), url(NOW)];
    expect(usablePhotoData(data, 'icloud', NOW, REFRESH, NOW)).toBeNull();
  });

  it('checks typed video URLs and their poster URLs', () => {
    const data: PhotoData = [{ url: url(NOW + 60_000), type: 'video', posterUrl: url(NOW - 1_000) }];
    expect(usablePhotoData(data, 'icloud', NOW, REFRESH, NOW)).toBeNull();
  });

  it.each(['', '?e=invalid', '?e=9999999999999999999999'])(
    'falls back to original metadata freshness for an unrecognized expiry: %s',
    (query) => {
      const data = [`https://cvws.icloud-content.com/photo.jpg${query}`];
      expect(usablePhotoData(data, 'icloud', NOW, REFRESH, NOW)).toBe(data);
      expect(usablePhotoData(data, 'icloud', NOW - REFRESH, REFRESH, NOW)).toBeNull();
    },
  );

  it('preserves real empty albums and other photo sources', () => {
    const empty: PhotoData = [];
    expect(usablePhotoData(empty, 'icloud', NOW - REFRESH, REFRESH, NOW)).toBe(empty);
    const expired = [url(NOW - 1_000)];
    expect(usablePhotoData(expired, 'local', NOW - REFRESH, REFRESH, NOW)).toBe(expired);
  });
});
