-- Reportes programados: el dueño elige cada cuánto le llega algo al chat.
-- Hoy Telegram (target = chat id); después Slack (target = id del canal).
--   agent_visits: el resumen de visitas de agentes del período.
--   custom: un pedido en sus palabras ("cada lunes: qué se movió y qué hago")
--           que corre el agente y manda su respuesta al mismo chat.
-- Lo manda el cron horario de Railway contra POST /internal/monitor/schedules
-- (ver docs/monitor.md). next_run_at lo calcula el gateway con la zona IANA.

create table if not exists report_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel text not null check (channel in ('telegram', 'slack')),
  target text not null,
  kind text not null default 'agent_visits' check (kind in ('agent_visits', 'custom')),
  -- Solo custom: lo que se le pide al agente en cada corrida.
  prompt text,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  hour int not null check (hour between 0 and 23),
  -- weekly: 0 domingo … 6 sábado.
  weekday int check (weekday between 0 and 6),
  -- monthly: 1-28, para que exista en todos los meses.
  day_of_month int check (day_of_month between 1 and 28),
  timezone text not null default 'America/Bogota',
  active boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_schedules_weekday_ck check (frequency <> 'weekly' or weekday is not null),
  constraint report_schedules_day_ck check (frequency <> 'monthly' or day_of_month is not null),
  constraint report_schedules_prompt_ck check ((kind = 'custom') = (prompt is not null))
);

-- Un resumen de visitas por (negocio, canal, destino). Los custom pueden ser
-- varios por chat (cada pedido es su propia fila), por eso el único es parcial.
create unique index if not exists report_schedules_visits_uq
  on report_schedules (tenant_id, channel, target, kind)
  where kind = 'agent_visits';

-- El cron busca los vencidos.
create index if not exists report_schedules_due_idx on report_schedules (active, next_run_at);
create index if not exists report_schedules_tenant_idx on report_schedules (tenant_id);

-- Igual que el resto del esquema: RLS prendido sin políticas, todo entra por
-- service role desde el gateway y el dashboard.
alter table report_schedules enable row level security;
