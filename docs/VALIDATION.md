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

On one 150-CAL with Android 13: full-screen browser rendering and touch; calendar week/month navigation; person-scoped chores; reward selection; sample earn/spend/persist behavior; and Apple shared album rendering. These checks used the prior Mac-hosted build of the same application changes. Actual household points were not changed by publication tests. The earlier reboot observation was insufficient to establish unattended startup; the corrected boot investigation is recorded below.

## Linux Docker verification

[GitHub Actions Docker smoke test](https://github.com/Biblejustin/skylight-family-hub/actions/runs/34179114077) passed for commit `74d4799939a6e58accfd3b9cb9702d0cef7da0b7` on an Ubuntu Linux runner:

- Image built from the clean repository and installed Linux dependencies.
- Container started nonroot with read-only application files and writable persistent volumes.
- Display HTML rendered; the calendar route loaded and correctly reported empty setup.
- Empty configuration contained no remote feeds or photo links.
- Initializer preserved an edited configuration exactly.
- Both data and background files, plus changed configuration, survived container recreation.
- With a parent password enabled, anonymous and invalid-token display requests were denied; existing kiosk and parent credentials were accepted. Denied responses did not disclose private feed URLs or reveal a stored token to a caller who had not supplied it.

The first container run exposed missing weather defaults in the empty example. Those defaults were added; the passing run includes that fix.

## Target NAS migration verification

The source also built and started on a QNAP TS-X80, x86-64, running Linux 5.10, Docker `27.1.2-qnap8`, and Compose `v2.29.1-qnap2`. Container Station's discovered `bin` directory supplied the Docker CLI in the SSH shell; see [NAS setup](NAS-DOCKER.md).

- All **47 imported data and background files** matched the frozen source snapshot by SHA-256.
- The container runs as UID/GID `1000:1000` and became healthy.
- Existing authentication, private display access, and family records were preserved.
- Both configured iCal sources reported healthy and returned calendar events.
- After container recreation, the service became healthy again and all **40 protected files** remained byte-identical: five core data files and 35 background files.
- The photo API returned a 50-image batch, and the shared-album slideshow rendered on the physical Skylight from the NAS.
- NAS remote screen navigation, physical person selection, and the rewards interface worked.
- Fully's saved Start URL was verified against the NAS endpoint and existing display token. The previous Mac listener was stopped, and no ADB reverse tunnel was present.

The Android reboot test exposed change `203704822`, which deferred the helper's boot broadcast until its process started. A per-app `am compat disable` override was accepted on the tested firmware; no APK code or global setting changed. [Android's boot-deferral change](https://developer.android.com/about/versions/13/reference/compat-framework-changes#defer_boot_completed_broadcast_change_id).

The second normal Android reboot passed with this override. Fully opened the NAS-hosted weekly calendar and displayed events without any post-reboot input, manual app launch, or helper opening. Verification used only ADB connection waits, property reads, and a private screenshot; the image is excluded from publication.

Physical removal of the laptop's USB cable and a full NAS power-cycle test are not claimed. Container recreation verifies container recovery and persisted volumes, not whole-NAS boot behavior. Other NAS products, ARM64, and different display firmware still require their own checks.

The refactored public AOA command was not rerun on hardware during publication. The existing display already had ADB enabled; the guide clearly separates that untested refactor from the successful original input sequence.

## Display-page authentication correction

Both display page routes now check real credentials before returning private configuration. Anonymous requests and invalid tokens redirect to login; an existing kiosk token or parent session succeeds. Tests cover missing/forged/duplicate credentials, revoked sessions, disabled authentication, and legacy auth state without a display token. Authorization no longer creates credentials for an unauthenticated caller.

The corrected build was also installed on the already configured display host and checked over HTTP: unauthenticated responses disclose neither stored credentials nor feed URLs, existing authorized URLs still work, and configuration, auth state, chores, completion/balance records, and rewards remain byte-identical. Physical display reload succeeded.
