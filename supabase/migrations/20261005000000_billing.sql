-- Cobro del agente Pro (M9). Se paga en USDC con el mismo 402 de Peaje
-- (GET /_billing/:slug/:plan) o con el saldo que el negocio ya cobró.
--
-- Planes: 'free' (kit, rutas con precio, visitas, monitor diario y sus
-- tareas de arreglo), 'founder' (US$19/mes, solo los primeros 50 negocios
-- que se suscriben) y 'pro' (US$29/mes). El plan pago vale hasta plan_until;
-- vencido, el negocio vuelve a free sin tocar la fila.
--
-- Prueba: 14 días de Pro para todos. Los negocios que ya existían arrancan
-- la prueba hoy, así nadie (tampoco los negocios demo) pierde acceso de golpe.

alter table tenants drop constraint if exists tenants_plan_check;
alter table tenants add constraint tenants_plan_check check (plan in ('free', 'founder', 'pro'));

alter table tenants add column if not exists plan_until timestamptz;
alter table tenants add column if not exists trial_until timestamptz default (now() + interval '14 days');
update tenants set trial_until = now() + interval '14 days' where trial_until is null;

create table if not exists billing_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  plan text not null check (plan in ('founder', 'pro')),
  amount_usd numeric(18, 6) not null,
  -- 'x402': pagó el 402 de /_billing (cualquier cliente x402 o MPP).
  -- 'balance': se descontó del saldo cobrado del negocio.
  method text not null check (method in ('x402', 'balance')),
  -- Referencia del receipt (tx o id de Circle) o id del débito al saldo.
  reference text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists billing_payments_tenant_idx on billing_payments (tenant_id, created_at desc);
-- Un receipt no extiende el plan dos veces aunque el cliente lo reenvíe.
create unique index if not exists billing_payments_reference_idx on billing_payments (method, reference);

-- Como el resto: RLS prendido sin políticas, todo pasa por service role.
alter table billing_payments enable row level security;
