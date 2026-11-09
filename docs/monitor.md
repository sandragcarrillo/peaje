# Monitor: daily checks and the weekly report

The gateway exposes the monitor under `/internal/monitor` (bearer `INTERNAL_API_SECRET`):

| Route | What |
|---|---|
| `POST /internal/monitor/run` | Daily run for every tenant with a public domain: the 7 kit checks, Ora score, robots.txt and llms.txt hashes, comparison with the previous run (events `new_failure:<check>`, `still_failing:<check>`, `robots_changed`, `llms_changed`). Rows in `verificaciones`. Pro tenants with an email get an alert when something that passed now fails (confirmed by a second measurement 60 s later) or when robots.txt or llms.txt changed. |
| `POST /internal/monitor/run/:slug` | Same, one tenant. |
| `POST /internal/monitor/weekly` | Weekly report to Pro tenants: status with the fix command, score and delta, payments and visits, content suggestions (Anthropic, needs `ANTHROPIC_API_KEY`). |
| `GET /internal/monitor/preview/:slug` | The weekly report as HTML. `?contenido=0` skips the LLM. |
| `POST /internal/monitor/schedules` | Scheduled reports (table `report_schedules`): sends every schedule whose `next_run_at` is due, to its chat (Telegram today, Slack when it registers), then sets `last_run_at` and the next `next_run_at` in the schedule's IANA timezone. `agent_visits` sends the agent-visits summary since the last send; `custom` runs the owner's saved request through the agent and sends its answer. Each schedule is claimed with a conditional update before sending, so two runs at once never send twice; a late run sends once, not once per missed hour. Pro only, like Telegram. `?now=<ISO>` overrides the clock for local tests. |

## Scheduling: the gateway's own clock

The gateway runs these itself (`src/monitor/reloj.ts`); no cron service is needed. The Railway cron services this doc used to ask for were never created, so until 9 Nov 2026 none of these had ever run on their own.

| Job | When (UTC) | Guard against running twice |
|---|---|---|
| Scheduled reports (`correrVencidos`) | every 5 minutes | each schedule is claimed with a conditional update |
| Daily run (`correrDiario`) | once a day, from 11:00 | row `(diario, YYYY-MM-DD)` in `monitor_runs` |
| Weekly report (`correrSemanal`) | once a week, from Monday 12:00 | row `(semanal, <that Monday>)` in `monitor_runs` |

A replica or a restart cannot run the daily or weekly twice in one period: whoever inserts the `monitor_runs` row first runs it. If the gateway was down at the hour, the job runs when it comes back, within the same period. A run that dies halfway stays claimed with no `finished_at` and is not retried in that period; `ok` and `detail` show how each run ended.

The clock is on when `RAILWAY_ENVIRONMENT_ID` is set (Railway injects it) and off elsewhere, so `pnpm dev` against the production database never wins a run. `MONITOR_RELOJ=off` turns it off on Railway; `MONITOR_RELOJ=on` turns it on anywhere. Needs the `monitor_runs` table (`supabase/migrations/20261109000000_monitor_runs.sql`); without it the daily and weekly are skipped and logged, the scheduled reports still go out.

The routes above and `pnpm --filter @peaje/gateway monitor:daily | monitor:weekly | monitor:schedules` stay for manual runs (they need `GATEWAY_INTERNAL_URL` and `INTERNAL_API_SECRET`). A manual `/run` or `/weekly` does not touch `monitor_runs`.

The gateway needs `RESEND_API_KEY`, `AGENTS_FROM_EMAIL`, `ANTHROPIC_API_KEY` and optionally `DASHBOARD_PUBLIC_URL`, `MONITOR_MODEL`, `MONITOR_RECHECK_MS`.

Only tenants with `plan = 'pro'` receive emails; every tenant gets its rows, and the kit page shows "Last check".
