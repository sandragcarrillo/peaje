-- El plan del agente Pro: uno por negocio, armado a partir de lo que el dueño
-- quiere (objetivo), lo que puede hacer (alcance) y cada cuánto quiere saber
-- (cadencia). Los pasos traen una métrica que Peaje ya mide y una meta; el
-- avance se calcula al leerlo, no se guarda.
create table if not exists agent_plans (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  goal text not null check (goal in ('recommendations', 'agent-sales', 'both')),
  goal_detail text not null default '',
  capacity text[] not null default '{}',
  cadence text not null default 'weekly' check (cadence in ('daily', 'weekly', 'biweekly', 'on-demand')),
  language text not null default 'en',
  summary text not null default '',
  -- [{ title, why, deliverable, metric, target }]
  steps jsonb not null default '[]'::jsonb,
  -- Valor de cada métrica cuando se armó el plan: el "antes".
  baseline jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table agent_plans enable row level security;
