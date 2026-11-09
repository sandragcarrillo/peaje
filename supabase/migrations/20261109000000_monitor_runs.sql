-- El reloj del monitor (9 nov 2026). El gateway dispara solo la revisión diaria
-- y el correo semanal (antes los iba a llamar un cron de Railway que nunca se
-- creó). Cada corrida se toma insertando (job, period): si la fila ya existe,
-- otra réplica o un reinicio ya la corrió y no se repite. `period` es la fecha
-- UTC (diario) o el lunes de la semana (semanal).
create table if not exists monitor_runs (
  job text not null,
  period text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  detail jsonb,
  primary key (job, period)
);

-- Solo el service role del gateway: RLS prendido y sin políticas.
alter table monitor_runs enable row level security;
