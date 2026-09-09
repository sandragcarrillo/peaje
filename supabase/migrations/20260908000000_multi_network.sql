-- Multi-red: pagos y retiros llevan la red de settlement (tempo | arc).
-- El balance disponible pasa a calcularse por red: un retiro sale de la
-- treasury de SU red, no de un pool mezclado.

alter table payments add column if not exists network text not null default 'tempo';
alter table withdrawals add column if not exists network text not null default 'tempo';

-- El receipt_ref era único global. Con más de una red el hash es único por
-- chain, así que el índice pasa a ser compuesto.
alter table payments drop constraint if exists payments_receipt_ref_key;
create unique index if not exists payments_network_receipt_idx on payments (network, receipt_ref);

-- Balance por tenant y por red. Pendiente cuenta como comprometido, igual que antes.
create or replace view tenant_network_balances as
select
  t.id as tenant_id,
  n.network,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id and p.network = n.network), 0) as revenue,
  coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.network = n.network and w.status in ('pending', 'confirmed')), 0) as withdrawn,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id and p.network = n.network), 0)
    - coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.network = n.network and w.status in ('pending', 'confirmed')), 0) as available,
  coalesce((select count(*) from payments p where p.tenant_id = t.id and p.network = n.network), 0) as request_count
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

-- La vista agregada queda igual (la usan las métricas del dashboard);
-- se redefine solo para que quede documentado que suma todas las redes.
create or replace view tenant_balances as
select
  t.id as tenant_id,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id), 0) as revenue,
  coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.status in ('pending', 'confirmed')), 0) as withdrawn,
  coalesce((select sum(amount) from payments p where p.tenant_id = t.id), 0)
    - coalesce((select sum(amount) from withdrawals w where w.tenant_id = t.id and w.status in ('pending', 'confirmed')), 0) as available,
  coalesce((select count(*) from payments p where p.tenant_id = t.id), 0) as request_count
from tenants t;
