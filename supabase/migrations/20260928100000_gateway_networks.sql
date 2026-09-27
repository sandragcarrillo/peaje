-- Rieles de Circle Nanopayments (Gateway): el agente deposita USDC una vez en
-- el contrato Gateway de Circle y después cada pago es una firma sin gas que
-- Circle liquida en lote. El pago se acredita al saldo Gateway de Peaje, así
-- que el saldo del negocio en estos rieles sale del ledger (como en Tempo),
-- no de PeajeSettlement.

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
  union
  select 'robinhood'
  union
  select 'arbitrum-usdg'
  union
  select 'gateway-arbitrum'
  union
  select 'gateway-arc'
) n;
