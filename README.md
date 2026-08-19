# health-app

Personal Health App - written in React Native (AI assisted)

A small React Native (Expo) app for logging health readings on your own phone:
blood pressure (systolic, diastolic and heart rate) and weight in either stones
and pounds or kilograms, charts of how they are trending, and reminders to take
them.

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

There are two independent reminders — blood pressure daily, and a weekly weigh-in
with its own day and time. Each is tagged so that switching one off leaves the
other scheduled.

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

A `Blood pressure | Weight` switcher at the top of the Log and Trends tabs picks
which metric you are looking at.

| Tab | What it does |
| --- | --- |
| **Log** | Enter a reading or a weight, and see the latest one — blood pressure banded (Normal / Elevated / High…) with a running average, weight with its change over the period |
| **Trends** | Charts over 7 / 30 / all days — blood pressure and heart rate, or weight — plus the full history (long press a row to delete) |
| **Settings** | Weight units, the daily blood pressure reminder, the weekly weigh-in reminder, and measurement tips |

Everything is stored with `AsyncStorage` on the device only — nothing is uploaded
anywhere and there is no account.

### Weight units

Weights are stored as **whole grams**, whatever they were entered in. The unit
preference only decides how a weight is *rendered*, so switching between st/lb
and kg re-expresses your history rather than rewriting it, and repeated switches
cannot drift. Stones-and-pounds entry uses two fields and rejects 14 or more
pounds; a change is reported in the smaller unit (`-3.0 lb`, `-1.4 kg`) because
"0 st 3.0 lb" reads badly.

### Code map

| File | Responsibility |
| --- | --- |
| [App.tsx](App.tsx) | Screen composition, tabs, metric switcher, state, persistence wiring (insets via `react-native-safe-area-context`) |
| [src/bp.ts](src/bp.ts) | Banding, averages, date-range filtering, formatting — the date helpers are generic over anything timestamped, so weights reuse them |
| [src/weight.ts](src/weight.ts) | Gram/kg/stone conversion, formatting, averages and change |
| [src/storage.ts](src/storage.ts) | AsyncStorage read/write, tolerant of corrupt data |
| [src/notifications.ts](src/notifications.ts) | Permission handling and the per-kind daily/weekly schedules |
| [src/components/TrendChart.tsx](src/components/TrendChart.tsx) | `react-native-svg` line chart with a touch readout, an adaptive axis step and a pluggable value format |
| [src/components/NumberField.tsx](src/components/NumberField.tsx) | The numeric input shared by both entry forms |
| [src/components/ReadingForm.tsx](src/components/ReadingForm.tsx) | Blood pressure entry and validation |
| [src/components/WeightForm.tsx](src/components/WeightForm.tsx) | Weight entry in either unit, with a cross-unit preview |
| [src/components/ReadingList.tsx](src/components/ReadingList.tsx) | Reading history rows and delete confirmation |
| [src/components/WeightList.tsx](src/components/WeightList.tsx) | Weight history rows with per-entry change |
| [src/components/ReminderCard.tsx](src/components/ReminderCard.tsx) | One reminder — switch, day picker for weekly, time picker |
| [src/components/UnitChips.tsx](src/components/UnitChips.tsx) | The st/lb ↔ kg toggle |

Systolic and diastolic share one mmHg axis; heart rate and weight each get their
own chart rather than a second y-axis on a shared one. The chart picks its tick
step from the spread of the data, so a 12.6–13.2 stone range gets 0.2-stone ticks
while blood pressure keeps its familiar 10 mmHg ticks.

## Tests

```bash
npm test
```

196 tests across thirteen suites (`jest-expo` + React Native Testing Library):

- `bp.test.ts` — band boundaries (119/79 vs 120/79 vs 130/80 …), averages with
  missing pulses, date-window filtering, ordering, date formatting
- `weight.test.ts` — conversion round-trips, the stones rounding carry (13 st
  13.97 lb must read 14 st 0.0 lb, never 13 st 14.0 lb, and no pound figure may
  reach 14 across a whole stone of grams), formatting in both units, change and
  average
- `storage.test.ts` — round-trips and recovery from corrupt or partial storage
- `notifications.test.ts` — the daily and weekly triggers, the Android channel,
  cancelling the previous reminder, refused permission, not touching other apps'
  notifications, and the two reminders coexisting so that cancelling one leaves
  the other
- `notifications.expo-go.test.ts` — the guard: reminders report as unsupported in
  Expo Go on Android and the native module is never imported (the test makes
  importing it throw), while iOS Expo Go and dev builds stay supported
- `ReadingForm.test.tsx` — validation (ranges, reversed numbers, non-digits),
  optional pulse and note, field reset
- `ReadingList.test.tsx` — rendering, bands, delete confirmation both ways
- `TrendChart.test.tsx` — empty states, one line per series, legend rules, touch
  readout including missing values, the adaptive axis step (0.2 for stones, still
  10 for mmHg), and compact-on-plot vs full-in-readout formatting
- `WeightForm.test.tsx` — validation per unit, pounds ≥ 14 rejected, decimals,
  switching units carrying the typed value across, payload in grams
- `WeightList.test.tsx` — formatting per unit, per-entry change, delete both ways
- `App.test.tsx` — end to end: log → persist → reload → chart → delete, and the
  reminder being scheduled, re-armed on launch, and cancelled
- `AppWeight.test.tsx` — the weight half end to end: switch metric, log, persist
  in grams, chart, summarise, delete, and switching units re-expressing stored
  weights without rewriting them
- `App.expo-go.test.tsx` — the app still opens where reminders are unsupported,
  and explains why instead of promising a reminder

Type checking:

```bash
npm run typecheck
```
