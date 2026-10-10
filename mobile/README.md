# EventEase for Android

The EventEase app for Android phones — the same accounts, events, tickets and
check-in gate as the website, built with **Expo SDK 57** (React Native 0.86).

| Attendees                                    | Hosts                                                         |
| -------------------------------------------- | ------------------------------------------------------------- |
| Browse and search events, register in a tap  | Dashboard of every event with live totals                     |
| QR tickets that work offline at the gate     | **Camera check-in gate** with haptic verdicts                 |
| Profile: photo, skills, links, call language | Create and edit events (prizes, fee, cover, reminders)        |
|                                              | Live event dashboard, participant search, CSV export          |
|                                              | **Aanaya call console**: call, schedule, hear the voice preview |

One sign-in screen serves both: the app opens the right portal for each account.

## How it talks to the backend

The app calls the same REST API as the website (`/api/*` on Vercel). It signs in
with Supabase directly and sends the access token as `Authorization: Bearer …`;
the API accepts that alongside the website's cookies. Three endpoints exist for
the app — `POST /api/auth/signup`, `GET /api/me/tickets`, `GET /api/host/overview`
— everything else is shared.

## Setup

```bash
cd mobile
cp .env.example .env     # Supabase URL + publishable key (public values)
npm install
```

`EXPO_PUBLIC_API_URL` (optional) points the app at another server, e.g. your
laptop through ngrok (`npm run dev:calls` in the repo root prints the URL).

## Build the APK on your machine

Needs a JDK 17 and the Android SDK (Android Studio installs both).

```bash
npm run build:apk        # → dist/EventEase.apk
adb install -r dist/EventEase.apk
```

The script finds the JDK and SDK itself, regenerates `android/` from `app.json`
(`expo prebuild --clean` — never edit that folder by hand), and builds a release APK for
phones (arm64, armv7) and the emulator (x86_64). Set `ABIS=arm64-v8a` for a
smaller phones-only build.

The APK is signed with the debug key, which is fine for installing directly.
To publish on Google Play, create an upload key and build an AAB with
`npx eas-cli@latest build -p android` (or configure `signingConfigs` in a config plugin).

## Develop

```bash
npx expo run:android     # dev build on a device or emulator, with fast refresh
npm run typecheck
```

## Project layout

```
src/app/            screens (Expo Router)
  welcome, signin, signup
  (attendee)/       events · tickets · me
  (host)/           dashboard · gate · create · account
  event/[id]        event details + registration
  ticket/[code]     full-screen QR ticket
  manage/[id]/      event dashboard · edit · calls
src/components/     UI kit, event cards, event form, profile
src/lib/            API client, auth, Supabase, formatting, theme
scripts/build-apk.mjs
```
