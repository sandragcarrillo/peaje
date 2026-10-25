-- Perfil de voz del negocio, leído de su sitio: idioma, formalidad, persona,
-- largo de frase, palabras que usa y que evita, y frases de muestra citadas
-- tal cual. Los borradores de páginas lo usan para escribir como el negocio.
-- Se refresca cada 30 días como mucho; si el dueño lo edita, no se pisa.
alter table tenants add column if not exists voice_profile jsonb;
alter table tenants add column if not exists voice_profile_at timestamptz;
