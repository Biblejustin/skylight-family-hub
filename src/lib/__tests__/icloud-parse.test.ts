import { describe, it, expect } from 'vitest';
import {
  parseICloudSharedAlbumUrl,
  parseICloudAlbumToken,
  detectICloudSource,
} from '@/lib/icloud-parse';

const NEW_ALBUM = 'https://photos.icloud.com/shared/album/03c4SA2q7HwyPw7YOwfXTn0mg';
const LEGACY_ALBUM = 'https://www.icloud.com/sharedalbum/#B125ON9t3mbLNC';
// Synthetic only: mirrors the extended URL-safe shape, never a real album.
const EXTENDED_TOKEN = `D1t${'AbCd1234_-'.repeat(20)}`;
const EXTENDED_ALBUM = `https://www.icloud.com/sharedalbum/#${EXTENDED_TOKEN}`;

describe('parseICloudSharedAlbumUrl', () => {
  it('extracts the token from a new-format shared album URL', () => {
    expect(parseICloudSharedAlbumUrl(NEW_ALBUM)).toBe('03c4SA2q7HwyPw7YOwfXTn0mg');
  });

  it('tolerates a trailing slash and no scheme', () => {
    expect(parseICloudSharedAlbumUrl('photos.icloud.com/shared/album/03c4SA2q7HwyPw7YOwfXTn0mg/'))
      .toBe('03c4SA2q7HwyPw7YOwfXTn0mg');
  });

  it('rejects the legacy album URL, iCloud Links, and bare tokens', () => {
    expect(parseICloudSharedAlbumUrl(LEGACY_ALBUM)).toBeNull();
    expect(parseICloudSharedAlbumUrl('https://share.icloud.com/photos/0f0a3hdUxHZ0-C8uQ7Dq1JxLw')).toBeNull();
    expect(parseICloudSharedAlbumUrl('03c4SA2q7HwyPw7YOwfXTn0mg')).toBeNull();
  });

  it('rejects a /shared/album/ path on a non-icloud host', () => {
    expect(parseICloudSharedAlbumUrl('https://evil.example.com/shared/album/03c4SA2q7HwyPw7YOwfXTn0mg')).toBeNull();
  });
});

describe('detectICloudSource with the new album format', () => {
  it('classifies the new-format album as a live "album" source', () => {
    expect(detectICloudSource(NEW_ALBUM)).toBe('album');
  });

  it('still classifies the legacy album and iCloud Link', () => {
    expect(detectICloudSource(LEGACY_ALBUM)).toBe('album');
    expect(detectICloudSource('https://share.icloud.com/photos/0f0a3hdUxHZ0-C8uQ7Dq1JxLw')).toBe('link');
  });
});

describe('parseICloudAlbumToken is unchanged for legacy links', () => {
  it('does not extract a token from the new-format URL (routes via URL shape instead)', () => {
    expect(parseICloudAlbumToken(NEW_ALBUM)).toBeNull();
    expect(parseICloudAlbumToken(LEGACY_ALBUM)).toBe('B125ON9t3mbLNC');
  });
});

describe('extended D shared-album tokens', () => {
  it('keeps a long URL-safe token intact and classifies its URL as a live album', () => {
    expect(parseICloudAlbumToken(EXTENDED_ALBUM)).toBe(EXTENDED_TOKEN);
    expect(detectICloudSource(EXTENDED_ALBUM)).toBe('album');
    expect(parseICloudSharedAlbumUrl(EXTENDED_ALBUM)).toBeNull();
  });

  it('accepts a localized album URL, surrounding whitespace, and photo suffix', () => {
    expect(parseICloudAlbumToken(`  https://www.icloud.com/sharedalbum/en-us/#${EXTENDED_TOKEN};PHOTO-GUID  `))
      .toBe(EXTENDED_TOKEN);
    expect(parseICloudAlbumToken(`www.icloud.com/sharedalbum/#${EXTENDED_TOKEN}`))
      .toBe(EXTENDED_TOKEN);
  });

  it('accepts the bounded minimum and maximum extended token lengths', () => {
    for (const token of ['D1t_--', `D1t_${'x'.repeat(4092)}`]) {
      expect(parseICloudAlbumToken(`https://www.icloud.com/sharedalbum/#${token}`)).toBe(token);
    }
    expect(parseICloudAlbumToken('https://www.icloud.com/sharedalbum/#D1t_-')).toBeNull();
  });

  it('keeps bare URL-safe GUIDs and explicit iCloud Links out of the album path', () => {
    const shortGuid = 'D1tAbCd1234_link';
    expect(parseICloudAlbumToken(shortGuid)).toBeNull();
    expect(detectICloudSource(shortGuid)).toBe('link');
    expect(parseICloudAlbumToken(EXTENDED_TOKEN)).toBeNull();
    expect(detectICloudSource(EXTENDED_TOKEN)).toBeNull();
    expect(parseICloudAlbumToken(`https://share.icloud.com/photos/#${shortGuid}`)).toBeNull();
    expect(detectICloudSource(`https://share.icloud.com/photos/${shortGuid}`)).toBe('link');
  });

  it.each([
    `https://evil.example/sharedalbum/#${EXTENDED_TOKEN}`,
    `https://icloud.com.evil.example/sharedalbum/#${EXTENDED_TOKEN}`,
    `https://icloud.com@evil.example/sharedalbum/#${EXTENDED_TOKEN}`,
    `https://www.icloud.com/photos/#${EXTENDED_TOKEN}`,
    `https://www.icloud.com/nested/sharedalbum/#${EXTENDED_TOKEN}`,
    `https://photos.icloud.com/shared/album/${EXTENDED_TOKEN}`,
  ])('rejects an extended token outside an explicit Apple sharedalbum URL: %s', (url) => {
    expect(parseICloudAlbumToken(url)).toBeNull();
  });

  it.each([
    'D_tAbCd1234_-', // partition must remain base62
    'D1_AbCd1234_-',
    'C1tAbCd1234_-', // only D has this extended shape
    'D1tAbCd/1234_-',
    'D1tAbCd+1234_-',
    'D1tAbCd%201234_-',
    `D1t${'x'.repeat(4094)}`, // bounded to 4096 total characters
  ])('rejects malformed or oversized extended tokens: %s', (token) => {
    expect(parseICloudAlbumToken(`https://www.icloud.com/sharedalbum/#${token}`)).toBeNull();
  });

  it('preserves legacy bare tokens, suffix handling, and length restrictions', () => {
    for (const token of ['A1abcDEF', 'B125ON9t3mbLNC', 'C1tabcDEF', 'D1tabcDEF']) {
      expect(parseICloudAlbumToken(token)).toBe(token);
      expect(parseICloudAlbumToken(`https://www.icloud.com/sharedalbum/#${token};PHOTO`)).toBe(token);
      expect(detectICloudSource(token)).toBe('album');
    }
    expect(parseICloudAlbumToken('')).toBeNull();
    expect(parseICloudAlbumToken('abcde')).toBeNull();
    expect(parseICloudAlbumToken(`B1t${'x'.repeat(126)}`)).toBeNull();
  });
});
