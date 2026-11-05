---
title: "¿Qué es MPP, el protocolo de pagos de Stripe y Tempo para agentes de IA?"
description: Qué es el Machine Payments Protocol (MPP), quién lo creó, cómo funciona un pago con la respuesta 402, en qué se pagan los agentes y cómo empiezas a aceptarlo en tu sitio o tu API.
date: 2026-11-05
slug: que-es-mpp-el-protocolo-de-pagos-de-stripe-y-tempo-para-agentes-de-ia
lang: es
categoria: Guía
portada: 4
portada_titulo: Qué es MPP
traduccion: what-is-mpp-the-machine-payments-protocol-from-stripe-and-tempo
---

# ¿Qué es MPP, el protocolo de pagos de Stripe y Tempo para agentes de IA?

MPP (Machine Payments Protocol) es un estándar abierto para que un agente de IA le pague a un sitio o a una API sin pasar por un checkout ni crear una cuenta. Lo escribieron Stripe y Tempo, y lo lanzaron el 18 de marzo de 2026, el mismo día en que salió la red principal de Tempo. Cuando un agente pide algo que cuesta, el sitio le contesta `402 Payment Required` con las formas de pago que acepta, el agente paga, repite el pedido con la prueba de pago y recibe lo que pidió junto con un recibo.

Actualizado: noviembre de 2026

Según el [anuncio de Tempo](https://tempo.xyz/blog/mainnet), el directorio de servicios compatibles con MPP arrancó con más de 100 servicios.

## ¿Cómo funciona un pago con MPP?

En cuatro pasos, todos dentro de HTTP:

1. El agente pide el recurso, por ejemplo `GET /api/reporte`.
2. El sitio le contesta 402 con un desafío por cada forma de pago que acepta, en la cabecera `WWW-Authenticate: Payment`. Cada desafío dice el monto, la moneda y a dónde va el pago.
3. El agente elige una forma de pago, la autoriza y repite el pedido con la credencial de pago.
4. El sitio verifica el pago y entrega el recurso con un recibo.

El agente no necesita clave de API ni usuario, porque el pago hace de credencial. Esto lo diferencia de una suscripción: cada pedido se puede cobrar por separado, aunque sea de un centavo.

## ¿Quién está detrás de MPP?

Stripe y Tempo, que es una red de pagos incubada por Stripe y Paradigm. La especificación está publicada como borrador en la IETF, el grupo que define los estándares de internet, con el nombre "The Payment HTTP Authentication Scheme", y entre sus autores hay gente de Tempo y de Stripe. Que sea un borrador quiere decir que todavía puede cambiar y que la IETF no lo ha aprobado como estándar.

## ¿Con qué pagan los agentes?

MPP no está atado a una sola forma de pago. Cada una se define en su propia especificación, y el mismo 402 puede ofrecer varias:

| Forma de pago | Cómo llega |
| --- | --- |
| Stablecoins en Tempo | El agente paga desde su wallet en la red de Tempo |
| Tarjetas por Stripe | Con tokens de pago compartidos (Shared Payment Tokens) que emite el agente |
| Otras redes | Cada implementación agrega las suyas, por ejemplo redes compatibles con Ethereum |

Tempo también contó que Visa extendió MPP a pagos con tarjeta en su red y que Lightspark lo llevó a Bitcoin por Lightning.

Además del cobro por pedido, MPP permite sesiones: el agente autoriza una vez, aparta un monto y va pagando a medida que usa el servicio, y los pagos chicos se liquidan juntos en una sola transacción. Sirve para APIs que se consultan cientos de veces.

## ¿En qué se diferencia de x402?

Los dos usan la respuesta 402 y resuelven lo mismo. x402 lo creó Coinbase y viaja en cabeceras propias, y MPP usa las cabeceras de autenticación que HTTP ya tenía y acepta formas de pago fuera de la blockchain, como tarjetas. Cada agente habla uno u otro, así que lo más seguro es responder con los dos en el mismo 402. Los comparamos con más detalle en [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-cual-protocolo-de-pago-para-agentes-de-ia-deberia-usar).

## ¿Cómo empiezo a aceptar MPP?

Tienes dos caminos:

- **Con Stripe.** Si ya cobras con Stripe, su [guía de MPP](https://docs.stripe.com/payments/machine/mpp) usa la librería `mppx` y registra cada pago como un PaymentIntent. Acepta tarjetas desde US$0,50 por pago y stablecoins desde 0,01 USDC, que Stripe convierte y deja en tu saldo de Stripe. Revisa la disponibilidad para tu país en la misma guía.
- **Con Peaje.** Le pones precio a un link o a una ruta de tu API desde tu panel, gratis, y cada 402 sale con ofertas MPP para USDC en Arbitrum y pathUSD en Tempo, y con los mismos términos en formato x402. El pago llega a la wallet de tu negocio en la misma transacción, menos el 2% de Peaje ([cómo funciona](https://usepeaje.com/blog/como-le-paga-un-agente-de-ia-a-mi-sitio-y-donde-recibo-el-pago)).

Antes de cobrar, revisa que los agentes te encuentren y entiendan qué vendes. El [radar gratis](https://usepeaje.com/radar) te dice en menos de un minuto qué ve un agente cuando llega a tu sitio, y también revisa si aceptas algún protocolo de pago.

## Fuentes

- [Tempo: lanzamiento de la red principal y de MPP](https://tempo.xyz/blog/mainnet)
- [mpp.dev: resumen del protocolo](https://mpp.dev/overview)
- [IETF: The Payment HTTP Authentication Scheme](https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/)
- [Stripe: aceptar pagos de agentes con MPP](https://docs.stripe.com/payments/machine/mpp)
- [Precios de Peaje](https://usepeaje.com/precios)
