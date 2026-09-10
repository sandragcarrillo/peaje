-- Entrega del resultado: un agente que compra y no te avisa no sirve de nada,
-- sobre todo si corre cada 15 días o cada mes y nadie está mirando el panel.
--
--   dashboard  el resultado queda en la bitácora (default, sin dependencias)
--   webhook    POST del resultado a una URL del usuario
--   email      el resultado llega al correo (requiere proveedor configurado)

alter table agents add column if not exists delivery_kind text not null default 'dashboard'
  check (delivery_kind in ('dashboard', 'webhook', 'email'));
alter table agents add column if not exists delivery_target text;

-- Resultado completo de la corrida. `result_excerpt` sigue siendo el preview
-- que muestra la UI; esto es lo que se entrega.
alter table agent_runs add column if not exists delivered_at timestamptz;
alter table agent_runs add column if not exists delivery_error text;
