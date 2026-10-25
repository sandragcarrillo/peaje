-- Suscripción Pro con tarjeta por Paddle Billing (Paddle es el Merchant of
-- Record). El cobro en USDC (x402 y saldo) queda detrás de
-- BILLING_CRYPTO_ENABLED en el gateway, apagado por defecto.
--
-- El webhook (POST https://api.usepeaje.com/paddle/webhook) guarda en el
-- negocio el cliente y la suscripción de Paddle, y cada cobro completado en
-- billing_payments con method 'paddle' y la transacción (txn_...) como
-- referencia. plan_until pasa a ser el fin del período que Paddle cobró.

-- ---- negocio ----
alter table tenants add column if not exists paddle_customer_id text;
alter table tenants add column if not exists paddle_subscription_id text;
-- active, past_due, paused, canceled, trialing (lo que manda Paddle).
alter table tenants add column if not exists paddle_status text;
-- El dueño canceló: conserva Pro hasta esta fecha y no se renueva.
alter table tenants add column if not exists paddle_cancel_at timestamptz;

create unique index if not exists tenants_paddle_subscription_idx on tenants (paddle_subscription_id) where paddle_subscription_id is not null;
-- Un mismo dueño (mismo correo, mismo cliente de Paddle) puede tener varios negocios: no es único.
create index if not exists tenants_paddle_customer_idx on tenants (paddle_customer_id) where paddle_customer_id is not null;

-- ---- ledger de cobros ----
alter table billing_payments drop constraint if exists billing_payments_method_check;
alter table billing_payments add constraint billing_payments_method_check check (method in ('x402', 'balance', 'paddle'));
-- Suscripción de Paddle (sub_...) del cobro: con ella se sabe cuál fue el primer pago.
alter table billing_payments add column if not exists subscription_ref text;
-- Reembolso completo aprobado por Paddle.
alter table billing_payments add column if not exists refunded_at timestamptz;

create index if not exists billing_payments_subscription_idx on billing_payments (subscription_ref) where subscription_ref is not null;

-- ---- idempotencia del webhook ----
-- Paddle reintenta con el mismo event_id hasta recibir un 2xx.
create table if not exists paddle_events (
  event_id text primary key,
  event_type text not null,
  occurred_at timestamptz,
  processed_at timestamptz not null default now()
);

-- Como el resto: RLS prendido sin políticas, todo pasa por service role.
alter table paddle_events enable row level security;
