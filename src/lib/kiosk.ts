/**
 * Kiosk display management — syncs display settings to kiosk.conf
 * (read by kiosk-launcher.sh on boot) and applies wlr-randr live.
 */
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import path from 'path';
import type { ScreenConfiguration } from '@/types/config';

const KIOSK_CONF = 'data/kiosk.conf';

function getKioskConfPath(): string {
  return path.join(process.cwd(), KIOSK_CONF);
}

/**
 * Generate kiosk.conf content from config settings.
 * The file is pure shell key=value pairs, readable without node.
 */
function buildKioskConf(config: ScreenConfiguration): string {
  const s = config.settings;
  const raw = config as unknown as Record<string, unknown>;
  const rawSettings = (raw.settings ?? {}) as Record<string, unknown>;

  const w = s.displayWidth || 0;
  const h = s.displayHeight || 0;
  const mw = Math.max(w, h);
  const mh = Math.min(w, h);

  const lines: string[] = [];
  if (mw && mh) lines.push(`DISPLAY_MODE="${mw}x${mh}"`);
  if (s.displayTransform && s.displayTransform !== 'normal') {
    lines.push(`DISPLAY_TRANSFORM="${s.displayTransform}"`);
  }
  // piVariant is set by install scripts but not in the TypeScript types.
  // Validate to prevent shell injection since kiosk.conf is sourced by bash.
  const piVariant = rawSettings.piVariant as string | undefined;
  if (piVariant && /^[a-z0-9-]+$/.test(piVariant)) lines.push(`PI_VARIANT="${piVariant}"`);

  return lines.join('\n') + '\n';
}

/**
 * Write kiosk.conf so kiosk-launcher.sh picks up display settings on next boot.
 * Called after every config write to keep kiosk.conf in sync.
 */
export async function syncKioskConf(config: ScreenConfiguration): Promise<void> {
  const confPath = getKioskConfPath();
  const desired = buildKioskConf(config);
  // Only write if content changed (avoids unnecessary disk writes on Pi SD cards)
  try {
    const current = await fs.readFile(confPath, 'utf-8');
    if (current === desired) return;
  } catch {
    // File doesn't exist yet — write it
  }
  await fs.writeFile(confPath, desired, 'utf-8');
}

/**
 * Detect the Wayland output name via wlr-randr.
 */
function detectOutput(): Promise<string> {
  return new Promise((resolve) => {
    execFile('wlr-randr', [], {
      env: { ...process.env, XDG_RUNTIME_DIR: `/run/user/${process.getuid?.() ?? 1000}`, WAYLAND_DISPLAY: 'wayland-0' },
      timeout: 5000,
    }, (err, stdout) => {
      if (err || !stdout) return resolve('HDMI-A-1');
      const firstLine = stdout.split('\n')[0] ?? '';
      const output = firstLine.split(' ')[0];
      resolve(output || 'HDMI-A-1');
    });
  });
}

/**
 * Run a single wlr-randr command with Wayland env vars.
 * Resolves true on success, false on failure.
 */
function wlrRandr(...args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('wlr-randr', args, {
      env: { ...process.env, XDG_RUNTIME_DIR: `/run/user/${process.getuid?.() ?? 1000}`, WAYLAND_DISPLAY: 'wayland-0' },
      timeout: 5000,
    }, (err) => resolve(!err));
  });
}

// Serialize concurrent apply calls so interleaved wlr-randr commands
// don't leave the display in an inconsistent state.
let applyQueue: Promise<boolean> = Promise.resolve(false);

/**
 * Apply display transform and mode via wlr-randr immediately (no reboot).
 * Transform and mode are applied as separate calls so a mode failure
 * (e.g. resolution not in EDID) doesn't prevent the transform from applying.
 *
 * Returns true if the transform was applied successfully.
 */
export function applyDisplaySettings(config: ScreenConfiguration): Promise<boolean> {
  const next = applyQueue.catch(() => false).then(() => doApplyDisplaySettings(config));
  applyQueue = next;
  return next;
}

async function doApplyDisplaySettings(config: ScreenConfiguration): Promise<boolean> {
  const s = config.settings;

  // Detect the connected output name
  const output = await detectOutput();
  let applied = false;

  // Apply transform (rotation) — independent of mode
  const transform = (s.displayTransform && s.displayTransform !== 'normal')
    ? s.displayTransform
    : 'normal';
  applied = await wlrRandr('--output', output, '--transform', transform);

  // Apply mode (best-effort: try EDID mode, then custom-mode, then skip)
  const w = s.displayWidth || 0;
  const h = s.displayHeight || 0;
  if (w && h) {
    const mw = Math.max(w, h);
    const mh = Math.min(w, h);
    const mode = `${mw}x${mh}`;
    const modeOk = await wlrRandr('--output', output, '--mode', mode);
    if (!modeOk) {
      await wlrRandr('--output', output, '--custom-mode', mode);
    }
  }

  return applied;
}
