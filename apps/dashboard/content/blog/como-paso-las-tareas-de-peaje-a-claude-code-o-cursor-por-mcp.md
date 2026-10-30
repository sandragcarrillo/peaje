---
title: "¿Cómo paso las tareas de Peaje a Claude Code o Cursor por MCP?"
description: Cómo conectar tu herramienta de IA a Peaje por MCP, qué le pides después y cómo Peaje revisa en tu sitio que cada tarea quedó publicada.
date: 2026-10-29
slug: como-paso-las-tareas-de-peaje-a-claude-code-o-cursor-por-mcp
lang: es
categoria: Guía
portada: 3
portada_titulo: Tareas en tu herramienta favorita
portada_logos: claude, cursor, codex, chatgpt, lovable, windsurf, copilot
traduccion: how-do-i-send-my-peaje-tasks-to-claude-code-or-cursor-through-mcp
---

# ¿Cómo paso las tareas de Peaje a Claude Code o Cursor por MCP?

Conectas tu herramienta una sola vez desde Integraciones, en tu panel de Peaje, y después le escribes "Aplica mis tareas de Peaje". Tu herramienta lee cada tarea con sus instrucciones, hace el cambio en tu proyecto y, cuando publicas, la marca como lista con la URL. Peaje revisa esa URL en tu sitio y cierra la tarea solo si el cambio está publicado.

Actualizado: octubre de 2026

Integraciones es parte del plan Pro, que cuesta US$30 al mes de precio de fundador para los primeros 50 negocios y US$69 después, con 500 créditos al mes, según la [página de precios](https://usepeaje.com/precios).

## ¿Qué es una tarea de Peaje?

Es un cambio que tu agente de Peaje te deja listo para tu sitio: arreglar un chequeo que falla, publicar una página que los asistentes citarían o crear una ruta que los agentes pidieron y no encontraron. Cada tarea trae el texto para tu herramienta de IA y los criterios que Peaje va a revisar en tu sitio. Peaje nunca toca tu sitio: propone, tu herramienta hace el cambio y tú decides cuándo publicar.

## ¿Cómo conecto mi herramienta?

En tu panel, abre "Mi agente" y entra a Integraciones. Ahí está tu clave y la línea exacta para cada herramienta, con la clave ya puesta:

- **Claude Code:** abre la terminal en la carpeta de tu sitio y corre `claude mcp add --transport http peaje https://api.usepeaje.com/_owner/mcp --header "Authorization: Bearer <tu clave>"`. Queda conectado en la terminal y en la app de escritorio cada vez que trabajes en esa carpeta.
- **Cursor:** toca "Agregar a Cursor". La primera vez, Cursor te pide iniciar sesión en Peaje y elegir el negocio, sin pegar ninguna clave. Si prefieres la clave, va en `.cursor/mcp.json` de tu proyecto.
- **Codex:** en la terminal, guarda tu clave con `export PEAJE_AGENT_KEY=<tu clave>` y después corre `codex mcp add peaje --url https://api.usepeaje.com/_owner/mcp --bearer-token-env-var PEAJE_AGENT_KEY`. Así la clave no queda escrita en la configuración de Codex.
- **Claude y ChatGPT (las apps de chat):** se agregan como conector personalizado con la URL que aparece en Integraciones, y al conectar eliges tu negocio y das permiso, sin clave. En ChatGPT primero hay que prender el modo desarrollador. Sirven para preguntarle a tu agente; los cambios en el código los hace tu herramienta de código.
- **Otras:** Lovable, Windsurf, GitHub Copilot, v0, Replit y cualquier herramienta que acepte MCP. Integraciones te muestra cómo conectar cada una.

## ¿Qué le pido después?

Frases como estas, en tus palabras:

- "Aplica mis tareas de Peaje"
- "Pregúntale a Peaje a quién cita la IA en vez de mí"
- "Pregúntale a Peaje qué página publico primero"

Con la primera, tu herramienta lista las tareas abiertas, lee una completa, la marca como "en progreso" para que la veas en tu panel y hace el cambio. Tú lo revisas, y el commit y el deploy los haces tú.

## ¿Qué pasa cuando la marco como lista?

Después de publicar, tu herramienta llama a Peaje con la URL en vivo. Peaje revisa los criterios de la tarea en ese momento: si todos pasan, la cierra como verificada, y si tu deploy todavía no salió, la deja esperando y la vuelve a revisar cada día. En el blog de Peaje lo usamos así: los cinco artículos que publicamos el 28 de octubre salieron de cinco tareas que cerramos desde Claude Code con la URL de cada uno.

Si una tarea no aplica a tu negocio, tu herramienta la puede descartar con el motivo, y deja de salir entre tus tareas abiertas.

## ¿Y si no uso MCP?

La misma lista está en la terminal con la CLI de Peaje, que lee tu clave de `PEAJE_AGENT_KEY`: `npx @peaje/cli@1 tasks` te muestra las tareas abiertas, `npx @peaje/cli@1 task <id>` el texto completo y `npx @peaje/cli@1 done <id> --url <url>` la marca como lista después de publicar.

## ¿Cuánto cuesta y qué cuido?

Las tareas vienen con Pro. Hablar con tu agente no gasta créditos, una respuesta que consulta los datos de tu negocio gasta 2, cada tarea nueva que te deja gasta 8 y pedirle que busque tareas nuevas gasta 30, de tus 500 del mes. Tu clave da acceso a tu negocio en Peaje, así que no la subas a tu repositorio: si se filtra, en Integraciones creas una nueva y la anterior deja de funcionar.

## Fuentes

- [Precios de Peaje](https://usepeaje.com/precios)
- [CLI de Peaje en npm](https://www.npmjs.com/package/@peaje/cli)
- [Claude Code: conectar servidores MCP](https://docs.claude.com/en/docs/claude-code/mcp)
- [Cursor: servidores MCP](https://cursor.com/docs/context/mcp)
- [Codex: servidores MCP](https://developers.openai.com/codex/mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
