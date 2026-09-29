-- Medición de citación: las preguntas por las que el negocio quiere salir
-- recomendado y, por ronda, qué contestó cada motor (ChatGPT, Perplexity,
-- Gemini, Claude) y a quién citó. De acá sale la métrica citation_share del
-- plan y el "quién aparece en tu lugar".
create table if not exists citation_prompts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  text text not null,
  source text not null default 'agent' check (source in ('agent', 'owner')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists citation_prompts_tenant_idx on citation_prompts (tenant_id) where active;

create table if not exists citation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  round_id uuid not null,
  prompt_id uuid references citation_prompts(id) on delete set null,
  prompt_text text not null,
  engine text not null,
  run_at timestamptz not null default now(),
  -- El sitio del negocio aparece entre las fuentes citadas.
  cited boolean not null default false,
  -- El nombre o la marca aparece en el texto de la respuesta.
  mentioned boolean not null default false,
  -- Dominios citados, en orden (sin repetir).
  domains text[] not null default '{}',
  answer_excerpt text,
  error text
);
create index if not exists citation_runs_tenant_round_idx on citation_runs (tenant_id, run_at desc);

alter table citation_prompts enable row level security;
alter table citation_runs enable row level security;
