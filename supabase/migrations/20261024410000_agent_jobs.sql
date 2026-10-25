-- Trabajos largos del agente (un borrador de página, una serie de páginas).
-- El chat contesta al toque ("estoy escribiendo la página") y el gateway los
-- corre en segundo plano; al terminar avisa en el canal de `destino`
-- ({ canal, id, idioma? }: 'telegram' + chat id, 'slack' + canal, 'dashboard').
-- El worker los toma con un UPDATE condicional (status = 'queued'), así dos
-- procesos o un reinicio no corren el mismo trabajo dos veces.
create table if not exists agent_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  destino jsonb,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists agent_jobs_queue_idx on agent_jobs (status, created_at);
create index if not exists agent_jobs_tenant_idx on agent_jobs (tenant_id, created_at desc);

-- Solo el service role del gateway: RLS prendido y sin políticas.
alter table agent_jobs enable row level security;
