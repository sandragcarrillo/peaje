-- Radar público: para medir un dominio la persona deja su email. Una fila por
-- (email, dominio); si vuelve a dejarlo se actualiza (upsert). El reporte por
-- correo sale siempre que hay puntaje; marketing_consent solo cubre los tips
-- ocasionales. last_report_at evita mandar el mismo reporte dos veces seguidas.
create table if not exists radar_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  domain text not null,
  source text not null default 'radar',
  locale text not null default 'en',
  marketing_consent boolean not null default false,
  last_report_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, domain)
);
create index if not exists radar_leads_created_idx on radar_leads (created_at desc);

-- Solo el gateway escribe, con service role. Sin policies, como el resto.
alter table radar_leads enable row level security;
