---
title: "¿Cómo les cobro a los bots de IA que leen mi contenido?"
description: Las dos formas que existen hoy de cobrarles a los bots y agentes de IA (pay per crawl de Cloudflare y los pagos por HTTP 402 con x402 y MPP), en qué se diferencian y qué conviene no cobrar.
date: 2026-11-03
slug: como-les-cobro-a-los-bots-de-ia-que-leen-mi-contenido
lang: es
categoria: Guía
portada: 4
portada_titulo: Cobrarles a los bots
traduccion: how-do-i-charge-ai-bots-that-read-my-content
---

# ¿Cómo les cobro a los bots de IA que leen mi contenido?

Hoy hay dos formas, y las dos usan la respuesta `402 Payment Required`. Con pay per crawl de Cloudflare pones un precio por pedido para todo tu sitio y Cloudflare les cobra a los bots que se registraron con ella. Con x402 y MPP le pones precio a un link o a una ruta y el agente te paga directo, con dólares digitales, sin cuenta ni registro. Antes de cobrar, deja abiertas las páginas que quieres que la IA cite, porque un bot que no paga tampoco te cita.

Actualizado: noviembre de 2026

Con Peaje, ponerle precio a un link es gratis y te quedas con el 98% de cada pago, que llega a tu wallet en la misma transacción, según la [página de precios](https://usepeaje.com/precios).

## ¿En qué se diferencian las dos formas?

| | Pay per crawl de Cloudflare | x402 y MPP con Peaje |
| --- | --- | --- |
| Quién lo ofrece | Cloudflare, anunciado en julio de 2025 como beta privada | Peaje, con links y rutas con precio |
| Qué cobras | Un mismo precio por pedido en todo tu sitio | Un precio por cada link o ruta que elijas |
| Quién puede pagar | Los bots que se registraron con Cloudflare y firman sus pedidos | Cualquier agente con una wallet que hable x402 o MPP |
| Cómo te llega la plata | Cloudflare les cobra y te reparte lo recaudado | USDC en Arbitrum o pathUSD en Tempo, directo a tu wallet, menos el 2% |
| Qué necesitas | Tu sitio en Cloudflare | Una cuenta gratis en Peaje |

En pay per crawl, además de cobrar, puedes dejar pasar gratis a un bot o bloquearlo, uno por uno ([anuncio de Cloudflare](https://blog.cloudflare.com/introducing-pay-per-crawl/)). Desde julio de 2025, Cloudflare también les pregunta a los dominios nuevos si quieren dejar pasar a los crawlers de IA, así que si tu sitio está ahí, revisa qué elegiste.

## ¿Qué conviene no cobrar?

No conviene cobrar las páginas con las que quieres que te recomienden. Un bot de búsqueda que recibe un 402 y no paga se va sin leer nada, igual que si lo bloquearas, y una página que no lee no la puede citar. Por eso el orden que recomendamos es este: tus páginas públicas abiertas para los bots que citan ([cuáles son](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar)), y precio solo en lo que de verdad vendes, como un reporte, un PDF, un dataset o una consulta a tu API.

Si lo que te molesta es que entrenen modelos con tu contenido, eso se resuelve sin cobrar: puedes bloquear a los bots de entrenamiento en tu robots.txt y dejar pasar a los de búsqueda. El kit de Peaje trae esa opción, que bloquea a GPTBot, ClaudeBot, Google-Extended, Applebot-Extended y CCBot sin tocar a los que citan.

## ¿Cómo le pongo precio a un link con Peaje?

1. Registra tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo).
2. En tu panel, entra a Rutas, pega la URL pública de lo que quieres cobrar y ponle precio en dólares. También puedes importar tu sitemap y elegir qué páginas cobrar.
3. El link queda en `api.usepeaje.com/tu-negocio/r/el-link`, y con el kit instalado, en tu propio dominio. Aparece en tu llms.txt, tu openapi.json y tu servidor MCP para que los agentes lo encuentren.
4. Entra a Ingresos y toca "Activar cobros". Mientras estén apagados, los agentes usan gratis tus links con precio.

Tu página original sigue igual: el link con precio es una puerta aparte para los agentes que quieren lo que vendes.

## ¿Qué ve un agente cuando llega a un link con precio?

Recibe un 402 con una oferta por cada red donde puede pagar, en los dos formatos, x402 y MPP. Paga desde su wallet, repite el pedido con el pago y recibe el contenido junto con un recibo. Si no paga, no recibe nada. Lo contamos paso a paso en [cómo le paga un agente de IA a mi sitio](https://usepeaje.com/blog/como-le-paga-un-agente-de-ia-a-mi-sitio-y-donde-recibo-el-pago), y la diferencia entre los dos formatos en [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-cual-protocolo-de-pago-para-agentes-de-ia-deberia-usar).

## ¿Cuánto cobro?

Depende de lo que vendes y de cuánto le ahorra al agente. Para empezar, pon un precio bajo en una sola cosa, mira en "Visitas de agentes" quiénes la piden y en Ingresos cuántos pagan, y ajusta. Si le pones precio 0, el link queda gratis, y eso sirve para una muestra.

## Fuentes

- [Cloudflare: Introducing pay per crawl](https://blog.cloudflare.com/introducing-pay-per-crawl/)
- [Cloudflare: bloqueo de crawlers de IA por defecto](https://www.cloudflare.com/press/press-releases/2025/cloudflare-just-changed-how-ai-crawlers-scrape-the-internet-at-large/)
- [x402](https://www.x402.org/)
- [Precios de Peaje](https://usepeaje.com/precios)
