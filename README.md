# SlotCare · CGHS appointment assistant

A public appointment planner, a local browser companion, and an optional Supabase Cron + Vercel scheduled checker. No ChatGPT sign-in is required.

**Deployment and cron instructions: [docs/SETUP.md](docs/SETUP.md).**

## What runs where

| Component | Purpose |
|---|---|
| `dist/` | Public planner and automation dashboard; credentials stay in page memory |
| `companion/` | Chromium extension for on-page checks and explicitly selected, single-attempt Auto Save |
| `api/` | Protected Vercel endpoints for schedules, job claims and results |
| `supabase/schema.sql` | Private tables, locked job claims, leases, duplicate prevention and result recording |
| `supabase/cron.sql` | Every-minute queue tick using `pg_cron`, `pg_net`, and Vault |
| `runner/` | Local headed Playwright worker using a CGHS browser session; reads availability only |

Cron queues work while the planner is closed. Actual CGHS checks require the worker's computer and browser to remain running with a valid session. OTP/session expiry pauses checking. The worker never clicks Save; booking can be completed through CGHS or the browser companion. A visible green slot is an observation, not a reservation.

## Status and limits

The CGHS portal was unreachable in the authoring environment. The authenticated adapter is **unverified** and must be tested on the user's real slot page. No universal booking opening time or supported CGHS availability API has been verified. The adapter supports the screenshot's underlying native dropdowns, `dd-Mmm-yyyy` date buttons, `Slot` time-button labels, and green/red styling. Missing or changed form controls produce `needs_setup`; sign-in and verification screens produce `needs_login`. It does not bypass CAPTCHA or renew OTP sessions. Patient selection is confirmed manually because the shown slot page does not display the patient ID.

The scheduler is a personal/operator deployment. It uses one server-side admin token, not public multi-user authentication. Anyone with that token can view and manage that deployment's watches. The public planner works without it. Beneficiary IDs and CGHS passwords are excluded from scheduler records. Browser session files and downloaded plans belong only in ignored `.private/` storage.

## Validation

`npm test` covers API authentication, CORS, result filtering, date/range validation, green/red availability decisions, preference matching and cron dispatch behavior, plus the original companion checks. `npm run build` verifies static output. CI runs both without external secrets. Supabase functions have not been executed against a live database and the worker has not been tested against an authenticated CGHS session.

## Companion installation

Download the companion ZIP from the planner, unzip it, open `chrome://extensions` or `edge://extensions`, enable Developer mode and Load unpacked. Import the downloaded plan in the popup. Sign in directly on CGHS and select the intended beneficiary. On the slot page, capture four native dropdowns, a visible date button, a time button and Save. Confirm the patient and arm checking. Default mode is notify only; optional Auto Save attempts one submission. Check the official CGHS receipt after Save. The extension stops after 60 minutes. To rebuild the ZIP after edits: `python3 package-companion.py`.
