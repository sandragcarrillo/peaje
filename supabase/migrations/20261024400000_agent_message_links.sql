-- Tarjetas con link bajo un mensaje del agente: el reporte completo
-- (oportunidades, a quién cita la IA), la tarea con el borrador o la página.
-- Cada una es { label, url, kind? } con kind 'report' | 'task' | 'page'.
alter table agent_messages add column if not exists links jsonb not null default '[]'::jsonb;
