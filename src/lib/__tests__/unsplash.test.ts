import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/secrets', () => ({
  getSecret: vi.fn(),
}));

import { getSecret } from '@/lib/secrets';
import { getUnsplashAccessKey, trackDownload, UNSPLASH_API } from '@/lib/unsplash';

const mockedGetSecret = vi.mocked(getSecret);

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── UNSPLASH_API constant ────────────────────────────────────────────

describe('UNSPLASH_API', () => {
  it('equals the Unsplash API base URL', () => {
    expect(UNSPLASH_API).toBe('https://api.unsplash.com');
  });
});

// ── getUnsplashAccessKey ─────────────────────────────────────────────

describe('getUnsplashAccessKey', () => {
  it('returns access key from secrets when set', async () => {
    mockedGetSecret.mockResolvedValue('my-unsplash-key-123');

    const key = await getUnsplashAccessKey();

    expect(key).toBe('my-unsplash-key-123');
    expect(mockedGetSecret).toHaveBeenCalledWith('unsplash_access_key');
  });

  it('returns null when no key configured', async () => {
    mockedGetSecret.mockResolvedValue(null);

    const key = await getUnsplashAccessKey();

    expect(key).toBeNull();
    expect(mockedGetSecret).toHaveBeenCalledWith('unsplash_access_key');
  });
});

// ── trackDownload ────────────────────────────────────────────────────

describe('trackDownload', () => {
  it('calls fetch with download URL and authorization header', () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = mockFetch;

    trackDownload('https://api.unsplash.com/photos/abc/download', 'my-key');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.unsplash.com/photos/abc/download',
      expect.objectContaining({
        headers: { Authorization: 'Client-ID my-key' },
      }),
    );
  });

  it('silently ignores fetch errors (fire and forget)', () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    globalThis.fetch = mockFetch;

    // Should not throw — the .catch(() => {}) in the source handles it
    expect(() => {
      trackDownload('https://api.unsplash.com/photos/abc/download', 'my-key');
    }).not.toThrow();
  });
});
