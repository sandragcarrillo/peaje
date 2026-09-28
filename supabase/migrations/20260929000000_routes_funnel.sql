-- Rutas con precio: se pueden editar y recrear. Visitas: el embudo del 402.
--
-- 1. El unique de routes era total: al borrar (soft delete, active=false) la
--    fila quedaba y no se podía volver a crear la misma ruta con otro precio.
--    Pasa a ser un índice único parcial sobre las activas.
-- 2. agent_visits guarda qué ruta y qué precio vio el agente, y si intentó
--    pagar (trajo una credencial de pago). Con eso sale el embudo
--    402 servido → 402 entendido → pagado, por ruta y por tipo de agente,
--    y la "demanda no atendida": rutas miradas y no pagadas, y paths pedidos
--    que no existen (404 del origen).

alter table routes drop constraint if exists routes_tenant_id_method_path_pattern_key;
create unique index if not exists routes_active_unique
  on routes (tenant_id, method, path_pattern) where active;

alter table agent_visits
  add column if not exists route_id uuid references routes(id) on delete set null,
  add column if not exists price_usd numeric(18, 6),
  add column if not exists attempted boolean not null default false;
