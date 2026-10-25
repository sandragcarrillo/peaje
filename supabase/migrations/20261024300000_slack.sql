-- Slack: el mismo agente del dashboard y de Telegram, en los canales de un
-- equipo. El dueño instala la app de Peaje en su Slack (OAuth v2) desde
-- "Mi agente" y conecta uno o más canales. Cualquiera del canal pregunta;
-- solo quien instaló aprueba cambios de precio o de rutas.

-- Una instalación por workspace. El bot token va cifrado (AES-256-GCM en el
-- gateway con SLACK_TOKEN_KEY); acá nunca queda en claro y solo lo lee el
-- service role.
create table if not exists slack_installs (
  team_id text primary key,
  team_name text,
  enterprise_id text,
  bot_token_enc text not null,
  bot_user_id text not null,
  installer_user_id text not null,
  installed_at timestamptz not null default now()
);

-- Un canal (o DM con el bot) puede tener varios negocios, con uno activo,
-- como un chat de Telegram.
create table if not exists slack_links (
  team_id text not null references slack_installs(team_id) on delete cascade,
  channel_id text not null,
  tenant_id uuid not null references tenants(id) on delete cascade,
  language text not null default 'en',
  linked_by text,
  active boolean not null default true,
  linked_at timestamptz not null default now(),
  primary key (team_id, channel_id, tenant_id)
);
create index if not exists slack_links_tenant_idx on slack_links (tenant_id);

-- Códigos de un solo uso. El dashboard lo crea; el OAuth lo ata al workspace
-- y a quien instaló; la primera mención de esa persona en un canal sin
-- conectar lo consume y conecta el canal.
create table if not exists slack_codes (
  code text primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  language text not null default 'en',
  team_id text,
  user_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists slack_codes_pending_idx on slack_codes (team_id, user_id);

-- Slack reintenta si no respondemos en 3 s: event_id único para no
-- contestar dos veces. Se limpian las filas de más de un día.
create table if not exists slack_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);
create index if not exists slack_events_created_idx on slack_events (created_at);

alter table slack_installs enable row level security;
alter table slack_links enable row level security;
alter table slack_codes enable row level security;
alter table slack_events enable row level security;
