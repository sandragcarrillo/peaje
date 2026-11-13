---
title: "¿Cómo hago que Claude cite mi sitio web?"
description: Cuál de los tres bots de Anthropic decide si Claude te puede citar, cuándo busca Claude en la web según su documentación, qué necesita tu página para que la lea y qué mide Peaje y qué no.
date: 2026-11-13
slug: como-hago-que-claude-cite-mi-sitio-web
lang: es
categoria: Guía
portada: 1
portada_titulo: Citado por Claude
traduccion: how-do-i-get-claude-to-cite-my-website
---

# ¿Cómo hago que Claude cite mi sitio web?

Claude cita tu sitio cuando busca en la web para responder y tu página sale entre los resultados, así que lo primero es no bloquear a Claude-SearchBot, el bot con que Anthropic indexa para las búsquedas de Claude. ClaudeBot rastrea para entrenar modelos y bloquearlo no te saca de esas búsquedas, y Claude-User abre tu página cuando una persona se lo pide. Anthropic no publica qué índice usa para buscar ni cómo elige una fuente sobre otra, así que lo demás depende de que tengas una página legible que responda la pregunta de tu cliente.

Actualizado: noviembre de 2026

Cuando Claude busca en la web desde su API, cada cita trae la URL, el título y hasta 150 caracteres del texto citado de tu página, según la [documentación de su herramienta de búsqueda](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool), y en esa herramienta las citas van siempre activadas. Si la respuesta a la pregunta de tu cliente está en una frase completa al principio de tu página, esa frase cabe en una cita.

## ¿Cuál de los bots de Anthropic tiene que poder leer tu sitio?

Anthropic tiene tres, y explica qué pasa si bloqueas cada uno en su [página sobre cómo rastrea la web](https://support.claude.com/en/articles/8896518):

| Bot | Para qué entra | Si lo bloqueas |
| --- | --- | --- |
| Claude-SearchBot | Recorre la web para mejorar los resultados de búsqueda | Claude no indexa tu contenido para búsqueda, y puedes perder visibilidad y precisión en sus resultados |
| Claude-User | Abre tu página cuando una persona le pregunta algo a Claude | Claude no puede traer tu contenido para responder esa pregunta, y puedes perder visibilidad en las búsquedas que pide una persona |
| ClaudeBot | Ayuda a mejorar la utilidad y la seguridad de sus modelos de IA | Tu contenido futuro queda fuera de sus datos de entrenamiento |

Los tres respetan robots.txt, incluida la extensión no estándar Crawl-delay. Anthropic avisa que bloquear sus IP puede no funcionar bien como forma de salirte, porque les impide leer tu robots.txt, y publica su [lista de IP](https://claude.com/crawling/bots.json): si una visita viene de una IP de esa lista, viene de Anthropic, lo que te sirve para dejarla pasar en tu firewall sin abrirle la puerta a cualquiera que copie el user-agent. El robots.txt listo para copiar está en [qué bots de IA visitan mi web y cómo los dejo pasar](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar).

## ¿Cuándo busca Claude en la web?

Claude busca cuando la pregunta depende de algo actual, y la documentación de la API lo detalla: busca cuando la pregunta trata de precios, cifras o noticias de hoy, de organizaciones, personas o productos que pueden haber cambiado, o cuando alguien le pide buscar, y que responde sin buscar cuando le basta lo que ya sabe, como hechos establecidos, conceptos o escritura creativa. Una pregunta como "qué programa de facturación me sirve y cuánto cuesta" tiene más chance de traer fuentes que "qué es una factura electrónica", que Claude puede contestar sin citar a nadie.

En la app, según el [centro de ayuda de Claude](https://support.claude.com/en/articles/10684626-enabling-and-using-web-search), la búsqueda se prende en el menú "+" del chat, y en la experiencia nueva no hay interruptor. En los planes Team y Enterprise primero la tiene que activar quien administra la cuenta. Cada respuesta con búsqueda trae citas, y Claude puede usar la ubicación que deduce de la IP de la persona cuando la pregunta pide resultados locales.

## ¿Qué necesita tu página para que Claude la lea?

La documentación de la API de Claude da varias pistas sobre su herramienta para leer páginas (web fetch):

- **Texto en el HTML:** no lee sitios que arman su contenido con JavaScript, así que lo que quieras que cite tiene que estar en el HTML que sirve tu servidor.
- **Formatos:** solo lee texto, HTML y PDF.
- **robots.txt:** si tu robots.txt no la deja entrar, la lectura falla.
- **Copias guardadas:** guarda copias de las páginas que lee, y lo que trae puede no ser la última versión de tu página.

Cada resultado de búsqueda trae también la fecha en que el sitio se actualizó por última vez. Fuera de eso, Anthropic no publica qué hace que Claude elija una fuente: no dice de qué índice salen sus resultados de texto, y lo único que nombra es Bing para las imágenes que muestra en el chat. También hay casos en que tu página no puede salir aunque esté bien hecha, porque una empresa que usa Claude puede limitar a qué dominios busca. En nuestra medición de usepeaje.com ganaron la documentación técnica y las guías, como contamos en [qué formato de página citan más ChatGPT y Claude](https://usepeaje.com/blog/que-formato-de-pagina-citan-mas-chatgpt-y-claude-guia-documentacion-o-comparativa).

## ¿Qué hace Peaje y qué no?

Peaje mide si Claude te cita haciéndole las preguntas de tus clientes, y cuida que sus bots puedan entrar:

- **Radar gratis:** en [usepeaje.com/radar](https://usepeaje.com/radar), con tu correo y tu dominio, les hace 3 preguntas de compra a ChatGPT y a Claude, te muestra si te citan y a quién citan en tu lugar, y te avisa si tu robots.txt bloquea a ClaudeBot, Claude-SearchBot o Claude-User.
- **Pro:** tu agente mide 20 preguntas de tus clientes en ChatGPT y Claude cada semana y vuelve a medir cada página verificada a las 2 y a las 6 semanas. Le pregunta a Claude por su API con la búsqueda activada y lee las fuentes que cita, que es una aproximación de lo que ve una persona en la app, con otro modelo y sin su historial ni su ubicación. Cuesta US$30 al mes para los primeros 50 negocios y US$69 después, según la [página de precios](https://usepeaje.com/precios).
- **Kit:** deja permitido a Claude-SearchBot por nombre en tu robots.txt, y si eliges bloquear los bots de entrenamiento, bloquea a ClaudeBot y no toca a Claude-SearchBot. La verificación del kit prueba tu home con los user-agents de Googlebot, OAI-SearchBot y PerplexityBot, sin Claude-SearchBot, que sí entra en la revisión de acceso de las tareas de arreglo: si tu robots.txt o tu firewall lo frena, te queda una tarea.
- **Registro de visitas:** cuenta a ClaudeBot por nombre, y como entrena, no lo tomamos como señal de que Claude te vaya a citar. Claude-SearchBot sale en "Otros" con su nombre cuando lee los archivos del kit, como /llms.txt, y sus lecturas de tus demás páginas todavía no se cuentan.

Peaje no te puede prometer que Claude te cite: el 7 de noviembre de 2026, usepeaje.com tuvo 0% de citas en las 20 preguntas que medimos en ChatGPT y Claude. Cada cuánto conviene volver a medir está en [cada cuánto debo medir si ChatGPT y Claude citan mi negocio](https://usepeaje.com/blog/cada-cuanto-debo-medir-si-chatgpt-y-claude-citan-mi-negocio), y la misma guía para Perplexity, en [cómo aparezco en las respuestas de Perplexity](https://usepeaje.com/blog/como-aparezco-en-las-respuestas-de-perplexity).

## Fuentes

- [Anthropic: cómo rastrea la web y cómo bloquear sus bots](https://support.claude.com/en/articles/8896518)
- [Anthropic: lista de IP de sus bots](https://claude.com/crawling/bots.json)
- [Claude: activar y usar la búsqueda web](https://support.claude.com/en/articles/10684626-enabling-and-using-web-search)
- [Claude API: herramienta de búsqueda web](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Claude API: herramienta para leer páginas (web fetch)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
- [Precios de Peaje](https://usepeaje.com/precios)
