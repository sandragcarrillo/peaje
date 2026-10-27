-- Radar público: foto de citación por dominio. Del sitio salen tres preguntas
-- de compra que se le hacen a los motores (ChatGPT, Perplexity, Claude,
-- Gemini); queda si el sitio sale citado o mencionado y a quién citan en su
-- lugar (POST /_internal/radar/citas en el gateway).
--
-- Cada fila es una medición:
--   status 'done'    el resultado completo en `result`; es el caché del dominio
--                    e idioma por 7 días (1 día si algún motor no contestó: partial)
--   status 'running' la medición en curso; el índice único parcial es el candado
--                    por dominio e idioma (el segundo insert falla con 23505)
--   status 'failed'  no terminó; igual cuenta para el tope del día
-- Las filas empezadas desde las 00:00 UTC son el tope global de mediciones
-- nuevas por día (RADAR_CITAS_DAILY_MAX). Sin email ni datos de la persona.
create table if not exists radar_citation_runs (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  locale text not null check (locale in ('es', 'en')),
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  result jsonb,
  partial boolean not null default false,
  error text,
  started_at timestamptz not null default now(),
  measured_at timestamptz
);

create unique index if not exists radar_citation_runs_running_idx on radar_citation_runs (domain, locale) where status = 'running';
create index if not exists radar_citation_runs_cache_idx on radar_citation_runs (domain, locale, measured_at desc) where status = 'done';
create index if not exists radar_citation_runs_started_idx on radar_citation_runs (started_at desc);

-- Solo el gateway escribe, con service role. Sin policies, como el resto.
alter table radar_citation_runs enable row level security;
