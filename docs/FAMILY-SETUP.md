# Configure a new family hub

Use these steps for a fresh installation. For an existing household, migrate its private data first using [NAS setup](NAS-DOCKER.md#migrate-the-existing-installation); do not re-create members or balances.

## 1. Start and protect the server

1. Follow [Docker setup](NAS-DOCKER.md). First start creates empty Calendar, Chores and rewards, and Photos screens.
2. Open `http://NAS_ADDRESS:3000/editor` on your computer. Replace `NAS_ADDRESS` with the address of your NAS, and use your chosen port.
3. Open **Settings → Security** and set a parent password. A fresh app initially has no password. Do this before adding any private feeds.
4. In the same section, copy the display token. Fully's Start URL will be `http://NAS_ADDRESS:3000/display?token=YOUR_DISPLAY_TOKEN`. Replace the placeholder locally; never put the resulting URL in Git or a public issue.
5. Set your timezone in app settings. Also set `TZ` in Docker Compose and the Android system timezone to the same IANA zone. Chore recurrence uses the display's local date, so an incorrect Android timezone can show tomorrow's chores early.
6. Check the canvas dimensions: the included layout is **1920 × 1080, landscape**. Use the editor to change dimensions/orientation for another display.

The phone-friendly control page is `/remote`; the larger layout editor is `/editor`. Swipe between screens on the display, or select a screen from Remote. Automatic screen cycling is disabled in the supplied three-screen layout.

## 2. Add read-only calendars

The tested Google route uses secret iCal links. No Google Cloud project or Apple computer is needed.

1. On a computer, open Google Calendar settings.
2. Under **Settings for my calendars**, select the calendar.
3. Open **Integrate calendar** and copy **Secret address in iCal format**. Do not use the embed URL or the public address for a private calendar. Some managed accounts hide this option.
4. In Family Hub **Settings → Calendar**, add an iCal feed. Give it a friendly name and color, paste the URL, enable it, and save.
5. Repeat for other calendars.
6. Open Calendar on the display and confirm a known event and its time. Try Week, Month, previous/next, and Today.

[Google's secret-address instructions](https://support.google.com/calendar/answer/37648?hl=en) explain how to locate and reset a feed. Anyone with its secret URL can read the events; public calendar sharing is not required. Keep the feed and backups private.

Edit events in the calendar app on your phone. Family Hub refreshes its calendar display about every five minutes; provider caching may add delay. Date navigation fetches the requested range. A reload returns to the configured current-week view.

The upstream app also contains Google sign-in and iCloud calendar options. Those were not used for this deployment. In particular, do not assume the Google TV/device authorization flow supports the calendar scope; this guide deliberately uses iCal. Other providers may work if they supply a compatible read-only ICS feed; Proton migration has not been validated here.

## 3. Add people and chores

1. On `/remote`, open **Chores → Manage → Members**. Add each household member. Pick distinguishable colors or icons.
2. In Manage, add a chore with its title, assigned member, points, and schedule. The app also calls points **tickets**.
3. For every-N-days chores, choose the interval schedule, number of days, and first date. The anchor date controls which days it appears.
4. Add remaining chores. Start with modest values you can adjust later: for example, making a bed for 1 point, taking out trash for 2, and cleaning a room for 5. These are suggestions, not imported Skylight values.
5. Open the display's Chores screen. Tap a person, then a chore. Confirm the check mark and balance change. Tap it again to undo your test.
6. Switch people and confirm each list contains the right assignments.

The included config enables `personSelection: true` on its fullscreen chore module. This opt-in flag is supplied by the setup template; recreating that module manually may revert to the upstream layout. `interactiveNavigation: true` similarly enables the calendar navigation controls. Preserve these flags when editing configuration.

The display saves one chore action at a time. An uncertain save displays a message; check the current state before tapping again. A person chooser is a convenient filter, not identity verification or a parent PIN.

## 4. Add rewards

1. Open **Chores → Rewards → Edit list** from the phone controls.
2. Create each reward with a title, description, point cost, and eligible members.
3. Example ideas: extra game time, choosing dinner, movie night, a day off chores, a store toy, or a planned Yes Day. Set your own costs and household limits.
4. On the display, select a person and open Rewards. Confirm it shows that person's balance and eligible items.

Redemption deducts points and records history. Rewards that involve real-world arrangements remain manual: buying a toy is not automated, and redeeming a chore-free day does not automatically pause that person's schedule.

## 5. Add photos

### Local uploads: no public album required

Upload selected photos through the editor's background/media controls. Set the Photos module source to local media and select the desired directory. Files are stored in the private background volume. This is manual upload, not automatic private Apple synchronization.

### Apple Shared Album: automatic refresh

1. In Apple Photos, create or choose a Shared Album.
2. Turn on **Public Website** in that album's sharing options and copy its link.
3. Select the Photos module in Family Hub's editor, choose the iCloud shared album source, paste the link, and save.
4. Choose photos only, a 10-second interval, fade transition, and **contain** if you want the entire photo visible without cropping.
5. Add a test photo to the same album and allow time for Apple processing and the display refresh.

Apple documents that [anyone with a Public Website URL can access the album](https://support.apple.com/en-ca/guide/iphone/-ipha8f8fc3c5/ios). This integration uses that website and requires no Apple account on the NAS. It does not provide private Apple account photo sync.

The display checks the album roughly every ten minutes while its photo module is running. It shows batches of 50 photos, prioritizing five recently added items and filling the rest from older photos. Updated batches take over after the current slideshow pass. At ten seconds each, a 50-photo pass lasts roughly eight minutes twenty seconds; these timings and Apple's processing can delay visibility. Large albums can take tens of seconds to resolve initially.

Apple's image links expire. When reopening Photos after a long pause, the display skips expired cached links and shows a loading message while retrieving a fresh batch. A large album may need tens of seconds again. If the request fails, the display reports that it cannot update and retries automatically.

## 6. Final household check

With the NAS server running, disconnect the setup computer from the home network. On Skylight, browse calendar dates, complete and undo a test chore, and switch to photos. Reboot Skylight and confirm the startup helper reopens Fully. Verify points still match after a container restart before relying on the setup.

Keep a private backup of the complete data and background volumes. A backup of chore definitions alone omits completion history and earned balances.
