-- Inicio de sesión (OAuth 2.1) en el MCP del dueño.
--
-- La app de Claude y ChatGPT solo agregan conectores con inicio de sesión, no
-- con una clave pegada. El gateway es el servidor de autorización (metadatos,
-- registro de clientes, tokens) y la pantalla de permiso vive en el dashboard,
-- donde el dueño ya inicia sesión con Privy y elige el negocio. La clave del
-- agente (peaje_live_…) sigue sirviendo igual.
--
-- Todo lo lee y lo escribe el gateway o el dashboard con el service role.
-- Los códigos y tokens se guardan solo como hash (sha256), igual que la clave.

-- Cada herramienta que se registra sola (registro dinámico, RFC 7591).
-- secret_hash null = cliente público: se protege con PKCE.
create table if not exists oauth_clients (
  id text primary key,
  name text not null,
  redirect_uris text[] not null,
  secret_hash text,
  created_at timestamptz not null default now()
);

alter table oauth_clients enable row level security;

-- El código de un solo uso que la pantalla de permiso le pasa a la herramienta.
-- Vence a los 5 minutos y se marca usado al canjearlo.
create table if not exists oauth_codes (
  code_hash text primary key,
  client_id text not null references oauth_clients(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  privy_user_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  resource text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table oauth_codes enable row level security;

-- Una conexión: una herramienta con acceso a un negocio. El token de acceso
-- dura 1 hora; el de refresco rota en cada uso y el anterior queda en
-- refresh_prev_hash: si alguien lo vuelve a usar, la conexión se revoca
-- (alguien copió el token). Desconectar desde Integraciones llena revoked_at.
create table if not exists oauth_grants (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references oauth_clients(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  privy_user_id text not null,
  access_hash text not null unique,
  access_expires_at timestamptz not null,
  refresh_hash text not null unique,
  refresh_prev_hash text unique,
  refresh_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists oauth_grants_tenant_idx on oauth_grants (tenant_id) where revoked_at is null;

alter table oauth_grants enable row level security;
