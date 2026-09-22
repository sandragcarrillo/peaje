-- Datos de entidad del negocio para los motores de respuesta (ChatGPT,
-- Perplexity, Google AI Overviews). Alimentan el JSON-LD Organization que el
-- kit pone en la home y el NAP (nombre, dirección, teléfono) que el negocio
-- repite idéntico en Google Business Profile, Yelp, Bing Places y LinkedIn.
-- Todos opcionales: el kit no emite campos vacíos.
alter table tenants add column if not exists entity_logo_url text;
alter table tenants add column if not exists entity_phone text;
alter table tenants add column if not exists entity_address text;
alter table tenants add column if not exists entity_same_as text[] not null default '{}';
alter table tenants add column if not exists entity_description text;

-- Toggle de robots.txt: bloquear GPTBot, ClaudeBot, Google-Extended, etc.
-- Los bots de búsqueda (OAI-SearchBot, PerplexityBot, Googlebot) siguen
-- permitidos: bloquear el entrenamiento no afecta la citación.
alter table tenants add column if not exists robots_block_training boolean not null default false;
