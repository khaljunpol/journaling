# Journaling App

Track daily activities, save a highlight for each day, and visualize consistency with weekly metrics. Data is stored in Google Sheets; deploy to Vercel.

## Tech
- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind CSS v4 via `@tailwindcss/postcss`
- Recharts for charts
- Google Sheets via `googleapis`

## Setup
1. Create a Google Service Account and grant edit access to your spreadsheet.
2. Create a spreadsheet with sheets named:
   - `Activities` with headers `id,name` on row 1.
   - `Logs` with headers `date,activityId,completed` on row 1.
   - `Highlights` with headers `date,text` on row 1.
3. Copy `.env.example` to `.env.local` and fill in:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_KEY` (use `\n` for newlines)
   - `GOOGLE_SPREADSHEET_ID`
4. Install and run:
   - `npm install`
   - `npm run dev`

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
- Add the three env vars in Vercel project settings.
- Set the framework to Next.js; default build command is fine.

## Notes
- This design avoids 365+ columns by storing events row-wise.
- Weekly metrics aggregate completion rate across all activities.
