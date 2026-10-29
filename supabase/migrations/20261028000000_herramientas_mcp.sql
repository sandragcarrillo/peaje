-- Herramientas conectadas al MCP del dueño (Claude Code, Cursor, Codex…).
--
-- Cada herramienta se presenta en el `initialize` de MCP con su nombre
-- (clientInfo.name). El gateway lo guarda acá por marca, con la fecha y el
-- prefijo de la clave que usó: {"claude": {"nombre": "claude-code", "at": "…",
-- "prefijo": "peaje_live_ab12cd…"}}. Integraciones muestra en Activas solo las
-- que usaron la clave vigente; al rotarla, las viejas dejan de salir solas.
alter table tenants add column if not exists herramientas jsonb not null default '{}'::jsonb;
