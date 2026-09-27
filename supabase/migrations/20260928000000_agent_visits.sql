-- Visitas de agentes: cada request que entra al gateway por un tenant, pague
-- o no. Hasta acá el ledger (`payments`) solo veía a quien pagó; un negocio
-- Pro quiere saber quién lo lee, por qué rutas, y cuánto de eso se cobra.
-- Se llena en lotes desde el gateway (ver apps/gateway/src/visitas.ts): una
-- fila por request, incluidos los 402 sin pagar y los bots de búsqueda que
-- leen llms.txt, openapi.json, /developers y /mcp.

create table if not exists agent_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  at timestamptz not null default now(),
  path text not null,
  method text not null,
  user_agent text,
  -- Quién vino. Clientes de pago por credencial (MPP / x402); bots por
  -- user-agent; el resto cae en 'other'.
  agent_kind text not null default 'other'
    check (agent_kind in (
      'mpp-client', 'x402-client', 'openai-searchbot', 'perplexitybot',
      'googlebot', 'claudebot', 'gptbot', 'other'
    )),
  paid boolean not null default false,
  -- Solo cuando pagó: red, monto acreditado y el pago del ledger.
  network text,
  amount numeric(18, 6),
  payment_id uuid references payments(id) on delete set null,
  -- Status HTTP con el que salió la respuesta (402, 200, 502...).
  status int not null
);

-- El panel lee por tenant y ventana de tiempo (7 / 30 días).
create index if not exists agent_visits_tenant_at_idx on agent_visits (tenant_id, at desc);

-- Igual que el resto del esquema: RLS prendido sin políticas, todo entra por
-- service role desde el gateway y el dashboard.
alter table agent_visits enable row level security;
