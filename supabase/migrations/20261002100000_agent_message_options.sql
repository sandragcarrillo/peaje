-- Respuestas rápidas: opciones que el agente ofrece bajo su mensaje (el
-- onboarding del plan pregunta de a una, con botones en vez de texto libre).
alter table agent_messages add column if not exists options text[] not null default '{}';
