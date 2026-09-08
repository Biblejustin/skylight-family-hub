# Validation record

Publication preparation: September 7, 2026 (America/Chicago).

## Clean public source

- Fresh `npm ci` from the committed package lock passed on macOS.
- All **8,234 tests across 509 Vitest files passed**.
- ESLint passed.
- Next.js production build and its TypeScript check passed. The upstream application still emits 20 dynamic filesystem tracing warnings; this publication does not claim to eliminate them.
- Empty setup validated: three screens, no calendar sources, requested timezone, restrictive data/config permissions, and exact preservation of an existing configuration.
- Seven pure Python tests passed for the optional AOA input helper. Its HID descriptors match the earlier scripts used on the tested display.
- Public source reviewed for household identifiers and exact configured secrets. Runtime directories, screenshots, exports, tokens, signing keys, APKs and built artifacts are excluded from publication.

## Physical display already verified

On one 150-CAL with Android 13: full-screen browser rendering and touch; calendar week/month navigation; person-scoped chores; reward selection; sample earn/spend/persist behavior; Apple shared album rendering; and delayed browser launch after a normal reboot. These checks used the prior Mac-hosted build of the same application changes. Actual household points were not changed by publication tests.

## Still requires target NAS testing

Docker Engine was unavailable on the preparation machine. Compose/Dockerfile, persistent storage paths, initializer, health-check code and synthetic migration behavior received static/local review; **no Linux image build or NAS deployment is claimed here**.

Before retiring another host, verify the actual NAS build, startup, volume permissions, login, calendar sources, photo rendering, migrated balances, and container restart persistence. Then verify Skylight with the laptop disconnected. Firmware differences and other NAS architectures require their own checks.

The refactored public AOA command was not rerun on hardware during publication. The existing display already had ADB enabled; the guide clearly separates that untested refactor from the successful original input sequence.
