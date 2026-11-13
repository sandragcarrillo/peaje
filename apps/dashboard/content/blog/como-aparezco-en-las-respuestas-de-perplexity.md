---
title: "¿Cómo aparezco en las respuestas de Perplexity?"
description: Qué pide Perplexity en su propia documentación para que tu sitio salga en sus respuestas, cómo dejas pasar a PerplexityBot por tu firewall, qué no publica sobre cómo elige sus fuentes y qué hace Peaje y qué no.
date: 2026-11-13
slug: como-aparezco-en-las-respuestas-de-perplexity
lang: es
categoria: Guía
portada: 3
portada_titulo: Citado en Perplexity
traduccion: how-do-i-show-up-in-perplexity-answers
---

# ¿Cómo aparezco en las respuestas de Perplexity?

Perplexity pide poco en su documentación: que dejes pasar a PerplexityBot en tu robots.txt y, si tienes firewall, que permitas su user-agent junto con sus IP. Cada respuesta de Perplexity trae citas numeradas a las fuentes originales, pero Perplexity no publica cómo elige esas fuentes, así que lo que está en tus manos es que su bot pueda leer tu sitio y que tengas una página que responda bien la pregunta de tu cliente.

Actualizado: noviembre de 2026

El 13 de noviembre de 2026, la [lista oficial de IP de PerplexityBot](https://www.perplexity.ai/perplexitybot.json) tenía 13 rangos, con fecha del 28 de octubre de 2026, y la de [Perplexity-User](https://www.perplexity.ai/perplexity-user.json) tenía 10. Esas listas cambian, y por eso la [guía de bots de Perplexity](https://docs.perplexity.ai/guides/bots) recomienda tomarlas siempre de sus archivos oficiales y actualizar tus reglas de firewall de forma automática, en vez de copiarlas a mano una vez.

## ¿Qué bot de Perplexity tiene que poder entrar?

Perplexity tiene dos, y cada uno se controla por separado:

| Bot | Para qué entra | robots.txt |
| --- | --- | --- |
| PerplexityBot | Encuentra y enlaza sitios en los resultados de Perplexity. Perplexity dice que no lo usa para rastrear contenido para entrenar modelos de IA | Lo sigue, y Perplexity recomienda dejarlo pasar para que tu sitio salga en sus resultados |
| Perplexity-User | Abre una página cuando una persona hace una pregunta, y puede enlazarla en la respuesta | Por lo general no lo sigue, porque el pedido viene de una persona |

El que decide si tu sitio entra a sus resultados es PerplexityBot. Perplexity aclara que cada regla de robots.txt funciona por su cuenta, así que bloquear a uno no bloquea al otro, y que sus sistemas pueden tardar hasta 24 horas en reflejar un cambio. El robots.txt listo para copiar, con PerplexityBot y los bots de búsqueda de los demás, está en [qué bots de IA visitan mi web y cómo los dejo pasar](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar).

## ¿Cómo lo dejo pasar si tengo firewall?

Perplexity explica dos casos en su guía, y en los dos combina el user-agent con la IP:

- **Cloudflare:** una regla personalizada que coincida con el user-agent de cada bot y con sus propios rangos de IP, con la acción Skip para las funciones de seguridad que quieras saltar, puesta arriba de cualquier regla que bloquee o desafíe. En los planes pagos puedes guardar los rangos de cada bot en una lista de IP, y Perplexity avisa que el plan gratis permite una sola lista personalizada, que no alcanza para los dos bots.
- **Bot Fight Mode de Cloudflare:** las reglas personalizadas no lo saltan, así que si lo tienes prendido puede seguir desafiando a PerplexityBot aunque tu regla esté bien hecha.
- **AWS WAF:** un conjunto de IP por bot y una regla Allow que exija a la vez esa IP y el user-agent, con un número de prioridad más bajo que tus reglas de bloqueo.

Después de cualquier cambio, Perplexity recomienda revisar tus registros, porque las reglas del firewall tardan en propagarse. Una prueba rápida es pedir tu home con el user-agent de PerplexityBot (`curl -I -A "PerplexityBot/1.0" https://tusitio.com/`) y ver un 200, aunque eso solo descarta los bloqueos por user-agent y no los que miran la IP.

## ¿Qué hace que Perplexity me cite a mí y no a otro?

Perplexity no lo publica. Su [centro de ayuda](https://www.perplexity.ai/help-center/en/articles/10352895-how-does-perplexity-work) dice que busca en internet en tiempo real, reúne información de fuentes como artículos, sitios web y revistas, y que cada respuesta trae citas numeradas a las fuentes originales. No dice qué índice usa, de qué proveedor salen sus resultados ni qué pesa más al elegir una fuente, así que las listas de "factores de Perplexity" que circulan en blogs no salen de Perplexity.

Lo que sí puedes hacer sin adivinar es tener una página por cada pregunta importante de tus clientes, con la respuesta al principio y en texto que esté en el HTML. Perplexity no documenta si su bot ejecuta JavaScript, así que lo seguro es que tu contenido no dependa de él. Qué tipo de página ganó cuando medimos nuestro propio sitio en ChatGPT y Claude está en [qué formato de página citan más ChatGPT y Claude](https://usepeaje.com/blog/que-formato-de-pagina-citan-mas-chatgpt-y-claude-guia-documentacion-o-comparativa), y es una muestra de un solo negocio, sin Perplexity.

## ¿Qué hace Peaje con Perplexity y qué no?

Peaje no mide si Perplexity te cita. El plan Pro mide 20 preguntas de tus clientes cada semana solo en ChatGPT y Claude, y el [radar gratis](https://usepeaje.com/radar) les hace 3 preguntas a ChatGPT y a Claude, así que para Perplexity tienes que hacer tus propias búsquedas y revisar sus fuentes, como explicamos en [cómo sé si ChatGPT, Claude o Perplexity citan mi negocio](https://usepeaje.com/blog/como-se-si-chatgpt-claude-o-perplexity-citan-mi-negocio).

Lo que Peaje sí hace es cuidar que PerplexityBot pueda entrar:

- **El kit** deja permitido a PerplexityBot por nombre en tu robots.txt, junto con Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot y Applebot, y su verificación entra a tu home y a /developers con el user-agent real de PerplexityBot para revisar que no te frene un 403 o un desafío del firewall y que tu home traiga título o encabezado en el HTML.
- **El radar** te avisa si tu robots.txt bloquea a PerplexityBot o a Perplexity-User.
- **Las tareas de arreglo** que Peaje busca cuando se lo pides entran a tu home con el user-agent de PerplexityBot, y si tu robots.txt o tu firewall lo frena, te queda una tarea con el arreglo.
- **El registro de visitas**, gratis con el kit, cuenta a PerplexityBot por nombre, también cuando lee páginas que tu sitio sirve solo.

Si quieres ver la misma guía para Claude, está en [cómo hago que Claude cite mi sitio web](https://usepeaje.com/blog/como-hago-que-claude-cite-mi-sitio-web), y el resumen de los cinco buscadores con IA, en [cómo aparezco en los resultados de búsqueda con IA](https://usepeaje.com/blog/como-aparezco-en-los-resultados-de-busqueda-con-ia).

## Fuentes

- [Perplexity: sus bots y cómo configurar el firewall](https://docs.perplexity.ai/guides/bots)
- [Perplexity: lista de IP de PerplexityBot](https://www.perplexity.ai/perplexitybot.json)
- [Perplexity: lista de IP de Perplexity-User](https://www.perplexity.ai/perplexity-user.json)
- [Perplexity: cómo funciona Perplexity](https://www.perplexity.ai/help-center/en/articles/10352895-how-does-perplexity-work)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
- [Precios de Peaje](https://usepeaje.com/precios)
