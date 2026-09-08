# Repurpose a Skylight 150-CAL

Use the existing screen as a touch browser for a locally hosted family calendar, chores, points, rewards, and photos. Keep the original Skylight application installed.

This guide records one successful setup. It does not establish compatibility with every Skylight model or firmware.

## What runs where

| Part | Role | Must remain connected? |
| --- | --- | --- |
| Skylight wall adapter | Powers the screen | Yes |
| Skylight Wi-Fi | Connects the browser to the family hub | Yes |
| Computer-to-Skylight micro-USB data cable | Initial Android setup and optional diagnostics | No, once setup is complete |
| LAN server | Runs Home Screens and stores family data | Yes, powered on and awake |
| Internet | Refreshes external calendars and shared photos | Required for those refreshes |

Disconnecting the micro-USB cable does not move the server onto the Skylight. The screen can operate without a USB connection, but the host still serves its pages and saves chores. If a laptop hosts the hub, closing it or allowing it to sleep can interrupt the hub. For an always-on host, follow [NAS Docker setup](NAS-DOCKER.md). A Raspberry Pi is another possible host; this project's original device verification used a Mac server.

Keep the existing wall-power cable behind the frame and route it into a secured cable cover. No permanent USB data cable is needed for this setup.

## Tested device and limits

| Component | Tested value |
| --- | --- |
| Skylight model | 150-CAL, 15-inch |
| Android | 13, API 33, arm64 |
| Hardware/build family | `rk3562_15_inch` |
| Skylight software | 26.24.0 (24374) |
| Firmware build date | 2024-11-23 |
| System WebView | 109.0.5414.123 |
| Fully Kiosk Browser | 1.61.2, free features |

Root, bootloader unlocking, firmware flashing, factory reset, a replacement HOME application, and disabling the Skylight watchdog were not required. The original app and its data remained in place. Browser rendering, touch, calendar navigation, person-specific chores, reward spending with sample data, and startup after a normal reboot were verified. Not every Home Screens feature was tested on this older WebView.

## 1. Prepare the host and cables

1. Keep the Skylight's original wall adapter connected and turn the screen on.
2. Connect its micro-USB port to your computer with a known **data-capable** cable. A charge-only cable will not provide Android debugging.
3. Put the Skylight and hub server on a network where they can reach each other. Avoid guest-network client isolation.
4. Install Google's [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools). Android Studio is not required for the `adb` command.
5. Open a terminal with `adb` on your command path, or substitute the full path to the downloaded executable.

The server's address must stay reachable. Use your own hostname or a DHCP reservation. Addresses shown in this guide are placeholders; never copy someone else's display token or configuration.

## 2. Reach Android Settings

This is the firmware-dependent step. Skylight's normal settings page is not Android Settings. Tapping Skylight's displayed software or firmware version repeatedly did not enable developer options on the tested unit.

The approach came from the community [Skylight Max ADB walkthrough](https://github.com/dinewby88/SkylightMaxCalendarADB). That guide documents a physical-button method on a different model. Our 150-CAL successfully followed the same UI sequence using USB Android Open Accessory HID input to send the power-menu press and two-finger gesture. A physical-only run on the 150-CAL was not separately verified.

1. Request the power menu with a short hold of approximately two seconds. Release when **Power off / Restart** appears.
2. Swipe down from the very top edge using two fingers.
3. If a different power dialog appears, repeat the short power-menu request and top-edge gesture a few times, checking the visible screen after each attempt.
4. When **System UI keeps stopping** appears, immediately tap **App info**.
5. On the tested unit this opened the Android settings interface. Navigate to **About tablet**.

Stop repeating the gesture as soon as the error dialog appears; another input can dismiss the entry point. Do not select Power off, Restart, Lockdown, Reset, or Clear storage during this step. The successful test used a 1.8-second power-key press, not a prolonged hold. If the expected interface never appears, this firmware may require another method; this guide does not provide a verified universal escape.

The USB HID route operates before ADB is enabled. Ordinary `adb shell input` commands cannot perform this initial step until debugging already works. Exploratory accessory-URI, keyboard-shortcut, and keyboard-settings attempts did not open a usable browser or settings route on this unit and are not required by this guide.

### Optional: reproduce the USB-assisted input

The repository includes a parameterized version of the two small USB input scripts used in the successful setup. Install Python 3 and libusb 1.0 on your setup computer. On macOS with Homebrew, libusb is available through `brew install libusb`. The tool does not install drivers or change USB modes. macOS was the original host; permissions and libusb availability on other operating systems need separate validation.

From the repository root, list only matching pre-ADB interfaces:

```sh
python3 tools/android/aoa_input.py list
```

Copy your own device serial from that local output. Run **one** action at a time, watching the screen between commands:

```sh
AOA_SERIAL='REPLACE_WITH_YOUR_DEVICE_SERIAL'
python3 tools/android/aoa_input.py --serial "$AOA_SERIAL" power-menu
python3 tools/android/aoa_input.py --serial "$AOA_SERIAL" two-finger
```

The first command holds the consumer Power key for 1.8 seconds and releases it. The second sends one two-contact swipe and releases both contacts. Temporary HID registrations are then removed. There is no automatic repeat. Stop sending input when **System UI keeps stopping** appears and tap **App info** physically.

The default gesture reproduces the tested **portrait** 150-CAL orientation: raw start `(0.9995, 0.42)` to `(0.65, 0.42)`, with the second contact offset by `0.16` on the raw Y axis. In that orientation, screen coordinates followed `screen-x = raw-y` and `screen-y = 1 - raw-x`; the gesture stayed above the power-menu action buttons. Do not use those coordinates blindly in landscape or on another model. For another verified mapping, `--start X Y --end X Y` accepts normalized raw coordinates between 0 and 1.

If library discovery fails, supply `--libusb /path/to/your/libusb-library` before the subcommand. For Homebrew on macOS:

```sh
python3 tools/android/aoa_input.py --libusb "$(brew --prefix libusb)/lib/libusb-1.0.dylib" list
```

The public tool was unit-tested without hardware; its input descriptors and timing match the earlier device-tested scripts. The refactored public tool itself was not rerun against the configured display. It sends input only to one explicitly selected, known pre-ADB USB interface; an absent or ambiguous serial stops the command.

## 3. Enable and authorize USB debugging

Once Android Settings is open, these are standard Android developer-option steps:

1. Open **About tablet → Build number**.
2. Tap **Build number** seven times.
3. Return to **System → Developer options**.
4. Enable **USB debugging** and accept its confirmation.
5. On the computer, run:

   ```sh
   adb devices -l
   ```

6. Accept the **Allow USB debugging?** prompt on the Skylight for your computer. Rerun the command. The device should say `device`, not `unauthorized`.

Use the serial from your own `adb devices -l` output for subsequent commands:

```sh
SKYLIGHT_SERIAL='REPLACE_WITH_YOUR_DEVICE_SERIAL'
adb -s "$SKYLIGHT_SERIAL" shell getprop ro.build.version.release
adb -s "$SKYLIGHT_SERIAL" shell getprop ro.build.version.sdk
```

If ADB lists nothing, check wall power, screen power, the data cable, and USB debugging before changing anything else. If it says `unauthorized`, look at the display for the approval prompt. Wireless debugging is not needed.

After debugging works, this standard Android command is useful if the stock app covers Settings again:

```sh
adb -s "$SKYLIGHT_SERIAL" shell am start -a android.settings.SETTINGS
```

## 4. Start and configure the family hub server

Follow [NAS Docker setup](NAS-DOCKER.md), or the repository's other server setup instructions first. Keep the server running while setting up the screen.

1. Open the hub's `/editor` page from your computer.
2. Configure parent access and generate your own authorized display URL.
3. Configure the screen size and orientation. The tested layout was 1920 × 1080 landscape.
4. Add the calendar, chores, and photo screens you want.
5. Configure the hub's timezone.
6. Open the generated display URL in a second browser tab and confirm that the page loads.

The original setup used manual swipes between screens, calendar Week/Month/Today controls, and person-first chore selection. Parents edit calendars on their phones. Optional photos require a supported source.

Treat the full display URL as a credential. Secret iCal addresses, album links, parent credentials, live `data/`, and their backups belong outside Git. An authorized display can receive configuration containing feed URLs; a display token is not a boundary that hides those feeds from its holder.

## 5. Install Fully Kiosk Browser

Download an APK directly from [Fully Kiosk](https://www.fully-kiosk.com/). The tested release was [Fully Kiosk Browser 1.61.2](https://www.fully-kiosk.com/files/2026/08/Fully-Kiosk-Browser-v1.61.2.apk). Its observed SHA-256 was:

```text
c050f755b5d4fa8ee5e1a5c182acb3291c96bd1a8bf5130ee6ec664dc7e554c0
```

That checksum identifies the tested file, not future versions. Review and test newer versions separately.

Install using **non-incremental** mode:

```sh
adb -s "$SKYLIGHT_SERIAL" install --no-incremental ./Fully-Kiosk-Browser-v1.61.2.apk
adb -s "$SKYLIGHT_SERIAL" shell am start -W -n de.ozerov.fully/.MainActivity
```

On this firmware, an incremental installation of the startup helper caused a kernel panic and reboot. A subsequent `--no-incremental` installation succeeded. Use that option for both APKs.

In Fully's settings:

1. Set **Start URL** to your own authorized display URL and save it.
2. Enable fullscreen browsing and **Keep Screen On**.
3. Hide browser, status, and navigation bars as appropriate for your layout.
4. Leave Fully's **Launch on Boot** off; the next step supplies the tested delayed startup.
5. Load the Start URL and confirm the family hub appears.

No Fully PLUS purchase or cloud account was used. The setup did not require camera, microphone, location, or storage access. The tested installation allowed Android notifications. The helper below needs its own separate permission for its delayed launch; it does not require granting Fully an overlay permission.

## 6. Match the device timezone to the hub

Set Android's system timezone to match your household and the hub. Some chore calculations use the browser's local date. A device left on GMT can show tomorrow's chores during the local evening even if the calendar header uses the correct timezone.

Use Android's **System → Date & time** settings, or the following commands. Replace the example IANA timezone with yours:

```sh
SKYLIGHT_TIMEZONE='America/Chicago'
adb -s "$SKYLIGHT_SERIAL" shell settings put global auto_time_zone 0
adb -s "$SKYLIGHT_SERIAL" shell cmd alarm set-timezone "$SKYLIGHT_TIMEZONE"
adb -s "$SKYLIGHT_SERIAL" shell getprop persist.sys.timezone
adb -s "$SKYLIGHT_SERIAL" shell settings get global auto_time
```

The final command should report `1` if automatic clock synchronization remains enabled. Disabling automatic **timezone** does not disable automatic **time**. The `cmd alarm set-timezone` route was verified on the tested Android 13 firmware; other versions may differ. Restart Fully after changing the timezone so its browser context uses the new setting:

```sh
adb -s "$SKYLIGHT_SERIAL" shell am force-stop de.ozerov.fully
adb -s "$SKYLIGHT_SERIAL" shell am start -W -n de.ozerov.fully/.MainActivity
```

## 7. Build and install the delayed startup helper

Fully's own boot launch lost a race on the tested firmware: Fully opened, then Skylight's calendar opened over it. The included helper waits 20 seconds after its Android boot broadcast, opens Fully once, then stops.

From the repository root, on the tested macOS build environment:

```sh
cd android-startup-helper
python3 bootstrap-toolchain.py
python3 build.py
adb -s "$SKYLIGHT_SERIAL" install --no-incremental ./build/family-hub-startup-debug.apk
adb -s "$SKYLIGHT_SERIAL" shell am start -W -n org.familyhub.startup/.MainActivity
```

See the [helper's README](../android-startup-helper/README.md) for pinned tool downloads, Rosetta requirements on Apple Silicon, and using an existing Android SDK on other build hosts. The bootstrap is for macOS; these exact bootstrap commands are not a verified Linux or Windows build recipe. Android SDK/JDK paths can instead be supplied to `build.py`.

The APK is signed with a locally generated development key; application debugging is disabled. Keep `.signing/` private and retain it for future updates. Do not publish your signing key.

On the Skylight:

1. Open **Family Hub Startup** once after installation.
2. Confirm **Fully Kiosk: available**.
3. Tap **Allow display over other apps** and enable that permission for **Family Hub Startup** in Android settings.
4. Return to the helper.
5. Tap **Test delayed start (20 seconds)**, then leave the helper for another app. Confirm Fully opens after the countdown.
6. Enable **Open Fully Kiosk after reboot**.

The helper draws no overlay. Android's overlay permission supplies the background-activity-start exemption. The helper has no network, photos, calendar, contacts, account, or shared-storage permission. A temporary foreground-service notification accompanies its countdown. Its notification permission was allowed in the tested setup; see the helper README for Android 13 behavior when notifications are denied.

Do not change the default HOME application or disable the stock Skylight application for this method.

## 8. Verify reboot and USB-free operation

1. Keep the hub server running and the Skylight's wall power connected.
2. Reboot normally:

   ```sh
   adb -s "$SKYLIGHT_SERIAL" reboot
   ```

3. Watch the physical screen. The stock calendar may appear first. Fully should open after the helper receives the boot broadcast and completes its 20-second delay.
4. Confirm it remains visible and shows the correct hub.
5. Test navigation and, using a temporary sample chore, verify that completing and undoing it save correctly. Do not use real reward balances for testing.
6. Disconnect only the computer-to-Skylight micro-USB cable.
7. Repeat a screen-navigation check over Wi-Fi. The hub should continue working with wall power and Wi-Fi alone.

The original setup passed a normal reboot test with Fully taking over after the stock calendar. Its helper service stopped afterward. The 20-second interval begins at the boot broadcast, not at power-on. A successful `launch requested` status is not visual proof; check the screen yourself.

Moving the server to a Pi is a separate step. Rebuild or install its dependencies on Linux; do not copy a macOS `node_modules` or standalone runtime bundle. Transfer private `data/` locally, set the server and screen timezones, update Fully's Start URL, and verify calendar sources, chores, balances, and parent access. Pi hosting and startup-service behavior need their own device test.

## Return to the stock app

You can open the original app without removing anything:

```sh
adb -s "$SKYLIGHT_SERIAL" shell am start -W -n com.skylight/odesk.johnlife.skylight.activity.MainActivity
```

That activity name was verified on the tested firmware. Return to the hub with:

```sh
adb -s "$SKYLIGHT_SERIAL" shell am start -W -n de.ozerov.fully/.MainActivity
```

To stop automatic hub startup:

1. Open **Family Hub Startup**.
2. Turn **Open Fully Kiosk after reboot** off. This also cancels a pending countdown.
3. Leave Fully's own **Launch on Boot** off.
4. Optionally uninstall the helper:

   ```sh
   adb -s "$SKYLIGHT_SERIAL" uninstall org.familyhub.startup
   ```

5. Optionally uninstall Fully if you no longer need its saved browser settings:

   ```sh
   adb -s "$SKYLIGHT_SERIAL" uninstall de.ozerov.fully
   ```

Uninstalling Fully removes its local browser configuration, including the saved Start URL. These removals do not delete the hub server's `data/`. The default HOME app was never changed, so no launcher restoration is required. USB debugging can be switched off through Android Developer options when you no longer need it.

## Known limitations

- The initial Settings entry relies on firmware behavior, not a supported Skylight developer interface.
- The helper handles startup once. It does not continuously monitor or override a later Skylight watchdog takeover.
- Android boot broadcasts can be delayed by device unlock, battery restrictions, force-stop state, or vendor behavior.
- Revalidate after Skylight firmware, Android WebView, or Fully updates.
- The screen is a network client. Losing the LAN server can prevent both fresh pages and chore saves; this setup does not claim full offline operation.
- Calendar and photo providers can delay their feeds. Browser refreshes do not make external updates instantaneous.
- Public Apple shared-album links remain link-accessible. The implemented album integration is not a private Apple-account sign-in bridge.

## References

- [Community Skylight Max ADB walkthrough](https://github.com/dinewby88/SkylightMaxCalendarADB) — inspiration for the Settings entry point; a different hardware model.
- [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools) — official ADB distribution.
- [Fully Kiosk Browser](https://www.fully-kiosk.com/) — official browser distribution.
- [Android background activity starts](https://developer.android.com/guide/components/activities/secure-bal) — background-launch rules relevant to the startup helper.
- [Android foreground-service startup restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start) — boot and foreground-service constraints.
