# Monitor: daily checks and the weekly report

The gateway exposes the monitor under `/internal/monitor` (bearer `INTERNAL_API_SECRET`):

| Route | What |
|---|---|
| `POST /internal/monitor/run` | Daily run for every tenant with a public domain: the 7 kit checks, Ora score, robots.txt and llms.txt hashes, comparison with the previous run (events `new_failure:<check>`, `still_failing:<check>`, `robots_changed`, `llms_changed`). Rows in `verificaciones`. Pro tenants with an email get an alert when something that passed now fails (confirmed by a second measurement 60 s later) or when robots.txt or llms.txt changed. |
| `POST /internal/monitor/run/:slug` | Same, one tenant. |
| `POST /internal/monitor/weekly` | Weekly report to Pro tenants: status with the fix command, score and delta, payments and visits, content suggestions (Anthropic, needs `ANTHROPIC_API_KEY`). |
| `GET /internal/monitor/preview/:slug` | The weekly report as HTML. `?contenido=0` skips the LLM. |
| `POST /internal/monitor/schedules` | Scheduled reports (table `report_schedules`): sends every schedule whose `next_run_at` is due, to its chat (Telegram today, Slack when it registers), then sets `last_run_at` and the next `next_run_at` in the schedule's IANA timezone. `agent_visits` sends the agent-visits summary since the last send; `custom` runs the owner's saved request through the agent and sends its answer. Each schedule is claimed with a conditional update before sending, so two runs at once never send twice; a late run sends once, not once per missed hour. Pro only, like Telegram. `?now=<ISO>` overrides the clock for local tests. |

## Scheduling on Railway

Add two cron services from the same repo, start command and schedule (UTC):

- `pnpm --filter @peaje/gateway monitor:daily`, schedule `0 11 * * *`
- `pnpm --filter @peaje/gateway monitor:weekly`, schedule `0 12 * * 1`
- `pnpm --filter @peaje/gateway monitor:schedules`, schedule `2 * * * *` (every hour, two minutes past: owners pick a whole hour in their timezone, and the small offset keeps a run that starts a little early from missing the hour). It is the same as `POST $GATEWAY_INTERNAL_URL/internal/monitor/schedules` with `Authorization: Bearer $INTERNAL_API_SECRET`.

They call the running gateway, so they need `GATEWAY_INTERNAL_URL` (the gateway's private or public URL) and `INTERNAL_API_SECRET`. The gateway itself needs `RESEND_API_KEY`, `AGENTS_FROM_EMAIL`, `ANTHROPIC_API_KEY` and optionally `DASHBOARD_PUBLIC_URL`, `MONITOR_MODEL`, `MONITOR_RECHECK_MS`.

Only tenants with `plan = 'pro'` receive emails; every tenant gets its rows, and the kit page shows "Last check".
