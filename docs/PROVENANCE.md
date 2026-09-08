# Source and changes

This repository starts from the MIT-licensed [Home Screens](https://github.com/home-screens/home-screens) source archive downloaded during setup on September 7, 2026. Its package version is **1.12.0**. The local archive did not contain Git metadata, so this project does not claim an exact upstream commit SHA.

Baseline archive SHA-256:

```text
04570eaa64d590024ba7738cef2d10b1cc8f7a6550ea14b05d72e88241dc6060
```

The archive is not redistributed; this repository contains the application source, package lock, test fixtures, and public assets required to build it. Original upstream MIT copyright and applicable asset notices are retained. Upstream marketing site, deployment workflows, installation-specific data, and local build artifacts are not part of this publication.

Added or changed for this setup:

- Every-N-days chore recurrence with an anchor date and editor controls.
- Support for extended Apple shared-album tokens, bounded large-album fetches, and newest-photo priority.
- Calendar Week/Month controls, period navigation, Today reset, and separate viewed-date/current-date handling.
- Person-first fullscreen chore view, selected-person rewards, serialized saves, explicit complete/undo requests, and safer failure rollback.
- Android delayed-start helper, firmware-specific setup notes, and reproducible source build instructions.
- Empty household template, non-overwriting setup command, and NAS Docker deployment.

Tests from the upstream project remain alongside tests for these changes. Household-specific fixtures have been replaced with invented names. No original Skylight proprietary code, subscription data, family export, third-party APK, signing key, or configured household state is included.

The Android access method was informed by [dinewby88/SkylightMaxCalendarADB](https://github.com/dinewby88/SkylightMaxCalendarADB), which documents a System UI crash-dialog route on Skylight hardware. The guide in this repository distinguishes what was observed on one 150-CAL from steps that may differ on other firmware.

The upstream marketing-site statistics test is omitted along with the marketing site it validates. Application tests remain.
