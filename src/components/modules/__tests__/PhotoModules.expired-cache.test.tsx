// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/i18n/provider';
import enUSModules from '@/translations/en-US/modules.json';
import enUSCore from '@/translations/en-US/core.json';
import { DEFAULT_MODULE_STYLE } from '@/types/config';
import { displayCache } from '@/lib/display-cache';
import { displayFetch } from '@/lib/display-fetch';
import { photoSlideshowUrl } from '@/lib/fetch-keys';
import PhotoSlideshowModule from '../PhotoSlideshowModule';
import FullscreenPhotoModule from '../fullscreen-photo/FullscreenPhotoModule';

vi.mock('@/lib/display-fetch', () => ({ displayFetch: vi.fn() }));

const NOW = Date.UTC(2026, 8, 8, 12);
const REFRESH = 600_000;
const config = {
  source: 'icloud' as const, icloudAlbumUrl: 'https://www.icloud.com/sharedalbum/#test',
  directory: '', intervalMs: 10_000, transition: 'fade' as const, objectFit: 'contain' as const,
  refreshIntervalMs: REFRESH, shuffle: false, showClock: false, kenBurns: false,
};
const listUrl = photoSlideshowUrl(config);
const batch = (name: string, expiry: number) => Array.from({ length: 50 }, (_, i) =>
  `https://cvws.icloud-content.com/${name}-${i}.jpg?e=${expiry / 1000}`);

function Wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider locale="en-US" blob={{ modules: enUSModules, core: enUSCore }}>{children}</I18nProvider>;
}

function activeImage(container: HTMLElement) {
  for (const img of container.querySelectorAll('img')) fireEvent.load(img);
  return [...container.querySelectorAll('img')].find((img) => img.style.zIndex === '1');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  displayCache.clear();
  vi.mocked(displayFetch).mockReset();
});

afterEach(() => {
  cleanup();
  displayCache.clear();
  vi.useRealTimers();
});

for (const Component of [PhotoSlideshowModule, FullscreenPhotoModule]) {
  describe(`${Component.name} returning to Photos`, () => {
    it('waits through a slow refresh, then adopts fresh photos immediately instead of a dead 50-slide pass', async () => {
      vi.setSystemTime(NOW - 11 * 3_600_000);
      displayCache.set(listUrl, batch('expired', NOW - 8 * 3_600_000), REFRESH);
      vi.setSystemTime(NOW);
      let finish!: (response: Response) => void;
      vi.mocked(displayFetch).mockReturnValue(new Promise((resolve) => { finish = resolve; }));

      const { container, getByText, queryByText } = render(
        <Component config={config} style={DEFAULT_MODULE_STYLE} screenId="s1" moduleId="m1" />,
        { wrapper: Wrapper },
      );
      expect(displayFetch).toHaveBeenCalledTimes(1);
      expect(container.querySelector('img')).toBeNull();
      expect(getByText(enUSModules['photo-slideshow'].loading)).toBeTruthy();
      expect(queryByText(enUSModules['fullscreen-photo'].noPhotosYet)).toBeNull();

      // Matches the measured NAS metadata refresh. No expired image is sent
      // to the browser, even while multiple normal slide intervals pass.
      await act(async () => { vi.advanceTimersByTime(43_500); });
      expect(container.querySelector('img')).toBeNull();
      await act(async () => { finish(Response.json(batch('fresh', NOW + 3 * 3_600_000))); });
      expect(activeImage(container)?.src).toContain('/fresh-0.jpg');
      expect(container.innerHTML).not.toContain('/expired-');
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(activeImage(container)?.src).toContain('/fresh-1.jpg');
    });

    it('shows still-valid cached photos while refreshing stale metadata', async () => {
      vi.setSystemTime(NOW - 2 * REFRESH);
      displayCache.set(listUrl, batch('valid', NOW + 3 * 3_600_000), REFRESH);
      vi.setSystemTime(NOW);
      vi.mocked(displayFetch).mockReturnValue(new Promise(() => {}));
      const { container } = render(
        <Component config={config} style={DEFAULT_MODULE_STYLE} screenId="s1" moduleId="m1" />,
        { wrapper: Wrapper },
      );
      expect(displayFetch).toHaveBeenCalledTimes(1);
      expect(activeImage(container)?.src).toContain('/valid-0.jpg');
    });

    it('shows a retry state on refresh failure and recovers on the next poll', async () => {
      vi.setSystemTime(NOW - 11 * 3_600_000);
      displayCache.set(listUrl, batch('expired', NOW - 8 * 3_600_000), REFRESH);
      vi.setSystemTime(NOW);
      vi.mocked(displayFetch).mockResolvedValueOnce(Response.json({ error: 'offline' }, { status: 503 }));
      const { container, getByText } = render(
        <Component config={config} style={DEFAULT_MODULE_STYLE} screenId="s1" moduleId="m1" />,
        { wrapper: Wrapper },
      );
      await act(async () => {});
      expect(getByText(enUSModules.common.notUpdating)).toBeTruthy();
      expect(container.querySelector('img')).toBeNull();

      vi.mocked(displayFetch).mockResolvedValueOnce(Response.json(batch('recovered', NOW + 3 * 3_600_000)));
      await act(async () => { vi.advanceTimersByTime(REFRESH); });
      expect(activeImage(container)?.src).toContain('/recovered-0.jpg');
    });
  });
}
