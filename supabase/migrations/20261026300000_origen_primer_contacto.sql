-- Origen de primer contacto (first touch) de quien llega a usepeaje.com.
--
-- El proxy del dashboard deja la cookie peaje_origen en la primera navegación
-- que trae ?ref=, utm_source (con utm_medium y utm_campaign) o un referrer
-- externo, y nunca la pisa (apps/dashboard/lib/origen.ts). El radar la guarda
-- con cada lead y el alta con cada negocio; /admin/origenes cuenta leads,
-- altas y Pro por origen. Null = sin origen (entró directo, o antes de esto).
--
-- radar_leads.source ya existe y dice de qué formulario vino ('radar'): por
-- eso el origen va en otra columna, con el mismo nombre en las dos tablas.
-- El primer valor se queda: el store solo lo escribe si está en null.
alter table radar_leads add column if not exists acquisition_source text;
alter table tenants add column if not exists acquisition_source text;

-- El panel lee las altas de los últimos 7 o 30 días (radar_leads ya tiene su índice por fecha).
create index if not exists tenants_created_idx on tenants (created_at desc);
