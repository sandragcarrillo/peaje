---
title: "¿Cómo sé si mi sitio aparece en los AI Overviews de Google?"
description: Qué te muestra Search Console de los AI Overviews y del Modo IA, cómo revisarlo a mano, qué herramientas rastrean tus apariciones y qué hace Peaje para que Google pueda leerte.
date: 2026-11-08
slug: como-se-si-mi-sitio-aparece-en-los-ai-overviews-de-google
lang: es
categoria: Guía
portada: 2
portada_titulo: Tus apariciones en AI Overviews
traduccion: how-do-i-check-if-my-site-appears-in-googles-ai-overviews
---

# ¿Cómo sé si mi sitio aparece en los AI Overviews de Google?

Entra a Search Console y abre el informe de rendimiento de IA generativa: te dice cuántas veces salieron enlaces a tu sitio en los AI Overviews y en el Modo IA, por página, país, fecha y dispositivo. Ese informe no te dice con qué búsquedas apareciste ni separa los AI Overviews del Modo IA, así que para saber en qué pregunta sales tienes que buscarla en Google o usar una herramienta que lo rastree.

Actualizado: noviembre de 2026

Google lanzó ese informe el 3 de junio de 2026 para un grupo de sitios, y desde el 31 de agosto de 2026 está disponible para todos los sitios del mundo, según el [blog de Google Search Central](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports).

## ¿Qué te dice Search Console sobre los AI Overviews?

Los AI Overviews aparecen en dos informes, y cada uno muestra algo distinto:

| Informe | Qué te dice | Qué no te dice |
| --- | --- | --- |
| Rendimiento de IA generativa (Búsqueda) | Impresiones de tus enlaces en los AI Overviews y el Modo IA, por página, país, fecha y dispositivo | Clics, consultas, y cuánto viene de cada función por separado |
| Rendimiento, tipo de búsqueda Web | Clics, impresiones, consultas y posición | Cuáles de esos datos vienen de los AI Overviews, porque se suman al resto |

En el informe de Rendimiento de siempre, Google cuenta los AI Overviews y el Modo IA dentro del tipo de búsqueda Web. Un clic a tu página desde un AI Overview cuenta como clic, las impresiones siguen las reglas de siempre y el AI Overview ocupa una sola posición en los resultados, así que todos sus enlaces reciben esa misma posición. Si alguien hace otra pregunta dentro del Modo IA, Google lo cuenta como una búsqueda nueva. Los experimentos de Search Labs no entran en ninguno de los dos informes.

Si no ves el informe de IA generativa, Google dice que suele ser porque tu sitio tiene muy pocas impresiones en esas funciones, o porque lo excluiste en **Ajustes > IA generativa en la Búsqueda**. Ese control viene en incluir por defecto, y si lo cambias a excluir, tus enlaces dejan de salir en los AI Overviews, en el Modo IA y en las funciones con IA de Discover.

Para cruzar los dos informes, mira qué páginas tienen impresiones en el de IA generativa, filtra el informe de Rendimiento por esa página y revisa con qué consultas sale. Esas son las preguntas que vale la pena buscar a mano.

## ¿Cómo reviso a mano si salgo?

Buscando tus preguntas en Google y mirando los enlaces del resumen:

1. Abre una ventana privada, para que no entre el historial de tu cuenta de Google. Si buscas con tu sesión abierta y los resultados vienen personalizados, Google pone al pie de la página un enlace "Probar sin personalización".
2. Escribe la pregunta como la escribiría un cliente, por ejemplo "cómo controlar si apareces en ai overviews", y fíjate si sale un AI Overview.
3. Revisa los enlaces que el resumen pone como fuente y anota si tu sitio está, con qué página y a quién cita en tu lugar.
4. Repite la búsqueda en el Modo IA. Google dice que el Modo IA y los AI Overviews pueden usar modelos y técnicas distintos, así que sus respuestas y enlaces cambian.

Lo que veas vale para esa búsqueda, en ese momento y desde ese lugar. Google explica que sus resultados cambian según la hora, la ubicación, el idioma, el tipo de dispositivo y la personalización, así que otra persona puede ver algo distinto. Además, Google muestra un AI Overview solo cuando sus sistemas creen que ayuda, así que algunas búsquedas salen sin resumen. Para que la revisión te sirva, guarda una lista corta de preguntas y búscalas siempre igual, cada semana o cada dos.

## ¿Qué herramientas rastrean las apariciones en AI Overviews?

Las herramientas de SEO que siguen palabras clave ya revisan si tus búsquedas muestran un AI Overview y si tu sitio sale citado. Estas lo dicen en su propia web:

- **Semrush:** su Position Tracking sigue las apariciones en AI Overviews de las palabras clave que defines, y su guía explica cómo filtrar las que muestran un AI Overview que cita tu dominio y las que no.
- **Ahrefs:** Brand Radar cubre los AI Overviews y el Modo IA, junto con ChatGPT, Perplexity, Gemini y Copilot.
- **SE Ranking:** su AI Overviews Tracker muestra si tus palabras clave tienen un AI Overview, dónde sale tu sitio dentro de él y qué dominios usa como fuente.

Lo que muestran sale de las búsquedas que hace cada herramienta, en los países y dispositivos que eliges, mientras que Search Console usa los datos de Google, así que sus números no tienen que coincidir. No ponemos sus precios porque cambian, revísalos en cada sitio. Si buscas una comparación de herramientas para ChatGPT y Claude, la tienes en [herramientas de AEO en español](https://usepeaje.com/blog/herramientas-de-aeo-en-espanol-cuales-existen-y-cuanto-cuestan).

## ¿Qué hace Peaje con los AI Overviews?

Peaje no cuenta tus apariciones en los AI Overviews, porque ese dato lo tiene Search Console. Trabaja en lo mismo por otra vía: en que Google pueda leerte y entender quién eres, que es lo que necesita para citarte.

- **El kit** deja en tu robots.txt a Googlebot y a los demás bots de búsqueda permitidos por nombre, y pone en el head de tu home los datos que identifican a tu negocio. En la sección "Motores de respuesta" revisa que Googlebot, OAI-SearchBot y PerplexityBot puedan leer tu home y /developers, y te avisa si tu servidor los rechaza con un 403, 429 o 503, si Cloudflare les pide un challenge que no pueden pasar o si tu home depende de JavaScript.
- **El registro de visitas de agentes**, que viene en el plan gratis, cuenta cuántas veces Googlebot lee tu sitio. En usepeaje.com contó 225 visitas de Googlebot en 30 días. Eso te dice que Google te lee, y si además te cita en un AI Overview lo ves en Search Console o buscando a mano.
- **El radar gratis** revisa qué puede leer un agente de IA en tu sitio y te da tu puntaje en menos de un minuto. En la misma página te muestra lo que responden ChatGPT y Claude a tres preguntas de alguien que busca lo que ofreces.
- **Pro** mide cada semana 20 preguntas de tus clientes en ChatGPT y Claude, te dice a quién citan en tu lugar y vuelve a medir cada página verificada a las 2 y a las 6 semanas.

Nada de esto garantiza que Google te cite, porque eso también depende de tu contenido y de lo que otros sitios dicen de ti. Lo que Google pide para salir en los AI Overviews es SEO de siempre, y lo contamos en [cómo aparezco en los AI Overviews de Google](https://usepeaje.com/blog/como-aparezco-en-los-ai-overviews-de-google). Para ChatGPT, Claude y Perplexity, mira [cómo sé si ChatGPT, Claude o Perplexity citan mi negocio](https://usepeaje.com/blog/como-se-si-chatgpt-claude-o-perplexity-citan-mi-negocio).

## ¿Cómo veo cuántas visitas me traen los AI Overviews?

En Google Analytics 4 no hay un canal aparte para ellos. GA cuenta las visitas que llegan desde los AI Overviews y el Modo IA dentro de "Organic Search", junto con el resto de Google, y su canal AI Assistant junta solo las que vienen de asistentes como ChatGPT, Gemini y Claude. Te lo explicamos paso a paso en [cómo veo cuánto tráfico me manda ChatGPT en Google Analytics](https://usepeaje.com/blog/como-veo-cuanto-trafico-me-manda-chatgpt-en-google-analytics).

Lo más cercano que tienes es Search Console: las impresiones del informe de IA generativa por página, y los clics de esa página en el informe de Rendimiento, sabiendo que esos clics incluyen también los resultados normales.

## Fuentes

- [Google Search Central: informes de rendimiento de IA generativa en Search Console (3 de junio de 2026)](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)
- [Ayuda de Search Console: informe de rendimiento de IA generativa (Búsqueda)](https://support.google.com/webmasters/answer/16984139?hl=es-419)
- [Ayuda de Search Console: control de IA generativa de la Búsqueda](https://support.google.com/webmasters/answer/16908024?hl=es-419)
- [Ayuda de Search Console: qué son las impresiones, la posición y los clics](https://support.google.com/webmasters/answer/7042828?hl=es-419)
- [Google Search Central: las funciones con IA y tu sitio web](https://developers.google.com/search/docs/appearance/ai-features)
- [Ayuda de la Búsqueda de Google: por qué tus resultados son distintos a los de otras personas](https://support.google.com/websearch/answer/12412910?hl=es-419)
- [Ayuda de la Búsqueda de Google: AI Overviews](https://support.google.com/websearch/answer/14901683?hl=es-419)
- [Google Analytics: grupo de canales predeterminado](https://support.google.com/analytics/answer/9756891?hl=es-419)
- [Semrush: cómo rastrear los AI Overviews](https://www.semrush.com/blog/semrush-ai-overview-research/)
- [Ahrefs: Brand Radar](https://ahrefs.com/brand-radar)
- [SE Ranking: AI Overviews Tracker](https://seranking.com/ai-overviews-tracker.html)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
- [Precios de Peaje](https://usepeaje.com/precios)
