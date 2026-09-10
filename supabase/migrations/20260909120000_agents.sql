-- Agentes compradores: el lado demanda de Peaje. Un tenant crea agentes con
-- wallet propia y presupuesto; el agente descubre servicios (ERC-8004 vía The
-- Graph + directorio de Peaje), decide, paga el 402 y devuelve el resultado.
--
-- La wallet propia por agente NO es un detalle: el presupuesto deja de ser un
-- número en la DB y pasa a ser el saldo real de una address. Es el techo duro.

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  -- Objetivo en lenguaje natural ("datos de clima de la región andina").
  mission text not null,
  -- Wallet de Privy del agente. Guardamos el id además de la address: sin el
  -- id no se puede firmar (la lección del payout_wallet del tenant).
  wallet_address text not null,
  privy_wallet_id text,
  -- Red en la que paga ('tempo' | 'arc').
  network text not null default 'arc',
  -- Tope blando por corrida. El techo duro es el saldo de la wallet.
  max_per_run numeric(18, 6) not null default 0.10,
  frequency text not null default 'once'
    check (frequency in ('once', 'hourly', 'daily', 'biweekly', 'monthly')),
  status text not null default 'idle'
    check (status in ('idle', 'running', 'paused', 'done')),
  -- Corridas máximas (null = sin límite; se detiene al quedarse sin saldo).
  runs_max integer,
  runs_count integer not null default 0,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

-- Bitácora de cada corrida: qué evaluó, qué eligió, por qué, cuánto pagó.
-- Es el log de gasto del dashboard y la evidencia de que la decisión usó
-- datos live (no un dataset estático).
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  status text not null check (status in ('success', 'failed', 'skipped')),
  -- Candidatos evaluados + elegido + score. Lo consume la UI y el video.
  decision jsonb,
  target_url text,
  amount numeric(18, 6),
  network text,
  receipt_ref text,
  result_excerpt text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists agents_tenant_idx on agents (tenant_id, created_at desc);
-- El scheduler barre por esta: agentes activos con corrida vencida.
create index if not exists agents_due_idx on agents (next_run_at)
  where status in ('idle', 'running');
create index if not exists agent_runs_agent_idx on agent_runs (agent_id, created_at desc);

alter table agents enable row level security;
alter table agent_runs enable row level security;
