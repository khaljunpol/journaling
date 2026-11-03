# Device API

The one door for devices that are not a browser: the phone widget and the Garmin watch app. One named key per device. Devices are added and turned off in Settings → Devices.

- **Connection code:** standard base64 (not base64url) of JSON `{ "url": "https://…", "key": "<spreadsheetId>.<secret>" }`. Decode with `atob` (or a Buffer polyfill) then `JSON.parse`. `secret` is 43 base64url chars.
- **Auth:** every call sends `Authorization: Bearer <key>`. Every reply from the route carries `Cache-Control: no-store`. The proxy's own 401/403 replies do not; they carry no data.
- **`GET {url}/api/device`** → 200 `DeviceState`:
  `{ date: "YYYY-MM-DD", mood: number|null, weight: number|null, hours: number /* filled slots 0–24 */, progress: { filled, total }, habits: [{ id, name, icon: string|null, done, category: string|null }] }`. `category` is `move`, `wellbeing`, `mind`, `people`, `bad` or `other`, and `null` when none is saved. `date` is today in UTC; the device never sends a date.
- **`POST {url}/api/device`** with JSON body (`DeviceRequest`), one of:
  `{ "action": "mood", "score": 0–10 integer }` · `{ "action": "habit", "activityId": "<id>", "done": true|false }` (`done` defaults to true) · `{ "action": "highlight", "text": "≤300 chars" }` (empty clears) · `{ "action": "hours", "entries": [{ "hour": 0–23, "category": <id> }] }` (replaces those hours; an unknown category is 400) · `{ "action": "weight", "weight": 20–400 }` · `{ "action": "hours" }` (optional `"fill": "usual"`).
  → 200 with the new `DeviceState`; the hours action adds `filled: <hours written>` and, when 0, `reason: "no_template" | "all_filled"`.
- **Errors:** 401 `{ "error": "key" }` → show "Key not valid" (see below). 404 `{ "error": "habit_gone" }` → drop that habit and refresh. 400 `{ "error": "Invalid action" }`. 413 when the declared body is over 2048 bytes (before the key check) or the real body is over 1024 bytes (after it). 5xx, including 503 `{ "error": "Try again" }` → keep the tap in the queue and retry.
- **401 can be temporary.** It means a wrong, turned-off or unknown key or an owner who is no longer allowed, but also the read cap for unknown sheets, a sheet that could not be read, or a new key on another server instance (for up to 30 s). So on 401 a device keeps the key and any queued taps, shows the message, and retries on the next update.
- **`GET {url}/api/device?include=hours`** adds `categories: [{ id, name, color }]` and `slots: (category id | null)[24]` for an hours screen. `DeviceState` also has `highlight`.
- **`GET {url}/api/device?include=week`** adds `week: [{ date, filled, total }]`, Monday to Sunday. Days after today are 0 of 0.
- **`GET {url}/api/device?include=history`** adds `history: [{ date, mood, weight }]`, the last 30 days, oldest first. A day with nothing logged has `null`.
- **`GET {url}/api/device?include=insights`** adds `insights: { mood: { avg, delta }, sleep, habits: { rate, streak }, time: { name, hours } | null, lines: [{ text, tone }] }`, the same answers as the Overview page. `habits` leaves out bad habits. `lines` are short sentences, most telling first; `tone` is `good`, `bad` or `neutral`. A `null` number means nothing to show yet. The mood links use the Insights tab's rules (last 180 days, 14 paired days, 5 on each side, a gap of 0.5+): `lines` holds the top same-day link ("On days when Gym is done, mood is 1.2 higher") and the top next-day link ("The day after Gym, mood is 0.6 higher"). A lower-mood link has tone `neutral`. The weekday lines need 4+ moods on both named days.
- **`GET {url}/api/device?include=game`** adds `game: { points, level, toNext, perfectDays, today: { done, total }, topStreak: { name, days, unit } | null }`. `today` is today's usual-list habits done and the list size ("4 of 6"). `topStreak` is the best current streak of a good habit; `unit` is `days` or `weeks`. No reward animation on the widget: a habit tap returns the state as now.
- **`GET {url}/api/device?include=climb`** adds `climb: { sessions, daysSince, hardest, weeks, lines: [{ text, tone }] }`. The insights reply includes these `lines` too.
- Week days carry `state`: `onTime`, `late`, `missed` or `waiting`, left out for empty days before tracking started (a day with data before then is `onTime`). `insights.yesterdayMissed` is true when yesterday has no mood, habits, weight or hours. On Mondays the first line sums up last week.
- Every action is safe to repeat. After "Turn off" an old key can keep working for up to 30 s (per-instance sheet cache).
- Replies stay small for watches: the habit list only, no history.

## Managing keys: `/api/device/keys`

Signed-in owner only (browser session, not a device key). Every reply from the route carries `Cache-Control: no-store`. The proxy's own 401/403 replies do not; they carry no data.

- **`GET`** → `{ keys: [{ id, name, createdAt }] }`. Hashes are never returned.
- **`POST`** with `{ "name": "<1–40 chars>" }` → `{ id, name, code }`. The code is shown once; only a SHA-256 hash is stored. 400 for a bad name (`Name must be 1 to 40 characters.`), at 10 devices (`Turn off a device first.`), or a sheet id of the wrong shape (`This sheet id cannot be used for a device.`).
- **`DELETE ?id=<id>`** → 200 `{ ok: true }`. An unknown id is also 200.
