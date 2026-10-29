# Journaling App

Log your day in a few taps: mood, habits, weight, hours, a highlight, climbing and side quests. See how it adds up over time. Data is stored in Google Sheets; deploy to Vercel.

## Tech
- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind CSS v4 via `@tailwindcss/postcss`
- Recharts for charts
- Google Sheets via `googleapis`

## Setup
1. Google Cloud: create a service account with the Google Sheets API on, and make a JSON key.
2. Google Cloud: create an OAuth client (web) for sign-in. Redirect URI: `http://localhost:3000/api/auth/callback/google` (and your Vercel URL).
3. Copy `.env.example` to `.env.local` and fill in:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `NEXT_PUBLIC_SERVICE_ACCOUNT_EMAIL`: the service account's email (the second is shown on the setup page)
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: the key's `private_key` (use `\n` for newlines)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: the OAuth client
   - `AUTH_SECRET`: any long random string (sign-in cookies)
   - `ALLOWED_EMAILS`: who may sign in, comma separated. Empty means nobody.
4. `npm install`, then `npm run dev` and open http://localhost:3000
5. Sign in, make an empty Google Sheet, share it with the service account email as Editor, and paste its link on the setup page. The app creates every tab it needs.

## Evening reminder (optional)
A push at 17:00 UTC (`vercel.json` cron) when today still has items to fill.
1. Make a key pair: `npx web-push generate-vapid-keys`
2. Add to `.env.local` and to Vercel:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: the public key
   - `VAPID_PRIVATE_KEY`: the private key (never share it)
   - `VAPID_SUBJECT`: `mailto:` plus your email
   - `CRON_SECRET`: any long random string (Vercel sends it to the cron)
   - `REMINDER_SHEET_IDS`: the sheet ids to remind, comma separated
3. Restart `npm run dev`, then Settings → Reminder → turn it on.

## API
- `GET /api/activities` — list activities
- `POST /api/activities` — create `{ name }`
- `PATCH /api/activities/:id` — update `{ name }`
- `DELETE /api/activities/:id` — delete
- `GET /api/logs?date=YYYY-MM-DD` — list logs for date
- `POST /api/logs` — upsert `{ date, activityId, completed }`
- `POST /api/highlights` — upsert `{ date, text }`
- `GET /api/metrics` — weekly completion rate

## Deploy to Vercel
- Add the same env vars in the Vercel project settings (plus the reminder ones if you use it).
- Set the framework to Next.js; default build command is fine.

## Notes
- This design avoids 365+ columns by storing events row-wise.
- Each sheet belongs to the account that connected it first (`ownerEmail` in the Settings tab).
