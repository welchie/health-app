# health-app

Personal Health App - written in React Native (AI assisted)

A small React Native (Expo) app for logging daily blood pressure readings on your
own phone: systolic, diastolic and heart rate, a chart of how they are trending,
and a daily reminder to take the reading.

*This is AI-generated information and not professional advice.* The app is not a
medical device, gives no diagnosis, and readings should be discussed with your
doctor or nurse.

## Running it

```bash
npm install && npm start
```

Then press `i` for the iOS simulator, `a` for Android, or scan the QR code with
Expo Go on your phone.

### Reminders and Expo Go

Reminders are local notifications via `expo-notifications`, which Expo Go on
**Android** no longer ships (removed in SDK 53) — importing it there throws and
takes the whole app down. So [src/notifications.ts](src/notifications.ts) loads
that module lazily and only where it can work: the rest of the app runs fine in
Expo Go on Android, and the Reminder tab says the reminder needs a development
build. iOS Expo Go is unaffected.

For working reminders on Android, use a development build:

```bash
npx expo run:android
```

## Building an APK for a real device

The native `android/` project is generated rather than committed, so generate it
first if this is a fresh clone:

```bash
npx expo prebuild --platform android
```

Then a release APK is one Gradle command. Release builds are signed with the
debug keystore (Expo's template default) — fine for sideloading onto your own
phone, **not** for the Play Store.

```bash
cd android && ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

That writes `android/app/build/outputs/apk/release/app-release.apk` (~28 MB;
drop the `-PreactNativeArchitectures` flag for a ~75 MB APK covering all four
ABIs). Unlike a debug build it has the JS bundled in, so it runs standalone with
no Metro server.

Install it over USB with debugging enabled on the phone:

```bash
~/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Or copy the APK to the phone and open it (Android will ask you to allow
installing from that source).

Two things to know:

- **Node via a version manager.** Gradle shells out to `node`, so a Gradle daemon
  started without it on `PATH` fails with `Cannot convert '' to File`. Fix with
  `./gradlew --stop`, then rebuild from a shell where `node` resolves.
- **Signing for distribution.** For the Play Store, generate your own keystore
  and point a `release` signing config at it — see
  [the React Native signing guide](https://reactnative.dev/docs/signed-apk-android),
  and use `bundleRelease` for an `.aab` instead of `assembleRelease`.

## What is in it

| Tab | What it does |
| --- | --- |
| **Log** | Enter a reading, see the latest one banded (Normal / Elevated / High…), and the running average |
| **Trends** | Blood pressure and heart rate charts over 7 / 30 / all days, plus the full history (long press a row to delete) |
| **Reminder** | Switch on a daily notification and pick the time |

Readings are stored with `AsyncStorage` on the device only — nothing is uploaded
anywhere and there is no account.

### Code map

| File | Responsibility |
| --- | --- |
| [App.tsx](App.tsx) | Screen composition, tabs, state, persistence wiring (insets via `react-native-safe-area-context`) |
| [src/bp.ts](src/bp.ts) | Banding, averages, date-range filtering, formatting |
| [src/storage.ts](src/storage.ts) | AsyncStorage read/write, tolerant of corrupt data |
| [src/notifications.ts](src/notifications.ts) | Permission handling and the daily schedule |
| [src/components/TrendChart.tsx](src/components/TrendChart.tsx) | `react-native-svg` line chart with a touch readout |
| [src/components/ReadingForm.tsx](src/components/ReadingForm.tsx) | Entry form and validation |
| [src/components/ReadingList.tsx](src/components/ReadingList.tsx) | History rows and delete confirmation |
| [src/components/ReminderCard.tsx](src/components/ReminderCard.tsx) | Reminder switch and time picker |

Systolic and diastolic share one mmHg axis; heart rate is a separate chart rather
than a second y-axis on the same one.

## Tests

```bash
npm test
```

89 tests across nine suites (`jest-expo` + React Native Testing Library):

- `bp.test.ts` — band boundaries (119/79 vs 120/79 vs 130/80 …), averages with
  missing pulses, date-window filtering, ordering, date formatting
- `storage.test.ts` — round-trips and recovery from corrupt or partial storage
- `notifications.test.ts` — the daily trigger, the Android channel, cancelling the
  previous reminder, refused permission, and not touching other apps'
  notifications
- `notifications.expo-go.test.ts` — the guard: reminders report as unsupported in
  Expo Go on Android and the native module is never imported (the test makes
  importing it throw), while iOS Expo Go and dev builds stay supported
- `ReadingForm.test.tsx` — validation (ranges, reversed numbers, non-digits),
  optional pulse and note, field reset
- `ReadingList.test.tsx` — rendering, bands, delete confirmation both ways
- `TrendChart.test.tsx` — empty states, one line per series, legend rules, touch
  readout including missing values
- `App.test.tsx` — end to end: log → persist → reload → chart → delete, and the
  reminder being scheduled, re-armed on launch, and cancelled
- `App.expo-go.test.tsx` — the app still opens where reminders are unsupported,
  and explains why instead of promising a reminder

Type checking:

```bash
npm run typecheck
```
