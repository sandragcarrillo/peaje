-- Seguridad de la plata (revisión del 30 sep 2026).
--
-- 1. La wallet que Peaje custodia para cada negocio queda fija al crearlo.
--    Antes Peaje firmaba con "la wallet de Privy cuya address es la de cobro",
--    y la de cobro la edita el dueño: poniendo la address de otro negocio se
--    podía firmar con la wallet ajena. Ahora se firma solo con custodial_wallet_id.
alter table tenants add column if not exists custodial_wallet text;
alter table tenants add column if not exists custodial_wallet_id text;
create unique index if not exists tenants_custodial_wallet_id_key
  on tenants (custodial_wallet_id) where custodial_wallet_id is not null;

-- 2. Retiro atómico. Leer el disponible y después insertar el retiro eran dos
--    pasos: N pedidos simultáneos veían el mismo saldo y la treasury pagaba N
--    veces. Esta función bloquea la fila del negocio, relee el disponible de
--    esa red e inserta solo si alcanza, todo en una transacción.
create or replace function crear_retiro(p_tenant uuid, p_amount numeric, p_to text, p_network text)
returns setof withdrawals
language plpgsql
as $$
declare
  disponible numeric;
begin
  perform 1 from tenants where id = p_tenant for update;
  if not found then
    raise exception 'tenant-no-encontrado';
  end if;
  select available into disponible
    from tenant_network_balances
    where tenant_id = p_tenant and network = p_network;
  if coalesce(disponible, 0) + 0.000000001 < p_amount then
    raise exception 'saldo-insuficiente';
  end if;
  return query
    insert into withdrawals (tenant_id, amount, to_wallet, network)
    values (p_tenant, p_amount, p_to, p_network)
    returning *;
end;
$$;

revoke all on function crear_retiro(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function crear_retiro(uuid, numeric, text, text) to service_role;
