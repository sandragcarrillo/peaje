---
title: "¿ChatGPT y Claude leen de verdad el llms.txt?"
description: Qué es llms.txt, qué han dicho OpenAI, Anthropic y Google sobre si lo usan, qué muestran las visitas de bots a usepeaje.com y por qué una descarga no prueba que el archivo se use para responder.
date: 2026-11-07
slug: chatgpt-y-claude-leen-de-verdad-el-llms-txt
lang: es
categoria: Guía
portada: 1
portada_titulo: ¿La IA lee llms.txt?
traduccion: do-chatgpt-and-claude-actually-read-llms-txt
---

# ¿ChatGPT y Claude leen de verdad el llms.txt?

Los bots lo descargan, pero no hay confirmación pública de que ChatGPT o Claude usen el llms.txt de tu sitio para armar sus respuestas. OpenAI y Anthropic explican sus bots en su documentación y ahí solo hablan de robots.txt, aunque las dos publican un llms.txt para su propia documentación. En usepeaje.com, /llms.txt está entre las tres rutas más leídas por bots, y aun así que un bot baje el archivo no prueba que lo use para contestar.

Actualizado: noviembre de 2026

En los 30 días anteriores al 7 de noviembre de 2026, usepeaje.com recibió 1108 visitas de bots, y las rutas que más leyeron fueron /mcp, /developers y /llms.txt, según el registro de visitas de agentes de Peaje ([cómo funciona ese registro](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar)).

## ¿Qué es llms.txt?

Es una propuesta de Jeremy Howard, publicada en [llmstxt.org](https://llmstxt.org/) el 3 de septiembre de 2024, para que un sitio tenga en `/llms.txt` un archivo en Markdown que les explique a los agentes de qué se trata y dónde está cada cosa. Lo único obligatorio es un título con el nombre del sitio, y lo demás es opcional: un resumen corto, notas y secciones con listas de links. La misma propuesta sugiere ofrecer cada página también en Markdown, en la misma URL terminada en `.md`. Sigue siendo una propuesta, como dice su propia página.

## ¿Qué han dicho OpenAI, Anthropic y Google?

| Empresa | Qué dice sobre usar llms.txt | ¿Publica uno? |
| --- | --- | --- |
| OpenAI | Su [página de bots](https://developers.openai.com/api/docs/bots) explica OAI-SearchBot, GPTBot y ChatGPT-User y cómo controlarlos con robots.txt, y no dice que lean llms.txt | Sí, en [developers.openai.com/llms.txt](https://developers.openai.com/llms.txt), y esa misma página de bots lo enlaza como índice de su documentación |
| Anthropic | Su [centro de ayuda](https://support.claude.com/en/articles/8896518) explica ClaudeBot, Claude-User y Claude-SearchBot y cómo controlarlos con robots.txt, y no menciona llms.txt | Sí, en [platform.claude.com/llms.txt](https://platform.claude.com/llms.txt) (docs.claude.com redirige ahí) y en [code.claude.com/docs/llms.txt](https://code.claude.com/docs/llms.txt) |
| Google | Su [guía de funciones con IA](https://developers.google.com/search/docs/appearance/ai-features) dice que para salir en los AI Overviews y el Modo IA no necesitas archivos nuevos para máquinas ni archivos de texto para IA | Sí, para la documentación de la API de Gemini, en [aistudio.google.com/llms.txt](https://aistudio.google.com/llms.txt) |

Google fue el más directo. John Mueller, de su equipo de búsqueda, escribió en Bluesky el 17 de junio de 2025 "FWIW no AI system currently uses llms.txt" ([el post](https://bsky.app/profile/johnmu.com/post/3lrshm4gggs2v)), y no encontramos un anuncio posterior de Google que lo cambie. De OpenAI y Anthropic no encontramos ninguna declaración, ni a favor ni en contra.

Que las tres publiquen un llms.txt para su documentación dice que lo consideran útil para quien programa con IA y le pasa ese archivo a su herramienta. No dice nada sobre cómo eligen las fuentes ChatGPT, Claude o la búsqueda de Google.

## ¿Qué muestra el registro de visitas de usepeaje.com?

De las 1108 visitas, las que más vinieron fueron de Googlebot (225), ClaudeBot (197) y GPTBot (133). Según la documentación de Anthropic y de OpenAI, ClaudeBot y GPTBot rastrean para entrenar modelos, y los que indexan para las respuestas con fuentes son otros, Claude-SearchBot y OAI-SearchBot. O sea que los dos bots de IA que más visitan usepeaje.com no son los que deciden qué página se cita.

Hay dos límites más que conviene decir. Con estos datos no podemos afirmar qué bot leyó /llms.txt en particular, solo que la ruta está entre las más leídas. Y usepeaje.com tiene llms.txt publicado y aun así tuvo 0% de citas en las 20 preguntas que medimos en ChatGPT y Claude el 7 de noviembre de 2026, así que en nuestro caso tener el archivo no ha alcanzado para que nos citen.

## ¿Entonces vale la pena tenerlo?

Sí, si lo ves como un archivo barato que ayuda a los agentes que ya llegaron a tu sitio, y sin esperar que te traiga citas por sí solo. Si alguien le pasa la URL de tu sitio a una herramienta como Claude Code o Cursor, la lee como cualquier otra página, y un resumen claro con links le ahorra adivinar. Para que ChatGPT y Claude te citen pesa más:

- Dejar pasar a los bots de búsqueda en tu robots.txt ([cuáles son](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar)).
- Tener páginas que respondan las preguntas de tus clientes, con datos que se puedan citar.
- Tus datos en JSON-LD, y si tu objetivo es Google, el SEO de siempre ([qué pide Google](https://usepeaje.com/blog/como-aparezco-en-los-ai-overviews-de-google)).

## ¿Cómo lo agrego a mi sitio?

El kit gratis de Peaje genera el llms.txt para tu sitio junto con JSON-LD, openapi.json, un servidor MCP y agent cards, sin tarjeta. Los pasos están en [cómo añado llms.txt y JSON-LD](https://usepeaje.com/blog/como-anado-llms-txt-y-json-ld-para-que-la-ia-entienda-mi-web), y si prefieres otra herramienta, en [los generadores gratis que existen](https://usepeaje.com/blog/existe-un-generador-gratis-de-llms-txt-json-ld-y-mcp-para-mi-web). Con el kit también tienes el registro de visitas, que te dice quién llega a tu sitio y qué rutas se leen más, y con eso sacas tus propias conclusiones con los datos de tu sitio.

## Fuentes

- [llms.txt: la propuesta de Jeremy Howard](https://llmstxt.org/)
- [OpenAI: los bots de OpenAI](https://developers.openai.com/api/docs/bots)
- [Anthropic: cómo rastrea la web y cómo bloquear sus bots](https://support.claude.com/en/articles/8896518)
- [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [John Mueller en Bluesky, 17 de junio de 2025](https://bsky.app/profile/johnmu.com/post/3lrshm4gggs2v)
- [llms.txt de OpenAI](https://developers.openai.com/llms.txt)
- [llms.txt de Anthropic](https://platform.claude.com/llms.txt)
- [llms.txt de Claude Code](https://code.claude.com/docs/llms.txt)
- [llms.txt de la API de Gemini](https://aistudio.google.com/llms.txt)
- [Precios de Peaje](https://usepeaje.com/precios)
