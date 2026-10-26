-- Radar de Peaje por MCP (tenant "peaje"). Para correr a mano en el cutover,
-- después del deploy del gateway y del dashboard con este cambio.
--
-- Hoy (26 oct 2026, leído en producción): el sitio "peaje" no tiene rutas de
-- API y tiene un solo link, "radar" -> https://usepeaje.com/radar, a $0. En
-- https://api.usepeaje.com/peaje/mcp eso es la tool read_radar, que devuelve
-- la página del formulario y no recibe dominio: no le sirve a un agente.
--
-- Después: la tool get_api_radar_by_dominio, con el argumento `dominio`
-- (example.com). El gateway llama a https://usepeaje.com/api/radar/<dominio>
-- con la prueba de origen y devuelve el JSON tal cual: domain, score (0 a
-- 100), grade, upToWithPeaje, topFixes (los 5 arreglos que más suman, con
-- points, fixedBy y how), passing, missing, page.
--
-- Precio: $0. Una ruta a $0 es gratis en el MCP y en la URL del gateway (sin
-- 402, sin receipt) y no entra al manifiesto del proxy, así que
-- usepeaje.com/api/radar/<dominio> sigue llegando directo al handler como hoy.
-- Para cobrarla después, pon el precio desde el dashboard (Rutas del sitio
-- "peaje"); con precio, usepeaje.com necesita PEAJE_ORIGIN_SECRET en Vercel
-- para cobrar también en el dominio.
--
-- Idempotente: correrlo dos veces no duplica nada.

begin;

-- 1. La ruta. El índice único de routes es parcial (where active), por eso
--    el "where not exists" en vez de "on conflict".
insert into routes (tenant_id, method, path_pattern, price_usd, description, active)
select
  t.id,
  'GET',
  '/api/radar/:dominio',
  0,
  'Agent-readiness score for any website, measured by Ora. Pass the domain (example.com) as dominio. Returns the score from 0 to 100, the grade, how far Peaje could raise it, and the top fixes with the points each one adds. A fresh scan can take up to a minute.',
  true
from tenants t
where t.slug = 'peaje'
  and not exists (
    select 1 from routes r
    where r.tenant_id = t.id and r.method = 'GET' and r.path_pattern = '/api/radar/:dominio' and r.active
  );

-- 2. Apaga el link "radar" (la página del formulario): con la ruta, la tool
--    read_radar sobra y un agente podría elegirla. Sale también de llms.txt y
--    pricing.md del sitio, donde la ruta nueva ya aparece. Si quieres dejar la
--    página listada, borra este paso.
update resources x
set active = false
from tenants t
where t.id = x.tenant_id
  and t.slug = 'peaje'
  and x.slug = 'radar'
  and x.url = 'https://usepeaje.com/radar'
  and x.active;

-- Cómo queda: una fila de ruta activa, el link inactivo.
select 'route' as kind, r.method, r.path_pattern as path, r.price_usd, r.active
from routes r join tenants t on t.id = r.tenant_id
where t.slug = 'peaje'
union all
select 'resource', 'GET', x.slug, x.price_usd, x.active
from resources x join tenants t on t.id = x.tenant_id
where t.slug = 'peaje';

commit;

-- Para volver atrás:
--   update routes set active = false
--   where path_pattern = '/api/radar/:dominio' and tenant_id = (select id from tenants where slug = 'peaje');
--   update resources set active = true
--   where slug = 'radar' and tenant_id = (select id from tenants where slug = 'peaje');
