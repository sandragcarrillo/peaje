-- Conversación con el agente Pro de cada negocio. La comparten el chat del
-- dashboard y, después, Telegram (`channel`). `actions` guarda los cambios que
-- el agente propuso (precio, ruta, descripción): nunca se aplican solos, el
-- dueño aprieta "Aplicar".
create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  actions jsonb not null default '[]'::jsonb,
  channel text not null default 'dashboard',
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_tenant_idx on agent_messages (tenant_id, created_at desc);

alter table agent_messages enable row level security;
