-- Identidad on-chain de los agentes: al crearlos, Peaje los registra en el
-- IdentityRegistry de ERC-8004 (mint ERC-721 permissionless). Con eso el
-- vendedor del otro lado ve quién le compró, con nombre y reputación.

alter table agents add column if not exists erc8004_agent_id text;
alter table agents add column if not exists erc8004_chain_id integer;
alter table agents add column if not exists erc8004_tx text;

create index if not exists agents_erc8004_idx on agents (erc8004_agent_id)
  where erc8004_agent_id is not null;
