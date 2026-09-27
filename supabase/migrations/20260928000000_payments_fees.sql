-- Desglose del pago en el ledger. `amount` sigue siendo lo que recibe el
-- negocio (precio menos el 2%). `platform_fee` es el 2% y `network_fee` el
-- costo de red que pagó el agente encima del precio (solo en redes con
-- PeajeSettlement; 0 en las demás).
alter table payments add column if not exists platform_fee numeric not null default 0;
alter table payments add column if not exists network_fee numeric not null default 0;
