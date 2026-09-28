-- Monitoreo del kit: una fila por corrida del verificador sobre el dominio del
-- negocio (los 7 chequeos de @peaje/shared), más el score de Ora y el hash de
-- robots.txt y llms.txt para detectar cambios entre corridas. La corre el cron
-- diario del gateway (POST /internal/monitor/run) y la lee el reporte semanal.
--
-- Se guarda para TODOS los tenants; solo los del plan pro reciben alertas.

create table if not exists verificaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_at timestamptz not null default now(),
  -- Los Chequeo[] del verificador tal cual: id, ok, motivo, faltantes, total.
  checks jsonb not null,
  ok boolean not null,
  -- Score de agent-readiness (Ora) al momento de la corrida. Null si Ora no respondió.
  score integer,
  -- sha256 del cuerpo. Null si el archivo no respondió 200.
  robots_hash text,
  llms_hash text,
  -- Eventos ya avisados por correo en esta corrida: ["fallo_nuevo:proxy", "cambio_robots"].
  alerted jsonb not null default '[]'::jsonb,
  -- Chequeos que pasaron a fallar en esta corrida y esperan confirmación
  -- (segunda medición) antes de avisar. Evita alertar por un blip de red.
  pending jsonb not null default '[]'::jsonb
);

create index if not exists verificaciones_tenant_idx on verificaciones (tenant_id, run_at desc);

-- Como el resto: RLS prendido sin políticas, todo pasa por service role.
alter table verificaciones enable row level security;

-- Plan del negocio. 'free' recibe el monitoreo en el dashboard; 'pro' además
-- recibe alertas y el reporte semanal por correo. El cobro de Pro viene aparte.
alter table tenants add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro'));
