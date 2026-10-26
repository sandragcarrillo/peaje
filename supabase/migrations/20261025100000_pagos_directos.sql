-- Pagos directos con PeajeSettlementV3 (docs/pagos-directos.md).
--
-- Solo agrega: nada se borra. withdrawals, crear_retiro y las vistas de saldo
-- quedan como historial; el gateway ya no escribe retiros.

-- 1. A qué dirección llegó el neto de cada pago, en la misma transacción.
--    null en los pagos anteriores (custodia o v2). La muestra la vista de ingresos.
alter table payments add column if not exists payout_address text;

-- 2. Pagos adelantados (front-run): alguien mandó la autorización del agente
--    directo al token antes que el relayer. Los fondos quedan en el contrato
--    sin repartir hasta que el Safe llama settleStray con estos datos.
--    Montos en unidades base del token (6 decimales). Direcciones en minúscula.
create table if not exists settlement_strays (
  id uuid primary key default gen_random_uuid(),
  network text not null,
  contract text not null,
  token text not null,
  payer text not null,
  nonce text not null,
  value numeric not null,
  network_fee numeric not null default 0,
  merchant text not null,
  tenant_id uuid references tenants (id) on delete set null,
  path text,
  status text not null default 'pending' check (status in ('pending', 'settled')),
  settle_tx text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (contract, token, payer, nonce)
);

create index if not exists settlement_strays_pending_idx on settlement_strays (detected_at desc) where status = 'pending';

-- Solo el service role (gateway) la lee y escribe.
alter table settlement_strays enable row level security;
