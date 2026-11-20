-- Prioridad de cada tarea del agente: puntaje para ordenar la cola, impacto y
-- esfuerzo relativos, y la evidencia en palabras del dueño (es y en). Con esto
-- Peaje propone "las 3 de esta semana" en vez de una lista por fecha.
-- Nullable: las tareas de antes quedan sin prioridad y el gateway la deriva.
--
-- { "score": 65, "impact": "high", "effort": "medium",
--   "label": { "es": "...", "en": "..." }, "why": { "es": "...", "en": "..." } }

alter table agent_tasks add column if not exists priority jsonb;
