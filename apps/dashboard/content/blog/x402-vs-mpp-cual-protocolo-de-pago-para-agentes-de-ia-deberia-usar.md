---
title: "x402 vs MPP: ¿cuál protocolo de pago para agentes de IA debería usar?"
description: Qué es x402, qué es MPP, en qué se diferencian y por qué no tienes que elegir uno si tu sitio puede ofrecer los dos en la misma respuesta.
date: 2026-10-28
slug: x402-vs-mpp-cual-protocolo-de-pago-para-agentes-de-ia-deberia-usar
lang: es
categoria: Guía
portada: 4
portada_titulo: x402 vs MPP
traduccion: x402-vs-mpp-which-payment-protocol-for-ai-agents-should-i-use
---

# x402 vs MPP: ¿cuál protocolo de pago para agentes de IA debería usar?

Si puedes, no elijas: ofrece los dos en la misma respuesta y deja que el agente pague con el que sabe usar. x402 y MPP resuelven lo mismo, que un agente te pague sin que intervenga una persona, y los dos usan la respuesta HTTP 402 "Payment Required", pero cada agente habla uno u otro. Peaje responde con los dos en el mismo 402, y hoy funcionan en redes de prueba, así que todavía no mueven dinero real.

Actualizado: octubre de 2026

Cuando haya pagos reales, Peaje se queda con el 2% de cada pago y el resto va a la wallet de tu negocio, según la [página de inicio](https://usepeaje.com/).

## ¿Qué es x402?

Es un estándar abierto que creó Coinbase. Cuando un agente pide algo que cuesta, tu sitio le contesta 402 con el precio, el agente paga y repite el pedido con el pago adjunto. Se paga con stablecoins en redes como Base o Solana, con una wallet y sin cuenta ni clave de API, y un servicio llamado facilitador revisa y liquida cada pago. Desde septiembre de 2025 lo impulsa la x402 Foundation, que Coinbase lanzó junto con Cloudflare.

## ¿Qué es MPP?

MPP (Machine Payments Protocol) lo lanzaron Stripe y Tempo el 18 de marzo de 2026, y está escrito como borrador en la IETF, el grupo que define los estándares de internet, con el nombre "The Payment HTTP Authentication Scheme". Usa las cabeceras de autenticación que HTTP ya tenía, y en un mismo 402 tu sitio puede ofrecer varias formas de pago: stablecoins en Tempo, tarjetas por Stripe o Lightning. Además del pago por pedido, permite sesiones, en las que el agente va pagando por uso y se liquida todo junto al final.

## ¿En qué se diferencian?

| | x402 | MPP |
| --- | --- | --- |
| Quién lo creó | Coinbase, hoy con la x402 Foundation | Stripe y Tempo, borrador en la IETF |
| Cómo viaja el precio | Cabeceras propias de x402 | `WWW-Authenticate: Payment`, la cabecera estándar de HTTP |
| Formas de pago | Stablecoins en redes compatibles con Ethereum y en Solana | Stablecoins en Tempo, tarjetas por Stripe, Lightning y otras |
| Cobro por uso | Por pedido, y las sesiones las agrega cada implementación | Por pedido o por sesión |

## Entonces, ¿cuál uso?

Depende de quién te va a pagar. Si tus compradores son agentes que ya tienen una wallet con USDC en Base, x402 es el camino directo. Si vendes algo de uso frecuente, como una API que se consulta cientos de veces, las sesiones de MPP te ahorran liquidar cada pedido por separado. Como no sabes de antemano qué agente va a llegar, lo más seguro es contestar con los dos, y eso hace Peaje: cada 402 trae una oferta `WWW-Authenticate: Payment` por red, que es MPP, y la cabecera `Payment-Required` con los mismos términos en formato x402.

## ¿Qué hago antes de cobrar?

El cobro es el último paso. Antes, un agente tiene que encontrarte, entender qué vendes y a qué precio, y poder usarte sin trabarse, porque si ChatGPT o Claude no entienden tu sitio, no llegan a pedirte nada. Empieza con el [radar gratis](https://usepeaje.com/radar), que en menos de un minuto te muestra lo que ve un agente cuando llega, y sigue con el kit gratis: registras tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo) y desde tu panel lo instalas pegándole un texto a tu herramienta de IA o con `npx @peaje/cli@1 init <slug>`. Cobrar es opcional, y puedes usar todo lo demás sin poner precio a nada.

## ¿Qué pasa si elijo mal?

No quedas atado. Las páginas y los arreglos que te deja tu agente sirven igual con cualquier protocolo, y con Peaje no tienes que cambiar nada en tu sitio si mañana los agentes prefieren uno de los dos.

## Fuentes

- [Borrador de MPP en la IETF: The Payment HTTP Authentication Scheme](https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/)
- [x402: estándar abierto de pagos por HTTP](https://www.x402.org/)
- [Quicknode: x402 vs MPP, cómo funcionan y en qué se diferencian](https://www.quicknode.com/es/blog/x402-vs-mpp)
- [Peaje: cómo funciona y preguntas frecuentes](https://usepeaje.com/)
