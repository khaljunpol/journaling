# Device API

The one door for devices that are not a browser: the phone widget and the Garmin watch app. One named key per device. Devices are added and turned off in Settings → Devices.

- **Connection code:** standard base64 (not base64url) of JSON `{ "url": "https://…", "key": "<spreadsheetId>.<secret>" }`. Decode with `atob` (or a Buffer polyfill) then `JSON.parse`. `secret` is 43 base64url chars.
- **Auth:** every call sends `Authorization: Bearer <key>`. Every reply from the route carries `Cache-Control: no-store`. The proxy's own 401/403 replies do not; they carry no data.
- **`GET {url}/api/device`** → 200 `DeviceState`:
  `{ date: "YYYY-MM-DD", mood: number|null, weight: number|null, hours: number /* filled slots 0–24 */, progress: { filled, total }, habits: [{ id, name, icon: string|null, done }] }`. `date` is today in UTC; the device never sends a date.
- **`POST {url}/api/device`** with JSON body (`DeviceRequest`), one of:
  `{ "action": "mood", "score": 0–10 integer }` · `{ "action": "habit", "activityId": "<id>" }` (sets done) · `{ "action": "weight", "weight": 20–400 }` · `{ "action": "hours" }` (optional `"fill": "usual"`).
  → 200 with the new `DeviceState`; the hours action adds `filled: <hours written>` and, when 0, `reason: "no_template" | "all_filled"`.
- **Errors:** 401 `{ "error": "key" }` → show "Key not valid" (see below). 404 `{ "error": "habit_gone" }` → drop that habit and refresh. 400 `{ "error": "Invalid action" }`. 413 when the declared body is over 2048 bytes (before the key check) or the real body is over 1024 bytes (after it). 5xx, including 503 `{ "error": "Try again" }` → keep the tap in the queue and retry.
- **401 can be temporary.** It means a wrong, turned-off or unknown key or an owner who is no longer allowed, but also the read cap for unknown sheets, a sheet that could not be read, or a new key on another server instance (for up to 30 s). So on 401 a device keeps the key and any queued taps, shows the message, and retries on the next update.
- Every action is safe to repeat. After "Turn off" an old key can keep working for up to 30 s (per-instance sheet cache).
- Replies stay small for watches: the habit list only, no history.

## Managing keys: `/api/device/keys`

Signed-in owner only (browser session, not a device key). Every reply from the route carries `Cache-Control: no-store`. The proxy's own 401/403 replies do not; they carry no data.

- **`GET`** → `{ keys: [{ id, name, createdAt }] }`. Hashes are never returned.
- **`POST`** with `{ "name": "<1–40 chars>" }` → `{ id, name, code }`. The code is shown once; only a SHA-256 hash is stored. 400 for a bad name (`Name must be 1 to 40 characters.`), at 10 devices (`Turn off a device first.`), or a sheet id of the wrong shape (`This sheet id cannot be used for a device.`).
- **`DELETE ?id=<id>`** → 200 `{ ok: true }`. An unknown id is also 200.
