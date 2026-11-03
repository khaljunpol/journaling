# Journaling App

Log your day in a few taps: mood, habits, weight, hours, a highlight, climbing and side quests. See how it adds up over time. Data is stored in Google Sheets; deploy to Vercel.

## Layout
An npm workspaces monorepo.

| Folder | What it is |
|---|---|
| `apps/web` | The Journal app: Next.js 16, React 19, Tailwind 4, Recharts |
| `apps/widget` | Android home-screen widget: Expo + react-native-android-widget |
| `packages/core` | Pure logic shared by the apps, and the device API contract ([API.md](packages/core/API.md)) |
| `packages/sheets` | Google Sheets layer: client, tab cache, locks, reads and writes |
| `packages/design` | Design tokens: colours, radii, easing. Generates the web app's CSS variables |

Run `npm run dev`, `npm test`, `npm run lint` and `npm run build` from the repo root.

## Setup
1. Google Cloud: create a service account with the Google Sheets API on, and make a JSON key.
2. Google Cloud: create an OAuth client (web) for sign-in. Redirect URI: `http://localhost:3000/api/auth/callback/google` (and your Vercel URL).
3. In `apps/web`, copy `.env.example` to `.env.local` and fill in:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `NEXT_PUBLIC_SERVICE_ACCOUNT_EMAIL`: the service account's email (the second is shown on the setup page)
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: the key's `private_key` (use `\n` for newlines)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: the OAuth client
   - `AUTH_SECRET`: any long random string (sign-in cookies)
   - `ALLOWED_EMAILS`: who may sign in, comma separated. Empty means nobody.
4. From the repo root: `npm install`, then `npm run dev`, and open http://localhost:3000
5. Sign in, make an empty Google Sheet, share it with the service account email as Editor, and paste its link on the setup page. The app creates every tab it needs.

## Evening reminder (optional)
A push at 17:00 UTC (`vercel.json` cron) when today still has items to fill.
1. Make a key pair: `npx web-push generate-vapid-keys`
2. Add to `apps/web/.env.local` and to Vercel:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: the public key
   - `VAPID_PRIVATE_KEY`: the private key (never share it)
   - `VAPID_SUBJECT`: `mailto:` plus your email
   - `CRON_SECRET`: any long random string (Vercel sends it to the cron)
   - `REMINDER_SHEET_IDS`: the sheet ids to remind, comma separated
3. Restart `npm run dev`, then Settings → Reminder → turn it on.

## Devices
The phone widget and other devices save through one key-protected door. Make a code in Settings → Devices. See [API.md](packages/core/API.md).

## Android widget
Needs Android Studio, with `ANDROID_HOME` and `JAVA_HOME` set. On Windows the C++ step hits the 260-character path limit in a deep folder, so also set `WIDGET_CXX_DIR` to a short folder such as `C:/jwcxx`.
1. In `apps/widget`: `npx expo prebuild --platform android --no-install`
2. In `apps/widget/android`: `gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a`
3. `adb install -r app/build/outputs/apk/release/app-release.apk`

## Deploy to Vercel
- Add the same env vars in the Vercel project settings (plus the reminder ones if you use it).
- Set Root Directory to `apps/web`, framework Next.js. Default build command is fine.

## Notes
- This design avoids 365+ columns by storing events row-wise.
- Each sheet belongs to the account that connected it first (`ownerEmail` in the Settings tab).
