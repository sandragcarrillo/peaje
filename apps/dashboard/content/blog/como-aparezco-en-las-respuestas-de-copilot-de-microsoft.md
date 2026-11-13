---
title: "¿Cómo aparezco en las respuestas de Copilot de Microsoft?"
description: Qué dice Bing que necesita una página para salir citada en Copilot, qué etiquetas te pueden sacar sin querer, cómo ves tus citas en el informe AI Performance y qué hace Peaje y qué no.
date: 2026-11-13
slug: como-aparezco-en-las-respuestas-de-copilot-de-microsoft
lang: es
categoria: Guía
portada: 2
portada_titulo: Aparecer en Copilot
traduccion: how-do-i-show-up-in-microsoft-copilot-answers
---

# ¿Cómo aparezco en las respuestas de Copilot de Microsoft?

Copilot elige qué citar sobre el mismo rastreo, la misma indexación y el mismo ranking de la búsqueda de Bing, según las guías de Bing para webmasters, así que el primer paso es que Bingbot pueda leer tu sitio y que tus páginas estén en el índice de Bing. Después pesa que cada página responda un tema concreto, con lo importante al principio, y que le avises a Bing con IndexNow cada vez que algo cambia. Tus citas las ves en el informe AI Performance de Bing Webmaster Tools.

Actualizado: noviembre de 2026

El informe AI Performance está en vista previa pública desde el 10 de febrero de 2026 y mide cuatro cosas: el total de citas, el promedio de páginas tuyas citadas por día, una muestra de las búsquedas que hizo la IA antes de citarte y las citas de cada URL, según el [anuncio de Bing](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview).

## ¿De dónde saca Copilot las páginas que cita?

Las saca del índice de Bing. Las [guías para webmasters](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a) dicen que las experiencias de búsqueda de Bing y de Copilot se apoyan en la misma base de rastreo, indexación y ranking que la búsqueda tradicional, y que lo que ayuda al SEO también ayuda a que una página pueda usarse para armar respuestas (lo que Bing llama grounding) y salir citada. Si no sigues las guías, Bing avisa que puedes perder visibilidad en la búsqueda, quedar con menos opciones de salir en esas respuestas o salir del índice.

Las mismas guías aclaran que el GEO (optimización para motores generativos) no garantiza citas, igual que el SEO no garantiza un puesto. Qué bot usa cada buscador con IA y cómo se compara Copilot con los demás está en [cómo aparezco en los resultados de búsqueda con IA](https://usepeaje.com/blog/como-aparezco-en-los-resultados-de-busqueda-con-ia), y cómo agregar tu sitio a Bing Webmaster Tools y cómo funciona IndexNow, en [cuánto tarda Bing en indexar mi web](https://usepeaje.com/blog/cuanto-tarda-bing-en-indexar-mi-web-para-que-chatgpt-me-encuentre).

## ¿Qué pide Bing para que una página salga citada en Copilot?

Las guías de Bing traen una lista larga, y esto es lo que más pesa para salir en una respuesta:

| Qué pide Bing | Por qué, según sus guías |
| --- | --- |
| Dejar pasar a Bingbot en robots.txt y no esconder el contenido detrás de JavaScript | Lo que Bing no puede leer ni renderizar puede quedar fuera del índice y de las respuestas |
| Avisar con IndexNow cuando agregas, cambias o borras una URL | Ayuda a que Copilot no cite versiones viejas o URLs que ya no existen |
| Un sitemap con solo las URLs canónicas y su fecha de cambio (`lastmod`) | Le dice a Bing qué páginas importan y cuándo cambiaron |
| Una página por tema, con lo importante arriba y sin introducciones largas | Las páginas enfocadas en un tema tienen más chance de usarse para una respuesta |
| Hechos y definiciones explícitos, que se entiendan sin otra página | Bing prefiere contenido que se pueda verificar por sí solo |
| Los mismos nombres para tu empresa, tus productos y tus sedes en todo el sitio | Mejora la precisión de la cita |
| Datos estructurados que coincidan con lo que se ve en la página | Pueden ayudar, aunque Bing dice que no garantizan visibilidad |

Las guías también nombran lo que te resta: contenido copiado sin aporte propio, texto escrito para forzar citas, contenido generado en masa sin revisión, y texto puesto para manipular a los modelos de Bing o de Copilot, que puede bajar tu visibilidad o sacarte de la búsqueda.

En el anuncio de AI Performance, Bing suma consejos para las páginas que ya tienes: usar tablas, títulos y preguntas frecuentes, respaldar lo que dices con datos y fuentes, mantener el contenido al día y, si tienes un negocio local, registrarlo en Bing Places for Business con la dirección, el horario y el contacto al día.

## ¿Qué etiquetas te pueden sacar de Copilot sin querer?

Algunas etiquetas que se ponen por otras razones cambian lo que Copilot puede hacer con tu página. Según las guías de Bing:

- **`noindex`:** la página no sale en la búsqueda de Bing, en Copilot ni en los resultados de grounding.
- **`noarchive`:** impide que el contenido se use en las respuestas de Copilot.
- **`nocache`:** Copilot solo puede usar la URL, el título y el fragmento, y las citas salen más pobres.
- **`nosnippet` y `data-nosnippet`:** Bing no muestra fragmento y la cita en Copilot puede salir peor.

Esto va a cambiar. El 30 de octubre de 2026 Bing [anunció preferencias nuevas](https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/) que rigen desde el 1 de febrero de 2027. La de uso en respuestas se pone página por página, con `<meta name="Bingbot" content="ai-grounding:disallow">` o con la cabecera `X-Robots-Tag: Bingbot: ai-grounding:disallow`, y la de entrenamiento va en robots.txt con el user-agent `__usage_ai-training`. Si no pones nada, las dos quedan permitidas, y ninguna cambia tu elegibilidad en los resultados normales de Bing. Después del 1 de marzo de 2027, Bing deja de leer `noarchive` y `nocache` como preferencias para la IA, así que si hoy los usas para frenar a Copilot, el anuncio explica cómo dejar una preferencia temporal en Bing Webmaster Tools desde el 15 de diciembre de 2026.

Si lo que quieres es aparecer, revisa que ninguna de estas etiquetas esté en las páginas que quieres que Copilot cite, porque a veces vienen puestas por un plugin o por la plantilla del sitio.

## ¿Cómo veo si Copilot me cita?

En el informe AI Performance de Bing Webmaster Tools, que cuenta las citas en Copilot, en los resúmenes con IA de Bing y en algunas integraciones de socios. Lo que trae:

- **Total de citas:** cuántas veces tu contenido salió como fuente en una respuesta. No dice en qué lugar de la respuesta salió.
- **Promedio de páginas citadas:** cuántas páginas distintas de tu sitio se citan por día.
- **Búsquedas de la IA:** una muestra de las frases que usó la IA para buscar el contenido que después citó.
- **Citas por página:** cuántas veces se cita cada URL, y una línea de tiempo para ver cómo cambia.

Bing recomienda usarlo para ver qué páginas se citan, cuáles salen seguido y cuáles están indexadas pero casi no se citan, que son las primeras para mejorar. Sus guías también avisan que una página puede aparecer en Copilot sin que nadie haga clic, así que una baja en los clics no siempre quiere decir que perdiste visibilidad.

## ¿Qué hace Peaje por Copilot y qué no?

Peaje no mide tus citas en Copilot. Mide solo ChatGPT y Claude, y para Copilot el lugar es el informe AI Performance de Bing. Lo que sí hace:

- **robots.txt del kit:** deja pasar a Bingbot por nombre, junto con Googlebot, OAI-SearchBot, PerplexityBot, Claude-SearchBot y Applebot.
- **Revisión de acceso:** cuando Peaje genera tus tareas, entra a tu home con el user-agent de Bingbot y lee tu robots.txt, y si alguno de los dos lo frena, te deja una tarea para arreglarlo.
- **IndexNow cuando cambian tus precios:** cuando creas, editas o borras una ruta o un link con precio, Peaje le avisa a IndexNow que cambiaron tu `/developers` y tu `/pricing.md`. La clave vive en la raíz de tu dominio, en `/peaje-indexnow.txt`, y el aviso solo sale si la clave responde ahí, lo que pasa cuando tienes el proxy del kit instalado.

Lo que no hace: no avisa a IndexNow por el resto de tus páginas, no registra tu sitio en Bing Webmaster Tools y no pone preferencias de grounding en tus páginas. Y no te puede prometer que Copilot te cite, porque Bing tampoco lo promete. Para empezar, el [radar gratis](https://usepeaje.com/radar) te dice en menos de un minuto qué puede leer un agente en tu sitio y si ChatGPT y Claude ya te citan.

## Fuentes

- [Bing: guías para webmasters](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
- [Bing: AI Performance en Bing Webmaster Tools (10 de febrero de 2026)](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)
- [Bing: preferencias para entrenamiento y uso en respuestas (30 de octubre de 2026)](https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
