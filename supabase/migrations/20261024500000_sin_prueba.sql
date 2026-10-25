-- Sin prueba gratis desde el 24 oct 2026 (decisión de San). Los sitios nuevos
-- arrancan en el plan gratis: trial_until queda null. Las pruebas que ya
-- estaban corriendo siguen hasta su fecha; no se cortan.
alter table tenants alter column trial_until set default null;
