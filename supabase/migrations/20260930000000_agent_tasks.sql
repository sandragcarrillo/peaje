-- Tareas del agente Pro. El agente nunca cambia el sitio del negocio: deja
-- tareas con el prompt completo para el coding agent del dueño (Claude Code,
-- Cursor), que las lee por el MCP del dueño o con `npx @peaje/cli tasks`, las
-- aplica, y las marca hechas. Peaje verifica los criterios de aceptación.
--
-- `key` deduplica: la misma causa (un chequeo que falla, una página sugerida,
-- un path pedido) no genera dos tareas. Una tarea descartada o verificada no
-- se reabre sola.

create table if not exists agent_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  kind text not null check (kind in ('content', 'route', 'fix')),
  title text not null,
  summary text not null default '',
  -- El prompt para el coding agent, en markdown: qué hacer, dónde, con el borrador.
  body text not null,
  -- Criterios que Peaje revisa al marcarla hecha: [{ "type": "check", "id": "proxy" }, { "type": "url", "url": "...", "contains": "..." }]
  acceptance jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'verified', 'dismissed')),
  source text not null default 'agent',
  -- Resultado de la última verificación, o el motivo al descartarla.
  note text,
  done_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz,
  verified_at timestamptz,
  unique (tenant_id, key)
);

create index if not exists agent_tasks_tenant_status_idx on agent_tasks (tenant_id, status, created_at desc);

alter table agent_tasks enable row level security;
