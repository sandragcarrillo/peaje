-- Créditos del agente Pro y primer mensaje del agente en un chat.
--
-- agent_credit_charges: cada respuesta del agente que hizo algo con costo
-- (consultar datos, crear una tarea, escribir una página o una serie, un
-- informe a pedido, el comprador misterioso) deja una fila al terminar. Una
-- devolución (un trabajo largo que falló) es una fila con créditos negativos.
-- El saldo del mes es el cupo del plan menos la suma desde el 1 a las 00:00
-- UTC. Lo lee y lo escribe solo el gateway (service role).
create table if not exists agent_credit_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  credits int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_credit_charges_tenant_idx on agent_credit_charges (tenant_id, created_at desc);

alter table agent_credit_charges enable row level security;

-- agent_intros: el primer mensaje del agente al conectar un chat (Telegram,
-- Slack) sale una sola vez por negocio y destino. La fila es la reserva: el
-- insert con la llave primaria decide quién lo manda. Desconectar el chat no
-- la borra, así reconectarlo no lo repite.
create table if not exists agent_intros (
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel text not null,
  target text not null,
  sent_at timestamptz not null default now(),
  primary key (tenant_id, channel, target)
);

alter table agent_intros enable row level security;
