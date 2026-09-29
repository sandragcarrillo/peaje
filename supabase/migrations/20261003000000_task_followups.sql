-- Ciclo cerrado del agente Pro: cuando una tarea queda verificada en el sitio
-- en vivo, Peaje vuelve a medir a las 2 y a las 6 semanas y dice si movió algo.
--
-- `before` es la foto al verificarla (citación de la pregunta por motor,
-- visitas de bots de respuesta en 7 días, estado del chequeo). `after` es la
-- misma foto al vencer. `verdict` es la conclusión en palabras simples.
-- Uno por tarea y tipo: agendar dos veces no duplica.

create table if not exists task_followups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  task_id uuid not null references agent_tasks(id) on delete cascade,
  due_at timestamptz not null,
  kind text not null check (kind in ('2w', '6w')),
  done_at timestamptz,
  before jsonb not null default '{}'::jsonb,
  after jsonb,
  verdict text,
  created_at timestamptz not null default now(),
  unique (task_id, kind)
);

create index if not exists task_followups_due_idx on task_followups (due_at) where done_at is null;
create index if not exists task_followups_tenant_idx on task_followups (tenant_id, due_at desc);

alter table task_followups enable row level security;
