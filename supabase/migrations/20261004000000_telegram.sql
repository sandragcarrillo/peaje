-- Telegram: el mismo agente del dashboard, en el chat del dueño. Un chat de
-- Telegram queda ligado a un negocio con un código de un solo uso que se
-- genera en el dashboard (Mi agente → Conectar Telegram).
create table if not exists telegram_links (
  chat_id bigint primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  username text,
  language text not null default 'en',
  linked_at timestamptz not null default now()
);
create index if not exists telegram_links_tenant_idx on telegram_links (tenant_id);

create table if not exists telegram_codes (
  code text primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  expires_at timestamptz not null
);

alter table telegram_links enable row level security;
alter table telegram_codes enable row level security;
