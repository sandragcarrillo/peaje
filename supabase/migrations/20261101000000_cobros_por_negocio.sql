-- Mainnet 2b: cobros por negocio y ledger separado por red.
--
-- 1. Cada negocio decide cuándo recibe pagos de agentes en mainnet. Apagado
--    por defecto (decisión de San, 28 oct 2026): mientras está apagado, sus
--    rutas y links con precio se sirven gratis y no se mueve plata (decisión
--    del 1 nov 2026). En testnet no cambia nada: se cobra con tokens de prueba.
--
-- 2. Los pagos de testnet y de mainnet viven en la misma tabla. `testnet`
--    marca de cuál es cada uno: los existentes son todos de testnet (default
--    true) y el gateway escribe el modo explícito en cada pago nuevo. El panel
--    y el gateway leen solo los del modo en que corren.
--
-- Solo agrega: el código que corre hoy no lee nada de esto. Correr antes del
-- deploy del código del 2b.

alter table tenants add column if not exists cobros_activos boolean not null default false;
alter table tenants add column if not exists cobros_activados_at timestamptz;

alter table payments add column if not exists testnet boolean not null default true;
create index if not exists payments_tenant_testnet_created_idx on payments (tenant_id, testnet, created_at desc);

-- Saldos por negocio y por modo. Vistas nuevas en vez de cambiar
-- tenant_balances y tenant_network_balances: esas devuelven una fila por
-- negocio y el código viejo las lee con maybeSingle mientras dura el deploy.
-- Los retiros son de la custodia vieja, que solo existió en testnet.
-- security_invoker: la vista respeta los permisos de quien consulta, como
-- las tablas (RLS sin policies, solo el service role).
create or replace view tenant_balances_red with (security_invoker = true) as
select
  t.id as tenant_id,
  m.testnet,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id and p.testnet = m.testnet and p.refund_tx is null), 0) as revenue,
  case when m.testnet
    then coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.status in ('pending', 'confirmed')), 0)
    else 0
  end as withdrawn,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id and p.testnet = m.testnet and p.refund_tx is null), 0)
    - case when m.testnet
        then coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.status in ('pending', 'confirmed')), 0)
        else 0
      end as available,
  coalesce((select count(*) from payments p where p.tenant_id = t.id and p.testnet = m.testnet and p.refund_tx is null), 0) as request_count
from tenants t
cross join (values (true), (false)) as m(testnet);

create or replace view tenant_network_balances_red with (security_invoker = true) as
select
  t.id as tenant_id,
  m.testnet,
  n.network,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id and p.testnet = m.testnet and p.network = n.network and p.refund_tx is null), 0) as revenue,
  case when m.testnet
    then coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.network = n.network and w.status in ('pending', 'confirmed')), 0)
    else 0
  end as withdrawn,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id and p.testnet = m.testnet and p.network = n.network and p.refund_tx is null), 0)
    - case when m.testnet
        then coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.network = n.network and w.status in ('pending', 'confirmed')), 0)
        else 0
      end as available,
  coalesce((select count(*) from payments p where p.tenant_id = t.id and p.testnet = m.testnet and p.network = n.network and p.refund_tx is null), 0) as request_count
from tenants t
cross join (values (true), (false)) as m(testnet)
cross join (
  select distinct network from payments
  union
  select distinct network from withdrawals
  union
  select unnest(array['tempo', 'tempo-split', 'arc', 'arbitrum', 'arbitrum-usdg', 'robinhood'])
) n;
