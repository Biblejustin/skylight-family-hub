# Validation record

Publication preparation: September 7, 2026 (America/Chicago).

## Clean public source

- Fresh `npm ci` from the committed package lock passed on macOS.
- All **8,258 tests across 510 Vitest files passed**.
- ESLint passed.
- Next.js production build and its TypeScript check passed. The upstream application still emits 20 dynamic filesystem tracing warnings; this publication does not claim to eliminate them.
- Empty setup validated: three screens, no calendar sources, requested timezone, restrictive data/config permissions, and exact preservation of an existing configuration.
- Seven pure Python tests passed for the optional AOA input helper. Its HID descriptors match the earlier scripts used on the tested display.
- Public source reviewed for household identifiers and exact configured secrets. Runtime directories, screenshots, exports, tokens, signing keys, APKs and built artifacts are excluded from publication.

## Physical display already verified

On one 150-CAL with Android 13: full-screen browser rendering and touch; calendar week/month navigation; person-scoped chores; reward selection; sample earn/spend/persist behavior; Apple shared album rendering; and delayed browser launch after a normal reboot. These checks used the prior Mac-hosted build of the same application changes. Actual household points were not changed by publication tests.

## Linux Docker verification

[GitHub Actions Docker smoke test](https://github.com/Biblejustin/skylight-family-hub/actions/runs/34177967620) passed for application commit `d50a60d7f76c06f348fd9e39a990b05471455aed` on an Ubuntu Linux runner:

- Image built from the clean repository and installed Linux dependencies.
- Container started nonroot with read-only application files and writable persistent volumes.
- Display HTML rendered; the calendar route loaded and correctly reported empty setup.
- Empty configuration contained no remote feeds or photo links.
- Initializer preserved an edited configuration exactly.
- Both data and background files, plus changed configuration, survived container recreation.

The first container run exposed missing weather defaults in the empty example. Those defaults were added; the passing run includes that fix.

## Still requires target NAS testing

Docker was unavailable on the preparation Mac; Linux verification ran in GitHub Actions. No deployment onto a household NAS or transfer of private family data is claimed here. ARM64 and individual NAS products have not been tested.

Before retiring another host, verify the actual NAS build, startup, volume permissions, login, calendar sources, photo rendering, migrated balances, and container restart persistence. Then verify Skylight with the laptop disconnected. Firmware differences and other NAS architectures require their own checks.

The refactored public AOA command was not rerun on hardware during publication. The existing display already had ADB enabled; the guide clearly separates that untested refactor from the successful original input sequence.

## Display-page authentication correction

Both display page routes now check real credentials before returning private configuration. Anonymous requests and invalid tokens redirect to login; an existing kiosk token or parent session succeeds. Tests cover missing/forged/duplicate credentials, revoked sessions, disabled authentication, and legacy auth state without a display token. Authorization no longer creates credentials for an unauthenticated caller.

The corrected build was also installed on the already configured display host and checked over HTTP: unauthenticated responses disclose neither stored credentials nor feed URLs, existing authorized URLs still work, and configuration, auth state, chores, completion/balance records, and rewards remain byte-identical. Physical display reload succeeded.
