-- Refund automático: si el origin del negocio no responde a un request ya
-- pagado, el gateway devuelve el pago al agente desde la treasury de esa red.
-- El pago refundeado no cuenta para el balance del tenant.

alter table payments add column if not exists refund_tx text;

create or replace view tenant_network_balances as
select
  t.id as tenant_id,
  n.network,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id and p.network = n.network and p.refund_tx is null), 0) as revenue,
  coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.network = n.network and w.status in ('pending', 'confirmed')), 0) as withdrawn,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id and p.network = n.network and p.refund_tx is null), 0)
    - coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.network = n.network and w.status in ('pending', 'confirmed')), 0) as available,
  coalesce((select count(*) from payments p where p.tenant_id = t.id and p.network = n.network and p.refund_tx is null), 0) as request_count
from tenants t
cross join (
  select distinct network from payments
  union
  select distinct network from withdrawals
  union
  select 'tempo'
  union
  select 'arc'
) n;

create or replace view tenant_balances as
select
  t.id as tenant_id,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id and p.refund_tx is null), 0) as revenue,
  coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.status in ('pending', 'confirmed')), 0) as withdrawn,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id and p.refund_tx is null), 0)
    - coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.status in ('pending', 'confirmed')), 0) as available,
  coalesce((select count(*) from payments p where p.tenant_id = t.id and p.refund_tx is null), 0) as request_count
from tenants t;
