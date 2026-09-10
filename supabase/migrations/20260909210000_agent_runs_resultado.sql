-- El resultado completo vive en Peaje: el panel es el destino principal, no un
-- resumen. El correo y el webhook son avisos encima de esto.
-- `result_excerpt` se mantiene como preview para los listados.

alter table agent_runs add column if not exists result text;
