-- Migración a la app de Privy nueva (de San) y wallet del negocio a nombre
-- del dueño (no custodial). Ver docs/privy-migracion.md.
--
-- Solo agrega columnas: nada se borra. Las *_legacy guardan lo de la app
-- vieja para el barrido de fondos y para volver atrás si hace falta.

-- ---- negocio ----
-- DID del dueño en la app vieja. Lo deja el re-match por email al entrar
-- (o el script de migración). Mientras sea null el negocio no migró.
alter table tenants add column if not exists privy_user_id_legacy text;

-- Wallet de Privy cuyo dueño es el usuario (owner = su DID en la app nueva).
-- Peaje no firma con ella: solo la muestra y la usa como destino de cobro.
alter table tenants add column if not exists owner_wallet text;
alter table tenants add column if not exists owner_wallet_id text;

-- La wallet custodiada por la app vieja, para barrer sus fondos. Al migrar,
-- custodial_wallet y custodial_wallet_id quedan en null.
alter table tenants add column if not exists custodial_wallet_legacy text;
alter table tenants add column if not exists custodial_wallet_id_legacy text;

-- El re-match busca por email sin distinguir mayúsculas.
create index if not exists tenants_email_lower_idx on tenants (lower(email)) where email is not null;
create index if not exists tenants_privy_user_id_legacy_idx on tenants (privy_user_id_legacy) where privy_user_id_legacy is not null;

-- ---- agentes compradores ----
-- La wallet del agente se recrea en la app nueva (sigue siendo de la app).
-- La vieja queda acá para barrerla.
alter table agents add column if not exists wallet_address_legacy text;
alter table agents add column if not exists privy_wallet_id_legacy text;

-- La validación de "usar mi propia dirección" rechaza wallets de agentes.
create index if not exists agents_wallet_address_lower_idx on agents (lower(wallet_address));
