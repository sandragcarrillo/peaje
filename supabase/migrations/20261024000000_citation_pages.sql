-- Páginas citadas completas por corrida: URL, título y formato. Hasta acá solo
-- se guardaba el dominio (stripe.com), y sin el título no hay cómo saber si
-- la IA citó una guía, un ranking o una investigación. De acá salen los
-- "formatos que la IA cita para tus preguntas" y el formato de cada borrador.
--
-- Cada elemento: { "url": text|null, "title": text|null, "domain": text,
--                  "format": text|null }
-- Gemini solo da un enlace intermedio de Google: llega con url null y el
-- dominio como título, y no se clasifica.

alter table citation_runs add column if not exists pages jsonb not null default '[]'::jsonb;
