# Telegram, competidores, A/B y MCP: investigación (30 sep 2026)

Resumen del informe de investigación. Sin código todavía.

## Bugs y huecos actuales
- Botón de opciones (`telegram/bot.ts`, rama `o:`) resuelve contra el último mensaje del negocio, no el tocado. Poner el id del mensaje en `callback_data`.
- El bot acepta grupos: limitar a `chat.type === 'private'`.
- `setMyCommands` solo en inglés, sin `/negocios` ni `/settings`. Registrar por `language_code`.
- Resumen semanal exige `tenant.email`: dueño solo-Telegram no recibe nada. Avisos bilingües en un string; alerta manda `npx … init` a un no técnico.
- Todo pasa por Sonnet y cuenta contra el tope mensual, incluso lecturas (estado, tareas, citas).
- Telegram no muestra progreso (no pasa `alEstado`).
- Perplexity: `search_results` se cuentan como citas aunque la respuesta no los cite.
- Costo: ChatGPT con gpt-5.5 + web_search ~US$0,115 por consulta; 20 preguntas semanales ~US$14,70/mes (el doc decía 5,5). No se registra uso real.

## Prioridades (orden sugerido, un milestone a la vez)
1. Base del bot: fix de botones, solo privados, menú por idioma, avisos localizados sin email obligatorio, comandos sin LLM (`/estado`, `/plan`, `/tareas`, `/citas`, `/resultados`, `/ajustes`, `/conectar`), progreso en vivo, borradores como `.md` (sendDocument).
2. MCP: sacar de "Avanzado"; pestañas Claude Code (`--scope user`), Cursor (deeplink `cursor://anysphere.cursor-deeplink/mcp/install?name=peaje&config=<base64>`, `${env:PEAJE_AGENT_KEY}`), Codex (`--bearer-token-env-var`), Windsurf, VS Code (`${input:...}`); estado "Conectado: Cursor" leyendo `clientInfo` del `initialize`; aviso por Telegram; prompts MCP `work_tasks`; aviso de tarea lista con los dos caminos. La clave nunca por Telegram.
3. Registrar costo real por corrida; probar gpt-5.4-mini vs gpt-5.5; plan y borradores en Opus 5.5.
4. Competidores ("quién aparece en tu lugar"): guardar URLs citadas por motor, clasificar dominios (competidor, directorio, listado, UGC) con Haiku una vez; paso A gratis (URLs citadas 2+ veces donde no apareces), paso B con Sonnet ~US$0,04 por pregunta ("qué tienen que tú no" y tipo de acción: página, aparecer en listado, refrescar). Marco honesto: "en estas preguntas y estos asistentes, últimas 3 semanas". 2,5 a 3 días.
5. Experimentos A/B: prueba/control aleatorio por pregunta (10+10 en Pro, 5+5 Founder "señal débil"), 2 rondas antes y 4 después, diferencia en diferencias con permutación, alfa 0,10; gana con +10 puntos en 2 de 4 motores. Sin costo extra usando la ronda semanal; potencia 0,97 a +20 puntos. A/B de variantes de página no es viable (es cloaking y no hay volumen). 3 días.

## Fuentes principales
SparkToro (inconsistencia de listas), AirOps/Kevin Indig (estructura de páginas citadas), Peec AI y Ahrefs Brand Radar (gap por URL), docs MCP de Claude Code, Cursor, Codex, Windsurf; Telegram Bot API changelog.
