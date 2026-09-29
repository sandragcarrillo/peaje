-- Comprador misterioso: un agente comprador sintético que, sin pagar, busca
-- lo que el negocio vende con misiones realistas, registra si lo encontró, en
-- qué puesto, a quién eligió en su lugar y por qué, y prueba el 402 del
-- negocio como un cliente estricto. Una fila por corrida.
create table if not exists mystery_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_at timestamptz not null default now(),
  -- [{ mission, found, rank, chosen, instead, reason, verdict }]
  missions jsonb not null default '[]'::jsonb,
  -- Resultado de la prueba del 402 en el dominio del negocio y en el gateway.
  probe jsonb,
  -- Problemas técnicos del 402, en palabras simples.
  issues text[] not null default '{}',
  summary text
);
create index if not exists mystery_runs_tenant_idx on mystery_runs (tenant_id, run_at desc);

alter table mystery_runs enable row level security;
