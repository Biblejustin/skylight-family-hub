# Family Hub Startup

Small, local Android helper for the Skylight 150-CAL running Android 13. After `BOOT_COMPLETED`, it waits 20 seconds, requests Fully Kiosk's main activity, then stops. This addresses the observed startup race in which Skylight opens its calendar shortly after Fully's own boot receiver runs.

Package: `org.familyhub.startup`  
Controls: `org.familyhub.startup/.MainActivity`  
Launch target: `de.ozerov.fully/.MainActivity`

Automatic startup defaults **off**. Original Skylight apps remain installed. The helper does not become the HOME app, monitor other apps, draw overlays, or retry a launch. It stores only its enabled setting and latest status in its own private preferences. No external services or libraries are used.

## Permissions

| Permission | Purpose |
| --- | --- |
| `RECEIVE_BOOT_COMPLETED` | Receive the normal post-unlock boot broadcast. |
| `FOREGROUND_SERVICE` | Keep a visible, temporary countdown service running for 20 seconds. |
| `SYSTEM_ALERT_WINDOW` | Android's user-granted exemption for starting an activity from the background. No overlay window is drawn. |
| `POST_NOTIFICATIONS` | Allow the countdown notification in Android 13's notification drawer if granted externally in app settings. The helper never requests this permission. |

The only permission-settings prompt opened by the helper is **Display over other apps**, after its button is tapped. A foreground-service notification is always constructed. Android 13 permits the service without notification permission; when denied, its notice appears in Android's active-apps task manager rather than the notification drawer. See [Android notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission).

No Internet, storage, calendar, contacts, account, accessibility, device-administrator, or package-install permissions. Only Fully's package is queried. The receiver and service are not exported. Only the launcher activity is exported. Backups and application debugging are disabled.

## Build

On an Apple Silicon Mac, from this directory:

```sh
python3 bootstrap-toolchain.py
python3 build.py
```

Bootstrap downloads pinned OpenJDK 17.0.2, Android API 33, and Android Build Tools 35 from official OpenJDK/Google servers. It verifies published archive checksums and writes receipts under `.toolchain/`. All tools stay here; no SDK installation, global settings, or shell profiles are changed. Google's macOS tools require Rosetta on Apple Silicon. Existing alternative tool paths can be supplied with `build.py --jdk ... --build-tools ... --android-jar ...`.

The build compiles Java 8 bytecode, converts it with D8, aligns the APK, and signs with a locally generated development key. No Gradle, AndroidX, Maven, or application dependencies. `build/` is replaced by each build; source, downloaded tools, and signing key are retained.

Outputs:

- `build/family-hub-startup-debug.apk`
- `build/SHA256SUMS`
- `.signing/debug.keystore` — retain privately for updates; ignored by Git. This uses the conventional development password and is not a production publishing key.

The filename describes the signing key; `android:debuggable` is **false**. Build execution verifies the signature and ZIP alignment. Neither script installs or communicates with a device.

## Enable and test

After installation by the device owner:

1. Open **Family Hub Startup** once.
2. Confirm Fully Kiosk shows **available**. Tap **Allow display over other apps** and enable that permission in Android settings.
3. Return to the helper. Run **Test delayed start**, then leave it for another app. After roughly 20 seconds, confirm Fully appears.
4. Enable **Open Fully Kiosk after reboot**.
5. Apply the Android 13 compatibility setting below if using the tested setup, and check that the command succeeds.
6. Reboot normally. Do not open the helper or Fully manually, including through ADB. Confirm Fully appears after the stock startup sequence, then remains visible. Test on the physical device is required; a successful build or foreground countdown does not establish boot behavior.

**Cancel pending start** stops the current countdown. Disabling automatic startup also cancels it. The notification opens these controls; tapping it does not itself cancel. **Open Fully Kiosk now** is a normal foreground launch and works without overlay permission.

### Android 13 compatibility setting

This APK targets API 33. Android change `203704822` defers boot broadcasts until a process in the app's UID starts. A manual app launch after reboot can conceal that deferral. [Official Android change description](https://developer.android.com/about/versions/13/reference/compat-framework-changes#defer_boot_completed_broadcast_change_id).

Using your selected device serial from the setup guide:

```sh
adb -s "$SKYLIGHT_SERIAL" shell am compat disable 203704822 org.familyhub.startup
```

The tested firmware accepted this app-specific override. It changes no APK code or global boot setting and required no root access. Other firmware may reject it; Android limits compatibility overrides by app and platform build. Acceptance alone does not prove automatic startup. Complete the hands-free reboot check above.

To remove only this override and restore the platform default:

```sh
adb -s "$SKYLIGHT_SERIAL" shell am compat reset 203704822 org.familyhub.startup
```

Resetting may restore the deferral. The helper does not apply or reset this external setting itself. [Android compatibility command reference](https://developer.android.com/guide/app-compatibility/test-debug#toggle_changes_using_adb).

## Limits and removal

Designed for Android 13/API 33. The manifest permits API 26+, but other Android versions and vendor firmware have not been validated. Revalidate after firmware or Fully updates. [Android background activity rules](https://developer.android.com/guide/components/activities/secure-bal) and [foreground-service startup exceptions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start) explain the two separate permissions involved.

The delay starts when the boot receiver runs, not when electrical power is applied. It uses uptime, so device sleep can extend the delay. Boot broadcasts can be delayed by unlocking, force-stop state, battery restrictions, or vendor firmware. The helper needs an initial app launch after installation. Android may silently reject an activity start: **launch requested** records the request, not proof that Fully appeared. A later Skylight watchdog takeover is not handled.

Turn startup off to stop automatic launches. If you configured the per-app compatibility override, reset it with the command above before uninstalling. Uninstall **Family Hub Startup** in Android app settings to remove the helper, its private settings, and its permissions. Removing it does not otherwise restore settings previously altered outside this helper. Original Skylight and Fully applications are untouched.

Source in this directory is MIT licensed. Downloaded tools retain their own licenses.

## Device verification — September 7, 2026

Installed and enabled on 150-CAL, Android 13. Helper overlay and notification permissions allowed. Fully's own Launch on Boot disabled; Fully overlay app-op restored to default. Stock Skylight HOME and watchdog remain intact.

The first reboot observation did not establish unattended boot reliability. A later test found Android 13 deferring the helper's boot broadcast until its process was started. After applying the per-app override above, a second normal reboot passed: Fully displayed the NAS-hosted weekly calendar with events without any manual input or app launch after reboot. Only read-only ADB checks and a screenshot were used during verification. See the [validation record](../docs/VALIDATION.md). Other firmware still requires its own test.

Use `adb install --no-incremental` for this device. The initial default installer selected incremental installation; device restarted during that attempt and reported `kernel_panic,oops:_fatal_exception`. Helper was not installed. Device recovered automatically; standard streamed installation with `--no-incremental` succeeded. Avoid incremental installation on this firmware.

For the complete screen setup, see [Device setup](../docs/DEVICE-SETUP.md). For an always-on hub host, see [NAS Docker setup](../docs/NAS-DOCKER.md). The helper launches a browser; it does not run the hub server on Android.
