# Deploy SlotCare and enable scheduled checking

This guide uses your GitHub repository, Vercel for the website/API, Supabase for the queue and cron, and a browser worker on your computer. The public website requires no ChatGPT login. The automation dashboard uses an operator key so appointment preferences are not public.

**Important:** setup creates scheduling infrastructure; a live CGHS session and a working portal adapter are still required. The CGHS adapter has not been verified against a signed-in portal. Start with one watch and confirm its result on CGHS.

## 1. Deploy the GitHub repository to Vercel

1. In Vercel, choose Add New Project and import `foujdars/cghs`.
2. Framework preset: Other. Root directory: repository root. Build command: `npm run build`. Output directory: `dist`. `vercel.json` already declares these settings and the `api/` functions.
3. Deploy once and keep the production HTTPS origin, e.g. `https://your-project.vercel.app`.
4. Open the production website. Production access must allow visitors without Vercel authentication. Preview deployments may have separate protection; use production for cron.

No paid Vercel Cron is required. Current Vercel Hobby documentation limits native cron to once per day, so this project intentionally uses **Supabase Cron** for the frequent schedule. It does not declare Vercel-native cron in `vercel.json`.

## 2. Prepare Supabase

1. Create/select a Supabase project.
2. Run all of [`supabase/schema.sql`](../supabase/schema.sql) in its SQL editor.
3. In Dashboard > Integrations / Database Extensions, enable **Cron (`pg_cron`)**, **`pg_net`**, and **Vault**. Supabase's current UI may group these under Integrations. The schedule script assumes these extensions are available.
4. Copy the project URL and the **server-only legacy service-role key** from project API settings. The implementation uses the JWT service-role key for PostgREST. Never expose it in browser code or a public frontend environment variable.

There are no anonymous access policies on the watch/job tables. The server-side key calls the database functions; public visitors cannot list appointments.

## 3. Configure protected server environment variables

Clone the repository on your computer, install Node.js 22 or later, and run:

```sh
git clone https://github.com/foujdars/cghs.git
cd cghs
npm run keys
```

The command generates three random values **on your own computer**. In Vercel Project > Settings > Environment Variables, set these for Production:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your server-only JWT service-role key |
| `ADMIN_TOKEN` | Generated admin key; used in your automation dashboard |
| `CRON_SECRET` | Generated cron key; used only by the scheduler |
| `RUNNER_TOKEN` | Generated worker key; used only by your local worker |
| `ALLOWED_ORIGINS` | Optional comma-separated frontend origins, including `https://cghs-slot-assistant.girjeshkumark-670291.chatgpt.site` if you use the existing Site dashboard |

Redeploy after saving variables. If you use the dashboard on the same Vercel origin as the API, `ALLOWED_ORIGINS` is unnecessary. Keep all keys out of commits and chat messages.

## 4. Enable Supabase Cron

In Supabase Dashboard > Vault create two secrets:

| Vault name | Secret value |
|---|---|
| `slotcare_app_url` | Your Vercel production origin, with no trailing slash |
| `slotcare_cron_secret` | The same `CRON_SECRET` configured in Vercel |

Run [`supabase/cron.sql`](../supabase/cron.sql) in the SQL editor. Its schedule is:

```cron
* * * * *
```

This calls `/api/cron` **every minute**. Each watch has its own interval (default two minutes), so every tick does not necessarily request CGHS. The duplicate-prevention index permits only one open job for a watch. Claims are leased for 90 seconds and stale claims can be retried. The worker reads slots only, so a retry cannot make a second booking.

Verify the scheduler registration:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'slotcare-enqueue-checks';
```

After a tick, inspect the cron execution records and HTTP responses:

```sql
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
order by start_time desc limit 10;

select id, status_code, error_msg, timed_out, created
from net._http_response
order by created desc limit 10;
```

A successful HTTP response means the queue tick ran. It is not evidence that CGHS was checked. The watch dashboard's `Last actual check` is the relevant result.

Stop scheduling with:

```sql
select cron.unschedule('slotcare-enqueue-checks');
```

## 5. Start the CGHS browser worker

The worker's browser runs on **your computer**, not on Vercel or Supabase. It connects outbound to the protected Vercel API. No public tunnel or inbound port is needed.

1. In the planner, prepare and download your booking plan JSON.
2. Inside your cloned repository create `.private/`, and copy that JSON into `.private/plan.json`.
3. Create a local `.env` containing only:

```dotenv
SLOTCARE_URL=https://YOUR_PRODUCTION_APP.vercel.app
RUNNER_TOKEN=YOUR_GENERATED_RUNNER_TOKEN
RUNNER_ID=my-computer
```

4. Install and start the worker:

```sh
npm install
npx playwright install chromium
npm run runner
```

On Windows, these commands work in PowerShell or Command Prompt with Node installed. Keep the terminal and computer running; disable sleep during the period when you want checks. The browser opens visibly so you can complete login and OTP **directly on CGHS**. Its dedicated session is stored in `.private/cghs-profile`, which is ignored by Git.

5. Select the intended family member. Select the plan's exact city, department, centre and doctor. Open the slot page.
6. Confirm the patient and press Enter in the terminal. The worker checks the four selected dropdowns and connects their selectors.
7. In the automation dashboard, enter your Vercel URL and `ADMIN_TOKEN`, then import the same plan. Create a watch using the same `RUNNER_ID`.

The cloud watch contains preferences only. The beneficiary ID stays in `.private/plan.json`. The worker rejects jobs whose preferences differ from that local plan, so use a separate runner ID/profile for another patient or set of preferences.

The worker checks for queued jobs every 30 seconds. Supabase Cron queues watches according to the interval you chose. If a requested date is not listed, the adapter re-fires the selected doctor dropdown's change event to request updated dates. This portal behavior is unverified and may need an adapter change or manual refresh.

## 6. Understand watch states

| State | Meaning / next step |
|---|---|
| `waiting` | Start time has not arrived, or the scheduler has not queued it yet |
| `queued` | Waiting for a running, correctly configured browser worker |
| `checking` | Worker holds a short lease and is reading CGHS |
| `unavailable` | No matching green slot was seen; schedule continues |
| `available` | A matching green slot was observed; watch stops. Open CGHS to book |
| `needs_login` | Login or verification is required; watch stops |
| `needs_setup` | Wrong/missing form controls or preferences; watch stops |
| `error` | Browser operation failed; watch stops for inspection |
| `paused` | You paused it |
| `expired` | The appointment day has ended |

To recover from login expiry, sign in in the worker browser, navigate back to the intended beneficiary's slot page, type `resume` in the terminal, and Resume the watch in the dashboard. Cron cannot supply a fresh OTP. Do not assume a slot remains available until CGHS issues the official receipt.

This cron worker reads availability only. The existing browser extension offers optional single-attempt Auto Save after you explicitly select that mode and connect its controls. You can also book manually on CGHS. The worker and extension may have separate browser profiles; sign in in the browser where you intend to book.

## 7. Running without your laptop

Vercel and Supabase host the public website, protected queue, and scheduler. They do not host this persistent browser worker. For checks while your laptop is off, run the same worker on a trusted always-on machine or VPS with a graphical browser and private remote desktop access for CGHS login. Keep the browser session private. Session expiry still requires manual login/OTP; a server does not remove that requirement. This is additional infrastructure and may incur cost; no always-on browser service has been deployed by this project.

## Validation and troubleshooting

Run `npm test` and `npm run build`. API tests use mocked network responses; they do not access your accounts. After deployment, create one watch, run one real worker check, and compare the displayed result against the CGHS page before relying on unattended checks.

- **Queued forever:** check the worker ID, running terminal, `RUNNER_TOKEN`, outbound connection, and whether setup has completed.
- **Unauthorized:** the dashboard uses `ADMIN_TOKEN`, the scheduler uses `CRON_SECRET`, and the worker uses `RUNNER_TOKEN`; they are different values.
- **Origin not allowed / CORS:** use the dashboard on your Vercel deployment or add the Site's exact origin to `ALLOWED_ORIGINS`, then redeploy.
- **Scheduler not ready:** confirm server environment values and the complete SQL schema. Service-role key belongs only on the server.
- **Needs setup:** compare exact doctor/centre spelling. The adapter requires underlying native selects and the screenshot's date/slot text. CGHS changes may require code updates.
- **Missing requested date:** the schedule can observe future date listings only if the doctor's change event reloads them. This has not been verified on CGHS.

Official references: [Vercel Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Supabase scheduled requests](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Playwright authentication/session reuse](https://playwright.dev/docs/auth).
