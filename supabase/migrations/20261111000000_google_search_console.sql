-- La cuenta de Google conectada a un negocio para leer su Search Console.
-- Una por negocio. El refresh token va cifrado por el gateway (GOOGLE_TOKEN_KEY);
-- la base nunca ve el token en claro.
create table if not exists google_connections (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  email text,
  -- La que Peaje lee: 'sc-domain:ejemplo.com' o 'https://ejemplo.com/'. null si la cuenta no tiene el sitio.
  property text,
  -- Las que ve esa cuenta: [{ siteUrl, permissionLevel }].
  properties jsonb not null default '[]'::jsonb,
  refresh_token_enc text not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  last_used_at timestamptz,
  last_error text
);

alter table google_connections enable row level security;
