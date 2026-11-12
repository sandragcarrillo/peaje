---
title: "¿Cómo aparezco en los resultados de búsqueda con IA?"
description: Qué bot usa cada buscador con IA (Google, ChatGPT, Perplexity, Claude y Copilot) para leer tu sitio, qué pide cada uno según su propia documentación, cómo ves si apareces y qué mide Peaje.
date: 2026-11-08
slug: como-aparezco-en-los-resultados-de-busqueda-con-ia
lang: es
categoria: Guía
portada: 4
portada_titulo: Buscadores con IA
traduccion: how-do-i-show-up-in-ai-search-results
---

# ¿Cómo aparezco en los resultados de búsqueda con IA?

Tienes que dejar que el bot de cada buscador lea tu sitio y tener páginas que respondan lo que pregunta la gente. Google usa Googlebot para los AI Overviews y el Modo IA, la búsqueda de ChatGPT usa OAI-SearchBot, Perplexity usa PerplexityBot, Claude usa Claude-SearchBot, y Microsoft escribe para Bingbot los controles de Copilot, así que el primer paso es revisar que tu robots.txt y tu firewall no frenen a ninguno. Dejarlos pasar es lo mínimo, y después lo que pesa es que tus páginas respondan bien una pregunta concreta.

Actualizado: noviembre de 2026

OpenAI dice que sus sistemas pueden tardar unas 24 horas en ajustarse después de que cambias tu robots.txt, según su [página de bots](https://developers.openai.com/api/docs/bots), y Perplexity da el mismo plazo, hasta 24 horas, en su [guía de bots](https://docs.perplexity.ai/guides/bots). Si acabas de abrirles la puerta, espera al menos un día antes de revisar si cambió algo.

## ¿Qué bot usa cada buscador con IA para leer tu sitio?

Cada empresa tiene su propio bot de búsqueda, y es el que decide si tu sitio puede salir en sus respuestas:

| Buscador | Bot que lee tu sitio | Qué pide su documentación |
| --- | --- | --- |
| Google AI Overviews y Modo IA | Googlebot (el índice de la búsqueda de Google) | Que tu página esté indexada y pueda mostrarse con fragmento, y Google aclara que no hay requisitos técnicos aparte |
| Búsqueda de ChatGPT | OAI-SearchBot | Dejarlo pasar en robots.txt y aceptar las IP que OpenAI publica. Si lo bloqueas, no sales en sus respuestas de búsqueda, aunque puedes aparecer como enlace de navegación |
| Perplexity | PerplexityBot | Dejarlo pasar en robots.txt, y si tienes firewall, permitir su user-agent junto con las IP que publica |
| Claude con búsqueda | Claude-SearchBot | No bloquearlo en robots.txt, porque Anthropic dice que bloquearlo puede reducir tu visibilidad en las búsquedas de Claude |
| Copilot de Microsoft | Bingbot | No bloquear a Bingbot, porque Microsoft escribe para Bingbot sus preferencias sobre cómo se usa tu contenido en las respuestas de Bing y Copilot |

En la tabla no están GPTBot ni ClaudeBot, que rastrean para entrenar modelos, ni Google-Extended, que controla el uso de tu contenido en otros sistemas de IA de Google: bloquearlos no te saca de estas respuestas. Tampoco están ChatGPT-User, Claude-User ni Perplexity-User, que abren tu página cuando una persona se lo pide al asistente. El robots.txt listo para copiar y cómo probar que tu firewall los deja pasar está en [qué bots de IA visitan mi web y cómo los dejo pasar](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar).

## ¿Qué pide cada uno, además de dejar pasar a su bot?

Poco, y cada uno lo dice a su manera:

- **Google:** pide el SEO de siempre, y su guía dice que no necesitas archivos nuevos para máquinas ni marcado especial para salir en los AI Overviews y el Modo IA. Lo que revisa y cómo limitar lo que muestra está en [cómo aparezco en los AI Overviews de Google](https://usepeaje.com/blog/como-aparezco-en-los-ai-overviews-de-google).
- **ChatGPT:** OpenAI pide dejar pasar a OAI-SearchBot y aceptar sus IP, y no publica requisitos de contenido. Tampoco dice que la búsqueda de ChatGPT salga del índice de Bing, y lo que sí se sabe de esa relación lo contamos en [cuánto tarda Bing en indexar mi web](https://usepeaje.com/blog/cuanto-tarda-bing-en-indexar-mi-web-para-que-chatgpt-me-encuentre).
- **Perplexity:** su guía recomienda dejar pasar a PerplexityBot en robots.txt, y si tu sitio está detrás de un firewall, permitir su user-agent y sus IP, que cambian y se toman de sus listas oficiales. Si usas Cloudflare, ten en cuenta que Perplexity avisa que el Bot Fight Mode no se salta con reglas personalizadas del firewall.
- **Claude:** Anthropic dice que sus bots respetan robots.txt, incluida la extensión Crawl-delay, y que bloquear sus IP puede no funcionar bien como forma de salirte. No publica requisitos de contenido.
- **Copilot:** Microsoft anunció el 30 de octubre de 2026 preferencias nuevas para las respuestas de Bing, Copilot y Microsoft 365: una de entrenamiento, que va en robots.txt, y una de uso en respuestas (AI Grounding), que se pone página por página con una etiqueta meta o una cabecera `X-Robots-Tag` para Bingbot. Rigen desde el 1 de febrero de 2027, sirven para limitar y no cambian tu elegibilidad en los resultados normales de Bing. Si hoy usas `noarchive` o `nocache` para frenar a Copilot, revisa el anuncio, porque después del 1 de marzo de 2027 Bing deja de leerlos como preferencia.

En la documentación que revisamos, ninguno de los cinco pide un llms.txt para aparecer, y qué se sabe de ese archivo está en [ChatGPT y Claude leen de verdad el llms.txt](https://usepeaje.com/blog/chatgpt-y-claude-leen-de-verdad-el-llms-txt). Para el contenido en sí, qué tipo de página ganó en nuestra propia medición lo cuenta [qué formato de página citan más ChatGPT y Claude](https://usepeaje.com/blog/que-formato-de-pagina-citan-mas-chatgpt-y-claude-guia-documentacion-o-comparativa).

## ¿Cómo sé si aparezco en cada uno?

Depende del buscador, porque cada uno muestra cosas distintas:

- **Google:** en Search Console, los clics y las impresiones de los AI Overviews y del Modo IA se cuentan en el informe de Rendimiento, en el tipo de búsqueda "Web", mezclados con el resto.
- **Copilot:** Bing Webmaster Tools tiene el informe AI Performance, en vista previa pública desde el 10 de febrero de 2026, con las citas de tu sitio en Copilot, en los resúmenes con IA de Bing y en algunas integraciones de socios, qué páginas se citan y una muestra de las preguntas que llevaron a esas citas.
- **ChatGPT y Claude:** preguntándoles lo que preguntan tus clientes y mirando las fuentes de cada respuesta, una y otra vez ([cómo se hace](https://usepeaje.com/blog/como-se-si-chatgpt-claude-o-perplexity-citan-mi-negocio)). Las personas que llegan desde ChatGPT las ves en [Google Analytics](https://usepeaje.com/blog/como-veo-cuanto-trafico-me-manda-chatgpt-en-google-analytics).
- **Perplexity:** preguntándole y revisando sus fuentes, igual que con ChatGPT y Claude.

## ¿Qué hace Peaje y qué no?

Peaje cubre una parte de esto, y conviene que sepas cuál:

- **Radar gratis:** en [usepeaje.com/radar](https://usepeaje.com/radar), con tu correo y tu dominio, te dice en menos de un minuto qué puede leer un agente en tu sitio (robots.txt, llms.txt, sitemap, JSON-LD, precios legibles sin JavaScript) y les hace a ChatGPT y a Claude tres preguntas de compra para ver si te citan y a quién citan en tu lugar.
- **Registro de visitas de agentes, gratis con el kit:** cuenta por nombre a OAI-SearchBot, PerplexityBot, Googlebot, ClaudeBot y GPTBot, también cuando leen las páginas que tu sitio sirve solo. Claude-SearchBot y Bingbot salen en "Otros" con su nombre cuando leen los archivos del kit, como /llms.txt o /mcp, y sus lecturas de tus demás páginas todavía no se cuentan.
- **Pro:** tu agente mide 20 preguntas de tus clientes en ChatGPT y Claude cada semana, te propone las páginas que faltan y vuelve a medir cada página verificada a las 2 y a las 6 semanas. Cuesta US$30 al mes para los primeros 50 negocios y US$69 después, según la [página de precios](https://usepeaje.com/precios).

Peaje no cuenta tus apariciones en los AI Overviews ni en el Modo IA de Google, en Perplexity ni en Copilot, y para eso usa Search Console, Bing Webmaster Tools y tus propias búsquedas. En esos buscadores trabaja por otra vía: el kit deja a Googlebot, Bingbot y PerplexityBot permitidos por nombre en tu robots.txt y revisa que Googlebot y PerplexityBot puedan leer tu home sin JavaScript, que es lo que necesitan para citarte ([cómo lo hace con Google](https://usepeaje.com/blog/como-se-si-mi-sitio-aparece-en-los-ai-overviews-de-google)). Y Peaje no te puede prometer que te citen: el 7 de noviembre de 2026, usepeaje.com tuvo 0% de citas en las 20 preguntas que medimos en ChatGPT y Claude.

## ¿Por dónde empiezo?

1. Revisa tu robots.txt y tu firewall con los cinco bots de la tabla, y espera un día después de cada cambio.
2. Confirma en Search Console que tus páginas importantes están indexadas, y agrega tu sitio a Bing Webmaster Tools para ver el informe de Copilot.
3. Escribe una página por cada pregunta importante de tus clientes, con la respuesta al principio y un dato que se pueda citar.
4. Pasa tu sitio por el [radar gratis](https://usepeaje.com/radar) para ver qué lee un agente y si ChatGPT y Claude ya te citan.

Si quieres entender en qué se diferencia todo esto del SEO de siempre, está en [qué es GEO y en qué se diferencia del SEO](https://usepeaje.com/blog/que-es-geo-y-en-que-se-diferencia-del-seo).

## Fuentes

- [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [OpenAI: bots y user-agents](https://developers.openai.com/api/docs/bots)
- [Perplexity: sus bots](https://docs.perplexity.ai/guides/bots)
- [Anthropic: cómo rastrea la web y cómo bloquear sus bots](https://support.claude.com/en/articles/8896518)
- [Bing: preferencias para entrenamiento y uso en respuestas (30 de octubre de 2026)](https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/)
- [Bing: AI Performance en Bing Webmaster Tools (10 de febrero de 2026)](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)
- [Precios de Peaje](https://usepeaje.com/precios)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
