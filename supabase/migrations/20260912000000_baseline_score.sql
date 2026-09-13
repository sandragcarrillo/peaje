-- El score con el que el negocio LLEGÓ a Peaje. Se escribe una sola vez
-- (el primer scan que vemos) y nunca se pisa: es el "antes" de la historia
-- "tu sitio pasó de X a Y con Peaje".
alter table tenants add column if not exists baseline_score integer;
alter table tenants add column if not exists baseline_score_at timestamptz;

-- Backfill del tenant que ya integró: su primer scan registrado dio 40/D
-- (2026-09-10, antes del proxy y los fixes del kit).
update tenants
set baseline_score = 40, baseline_score_at = '2026-09-10T23:36:00Z'
where slug = 'sandra-portafolio' and baseline_score is null;
