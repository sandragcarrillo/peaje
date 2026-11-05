---
title: "¿Cómo aparezco en los AI Overviews de Google?"
description: Lo que Google pide para que tu sitio salga en los AI Overviews y en el Modo IA, cómo limitar lo que muestra de tus páginas, cómo lo mides y qué no hace falta.
date: 2026-11-03
slug: como-aparezco-en-los-ai-overviews-de-google
lang: es
categoria: Guía
portada: 1
portada_titulo: Tu sitio en los AI Overviews
traduccion: how-do-i-show-up-in-google-ai-overviews
---

# ¿Cómo aparezco en los AI Overviews de Google?

Con el mismo SEO de siempre. Google dice que para salir en los AI Overviews y en el Modo IA tu página tiene que estar indexada y poder mostrarse con fragmento en los resultados, y que no hay requisitos aparte. Lo que decide si te usan es lo de siempre: que Google pueda rastrear tu sitio, que tu contenido importante esté en texto y que responda bien lo que la gente busca.

Actualizado: noviembre de 2026

Según la [guía de Google para sitios](https://developers.google.com/search/docs/appearance/ai-features), no hace falta crear archivos nuevos para IA ni agregar datos estructurados especiales para aparecer en estas funciones.

## ¿Qué revisa Google?

Las mismas buenas prácticas que pide para la búsqueda normal. De su lista, estas son las que más fallan:

- **Que el rastreo esté permitido** en tu robots.txt y también en tu CDN o tu hosting. Una protección contra robots demasiado estricta puede dejar afuera a Googlebot sin que lo notes.
- **Que tus páginas se encuentren con enlaces internos**, para que Google llegue a ellas desde otras partes de tu sitio.
- **Que lo importante esté en texto**, y no solo dentro de imágenes o de un video.
- **Que tus datos estructurados coincidan con lo que se ve en la página**, por ejemplo el precio de un producto.

Google también dice que los AI Overviews y el Modo IA pueden partir una pregunta en varias búsquedas relacionadas (lo llama "query fan-out"). Por eso le sirve más una página que responde bien una pregunta concreta que una que repite una palabra clave.

## ¿Y el llms.txt o el JSON-LD sirven para Google?

Para los AI Overviews, no hacen falta, porque Google lo dice explícitamente. Sirven para los otros asistentes y agentes: el llms.txt les da a ChatGPT, Claude o a un agente de compras una guía de tu sitio, y el JSON-LD con la ficha de tu negocio les ayuda a entender quién eres sin adivinar. Si tu objetivo es solo Google, prioriza el SEO, y si también quieres que te citen los otros, mira [cómo añado llms.txt y JSON-LD](https://usepeaje.com/blog/como-anado-llms-txt-y-json-ld-para-que-la-ia-entienda-mi-web).

## ¿Puedo evitar que Google use mis páginas en sus respuestas con IA?

Sí, con los mismos controles que ya existen para los resultados:

| Control | Qué hace |
| --- | --- |
| `nosnippet` | No muestra fragmentos de esa página, tampoco en las funciones con IA |
| `data-nosnippet` | Saca de los fragmentos solo una parte de la página |
| `max-snippet` | Limita cuántos caracteres puede mostrar |
| `noindex` | Saca la página de Google por completo |

Bloquear a Google-Extended en tu robots.txt no te saca de los AI Overviews. Google-Extended controla el uso de tu contenido para entrenar y alimentar otros sistemas de IA de Google, y la búsqueda se controla con Googlebot.

## ¿Cómo sé si salgo y cuánto tráfico me trae?

En Search Console, los clics y las impresiones de los AI Overviews y del Modo IA se cuentan dentro del informe de Rendimiento, en el tipo de búsqueda "Web", junto con el resto. Google no los separa en un informe aparte, así que la forma práctica de saberlo es buscar tus preguntas clave y mirar las fuentes del resumen. Peaje no mide los AI Overviews hoy: el radar y el agente miden ChatGPT y Claude.

## ¿Por dónde empiezo?

1. Abre la Inspección de URLs de Search Console con tus páginas más importantes y revisa que estén indexadas.
2. Revisa que tu robots.txt y tu CDN dejen pasar a Googlebot y a los bots de los otros asistentes ([cuáles son](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar)).
3. Pasa tu sitio por el [radar gratis de Peaje](https://usepeaje.com/radar) para ver qué entienden los demás agentes de tu sitio y si ChatGPT y Claude te citan.

La diferencia entre lo que pide Google y lo que piden los demás asistentes la contamos en [qué es GEO y en qué se diferencia del SEO](https://usepeaje.com/blog/que-es-geo-y-en-que-se-diferencia-del-seo).

## Fuentes

- [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google Search Central: controles de fragmentos](https://developers.google.com/search/docs/appearance/snippet)
- [Google: rastreadores comunes, incluido Google-Extended](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
