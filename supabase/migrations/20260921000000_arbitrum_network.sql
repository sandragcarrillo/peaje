-- Arbitrum Sepolia como tercera red de settlement. En esta red el saldo del
-- negocio vive en el contrato PeajeSettlement, pero el ledger lo refleja igual
-- que en Tempo y Arc para que el panel y los retiros funcionen por red.

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
  union
  select 'arbitrum'
) n;
