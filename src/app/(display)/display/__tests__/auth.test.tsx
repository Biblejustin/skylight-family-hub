import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import * as auth from '@/lib/auth';
import type { AuthState } from '@/lib/auth';
import type { ScreenConfiguration } from '@/types/config';
import type { DisplaySearchParams } from '@/lib/display-search-params';
import MainDisplayPage from '../page';
import NamedDisplayPage from '../[displayId]/page';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  readConfig: vi.fn(),
  rotator: vi.fn(() => null),
  notFound: vi.fn(() => null),
  redirect: vi.fn((location: string): never => {
    throw new Error(`TEST_REDIRECT:${location}`);
  }),
}));

vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/config', () => ({ readConfig: mocks.readConfig }));
vi.mock('@/components/display/ScreenRotator', () => ({ default: mocks.rotator }));
vi.mock('@/components/display/DisplayNotFound', () => ({ default: mocks.notFound }));

const DISPLAY_TOKEN = 'd'.repeat(64);
const COOKIE_SECRET = 'c'.repeat(64);
const SESSION_EPOCH = 42;

function enabledState(): AuthState {
  return {
    passwordHash: 'a'.repeat(128),
    salt: 'b'.repeat(64),
    cookieSecret: COOKIE_SECRET,
    displayToken: DISPLAY_TOKEN,
    sessionEpoch: SESSION_EPOCH,
  };
}

function fixtureConfig(): ScreenConfiguration {
  const screens = [{ id: 'calendar', name: 'Calendar', backgroundImage: '', modules: [] }];
  return {
    version: 10,
    settings: {
      rotationIntervalMs: 30000,
      displayWidth: 1920,
      displayHeight: 1080,
      latitude: 0,
      longitude: 0,
      weather: { provider: 'open-meteo', latitude: 0, longitude: 0, units: 'imperial' },
      calendar: { googleCalendarId: '', googleCalendarIds: [], icalSources: [], daysAhead: 7 },
    },
    screens,
    displays: [{ id: 'wall', name: 'Wall display', screens }],
  };
}

// The suite already sandboxes cwd globally. Add per-case isolation for auth
// state so even a regression that writes during authorization stays temporary.
const suiteCwd = process.cwd();
let tmpDir: string;
let requestHeaders: Headers;

async function writeState(state: AuthState): Promise<string> {
  const bytes = JSON.stringify(state, null, 2) + '\n';
  await fs.writeFile(path.join(tmpDir, 'data/auth.json'), bytes, { mode: 0o600 });
  auth.clearAuthCache();
  return bytes;
}

beforeEach(async () => {
  vi.clearAllMocks();
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hs-display-page-auth-'));
  await fs.mkdir(path.join(tmpDir, 'data'), { mode: 0o700 });
  process.chdir(tmpDir);
  requestHeaders = new Headers({ host: 'display.test' });
  mocks.headers.mockImplementation(async () => requestHeaders);
  mocks.readConfig.mockImplementation(async () => fixtureConfig());
  vi.spyOn(auth, 'getDisplayToken'); // Calls through to real token handling.
  await writeState(enabledState());
});

afterEach(async () => {
  auth.clearAuthCache();
  process.chdir(suiteCwd);
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const routes = [
  {
    name: '/display',
    invoke: (search: DisplaySearchParams = {}) => MainDisplayPage({ searchParams: Promise.resolve(search) }),
  },
  {
    name: '/display/wall',
    invoke: (search: DisplaySearchParams = {}) => NamedDisplayPage({
      params: Promise.resolve({ displayId: 'wall' }),
      searchParams: Promise.resolve(search),
    }),
  },
];

describe.each(routes)('$name server authorization', ({ invoke }) => {
  async function expectBlocked(search: DisplaySearchParams = {}) {
    const before = await fs.readFile(path.join(tmpDir, 'data/auth.json'), 'utf8');
    await expect(invoke(search)).rejects.toThrow('TEST_REDIRECT:');
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.redirect.mock.calls[0][0]).toMatch(/^\/login(?:\?|$)/);
    expect(mocks.redirect.mock.calls[0][0]).not.toContain(DISPLAY_TOKEN);
    expect(mocks.readConfig).not.toHaveBeenCalled();
    expect(auth.getDisplayToken).not.toHaveBeenCalled();
    expect(mocks.rotator).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(tmpDir, 'data/auth.json'), 'utf8')).toBe(before);
    expect(await fs.readdir(path.join(tmpDir, 'data'))).toEqual(['auth.json']);
  }

  async function expectAllowed(expectedToken: string | null, search: DisplaySearchParams = {}) {
    const page = await invoke(search);
    renderToStaticMarkup(page);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.readConfig).toHaveBeenCalledOnce();
    expect(auth.getDisplayToken).toHaveBeenCalledOnce();
    expect(mocks.rotator).toHaveBeenCalledOnce();
    expect(mocks.rotator).toHaveBeenCalledWith(
      expect.objectContaining({ displayId: 'wall', displayToken: expectedToken }),
      undefined,
    );
    expect(mocks.notFound).not.toHaveBeenCalled();
  }

  it('blocks anonymous requests before reading configuration or exposing a token', async () => {
    await expectBlocked();
  });

  it('blocks an incorrect query token', async () => {
    await expectBlocked({ token: 'e'.repeat(64) });
  });

  it('blocks a plausible session cookie signed with the wrong secret', async () => {
    const bogus = auth.createSessionCookie('f'.repeat(64), false, SESSION_EPOCH);
    requestHeaders.set('cookie', `hs-session=${bogus}`);
    await expectBlocked();
  });

  it('accepts the existing display token from the URL without changing auth state', async () => {
    const before = await fs.readFile(path.join(tmpDir, 'data/auth.json'), 'utf8');
    await expectAllowed(DISPLAY_TOKEN, { token: DISPLAY_TOKEN });
    expect(await fs.readFile(path.join(tmpDir, 'data/auth.json'), 'utf8')).toBe(before);
  });

  it('accepts a parent session signed with the real cookie secret and epoch', async () => {
    const session = auth.createSessionCookie(COOKIE_SECRET, false, SESSION_EPOCH);
    requestHeaders.set('cookie', `hs-session=${session}`);
    await expectAllowed(DISPLAY_TOKEN);
  });

  it('allows an anonymous display with no token when password protection is disabled', async () => {
    await writeState({ passwordHash: null, salt: null, cookieSecret: null, displayToken: null });
    await expectAllowed(null);
  });

  it('rejects legacy anonymous access without minting a missing display token', async () => {
    const legacy = enabledState();
    delete legacy.displayToken;
    await writeState(legacy);
    await expectBlocked();
    expect((await auth.readAuthState()).displayToken).toBeUndefined();
  });
});
