---
title: "¿Cuánto tarda Bing en indexar mi web para que ChatGPT me encuentre?"
description: Qué se sabe de la relación entre Bing y la búsqueda de ChatGPT, qué hacen Bing Webmaster Tools e IndexNow, qué hace Peaje con IndexNow y qué pasos seguir para que te encuentren.
date: 2026-11-07
slug: cuanto-tarda-bing-en-indexar-mi-web-para-que-chatgpt-me-encuentre
lang: es
categoria: Guía
portada: 1
portada_titulo: Bing, IndexNow y ChatGPT
traduccion: how-long-does-bing-take-to-index-my-website-so-chatgpt-can-find-me
---

# ¿Cuánto tarda Bing en indexar mi web para que ChatGPT me encuentre?

No hay una cifra oficial: ni Microsoft ni OpenAI publican cuánto tarda, y Bing aclara que avisarle de una página nueva no garantiza que la rastree ni que la indexe. OpenAI tampoco dice que ChatGPT busque en Bing, y lo que sí pide para que aparezcas en sus respuestas es que dejes pasar a su bot, OAI-SearchBot. Lo que controlas es avisarle rápido a Bing con IndexNow, revisar tus páginas en Bing Webmaster Tools y abrirle la puerta al bot de OpenAI.

Actualizado: noviembre de 2026

La única cifra de tiempo que publica OpenAI sobre su búsqueda es de unas 24 horas, y se refiere a lo que tardan sus sistemas en ajustarse después de que cambias tu robots.txt, según su [página de bots](https://developers.openai.com/api/docs/bots). Para indexar una página nueva no da ningún plazo.

## ¿ChatGPT usa el índice de Bing?

OpenAI no lo dice así. En su [ayuda sobre la búsqueda en la web](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt) explica que la búsqueda de ChatGPT a veces trabaja con otros proveedores de búsqueda, a los que les manda la pregunta reescrita, y para ver cómo tratan esas consultas enlaza la declaración de privacidad de Microsoft y la política de privacidad de Shopify. No nombra a Bing ni dice qué parte de las respuestas sale de ahí.

Lo que sí está escrito es lo que necesita tu sitio: que dejes rastrear a OAI-SearchBot y que tu hosting o tu CDN acepten el tráfico desde las IP que OpenAI publica. Si bloqueas a OAI-SearchBot, tu sitio no sale en las respuestas de búsqueda de ChatGPT, y aun con todo en orden OpenAI aclara que el puesto no está garantizado. Por eso conviene hacer las dos cosas: estar bien indexado en Bing y dejar pasar al bot de OpenAI. Cómo dejarlo pasar está en [qué bots de IA visitan mi web](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar).

## ¿Qué hace Bing Webmaster Tools por mí?

Es el panel gratis de Bing para ver cómo te rastrea y te indexa. Lo que más sirve:

- **Agregar tu sitio.** Si ya lo tienes verificado en Google Search Console, lo importas y queda verificado solo, con sus sitemaps. Si no, lo verificas con un archivo XML en la raíz, una etiqueta meta o un registro CNAME en tu DNS. Bing dice que después de agregarlo suele tardar 48 horas en generar los datos del sitio, y esa cifra se refiere a los informes del panel, porque para la indexación no da ninguna.
- **Inspección de URL.** Te dice si una página está en el índice, cuándo la descubrió, la rastreó y la indexó, qué errores encontró y qué ve Bingbot al bajarla. Desde ahí pides la indexación cuando arreglas algo.
- **Enviar URLs a mano.** Hasta 10.000 URLs por dominio al día. Bing aclara que enviar la misma URL varias veces no acelera la indexación.
- **Pestaña IndexNow.** Muestra los avisos de IndexNow que le llegan de tu sitio.

Bing recomienda IndexNow por encima del envío manual y de su API de envío, que todavía funcionan pero podrían dejar de existir.

## ¿Qué es IndexNow y qué buscadores lo usan?

Es un protocolo abierto para avisarles a los buscadores que una URL se agregó, cambió o se borró, sin esperar a que pasen a revisarla. Según [indexnow.org](https://www.indexnow.org/), lo soportan Microsoft Bing, Naver, Seznam.cz, Yandex y Yep, y los buscadores que lo adoptan se comparten entre sí las URLs que reciben, así que con un aviso les llegas a todos. Google no está en esa lista.

Funciona así: publicas un archivo de texto con una clave (de 8 a 128 caracteres) en la raíz de tu sitio y, cada vez que algo cambia, mandas un POST a `api.indexnow.org/indexnow` con tu host, la clave y la lista de URLs, hasta 10.000 por envío. La respuesta te dice qué pasó:

| Respuesta | Qué quiere decir |
| --- | --- |
| 200 | El buscador recibió las URLs |
| 202 | Las recibió y la clave todavía se está validando |
| 403 | No encontró la clave o el archivo no la tiene |
| 422 | Las URLs no son de tu host o la clave no cumple el formato |
| 429 | Demasiados avisos, puede tomarlos como spam |

Un 200 solo dice que el aviso llegó. Bing lo deja claro en su [guía para empezar](https://www.bing.com/indexnow/getstarted): usar IndexNow no garantiza que tus páginas se rastreen ni se indexen, y el cambio puede tardar en verse. La misma guía dice que Wix Studio, Duda, GoDaddy, XenForo, Milestone y Shopify ya lo traen integrado, y Cloudflare lo ofrece con Crawler Hints.

## ¿Qué hace Peaje con IndexNow?

Peaje hace una cosa puntual con IndexNow: genera una clave de IndexNow para tu negocio y la sirve en tu dominio, en `/.well-known/peaje-indexnow.txt`, a través del proxy del kit. Cada vez que creas, editas o borras una ruta de API con precio, o creas, importas o borras links con precio (desde tu panel, por la API o al aprobar un cambio que te propone el agente), Peaje le manda a IndexNow dos URLs de tu dominio: tu portal de desarrolladores (`/developers`) y tu tabla de precios (`/pricing.md`), para que se rastreen de nuevo con los precios nuevos. Solo lo hace si tu sitio tiene un dominio público, y si el proxy del kit no está puesto la clave no responde, el aviso se rechaza y no se rompe nada.

Lo que Peaje no hace: no avisa por el resto de tus páginas (portada, blog, productos), no te registra en Bing Webmaster Tools y no le avisa a Google. Para tus páginas, publica tu propia clave en la raíz de tu sitio, como recomienda la [documentación de IndexNow](https://www.indexnow.org/documentation), porque una clave guardada en una carpeta solo cubre las URLs de esa carpeta.

## ¿Qué pasos sigo para que Bing y ChatGPT me encuentren?

1. **Abre la puerta.** En tu robots.txt deja pasar a OAI-SearchBot, no bloquees a Bingbot y pon la dirección de tu sitemap. Después revisa que tu firewall o tu CDN no los frenen.
2. **Registra tu sitio en Bing Webmaster Tools.** Importarlo desde Google Search Console es lo más rápido, y trae tus sitemaps.
3. **Prende IndexNow para tus páginas.** Si tu CMS o tu CDN lo traen, actívalo ahí. Si no, publica tu clave en la raíz y avisa cada vez que publiques o cambies una página.
4. **Revisa lo importante a mano.** Con la inspección de URL confirma que tus páginas principales están indexadas, y en la pestaña IndexNow que los avisos están llegando.
5. **Mira quién entra.** El registro de visitas de agentes de Peaje, gratis, te muestra si OAI-SearchBot y los demás bots de IA leen tus páginas cuando tienes el proxy del kit instalado. Para las personas que llegan desde ChatGPT, mira [cómo ver ese tráfico en Google Analytics](https://usepeaje.com/blog/como-veo-cuanto-trafico-me-manda-chatgpt-en-google-analytics).

Que te indexen es el primer paso, y después ChatGPT tiene que entender qué vendes para citarte. El [radar gratis](https://usepeaje.com/radar) te dice en menos de un minuto qué ve un agente cuando llega a tu sitio, y si ya te indexan y aun así no te nombran, revisa [por qué ChatGPT no te nombra](https://usepeaje.com/blog/mi-web-funciona-pero-chatgpt-no-me-nombra-por-que).

## Fuentes

- [OpenAI: bots y user-agents](https://developers.openai.com/api/docs/bots)
- [OpenAI: búsqueda en la web con ChatGPT](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt)
- [IndexNow: qué es y quién lo soporta](https://www.indexnow.org/)
- [IndexNow: documentación del protocolo](https://www.indexnow.org/documentation)
- [Bing: cómo agregar IndexNow](https://www.bing.com/indexnow/getstarted)
- [Bing Webmaster Tools: agregar y verificar un sitio](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b)
- [Bing Webmaster Tools: envío de URLs](https://www.bing.com/webmasters/help/url-submission-62f2860b)
- [Bing Webmaster Tools: inspección de URL](https://www.bing.com/webmasters/help/url-inspection-55a30305)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
