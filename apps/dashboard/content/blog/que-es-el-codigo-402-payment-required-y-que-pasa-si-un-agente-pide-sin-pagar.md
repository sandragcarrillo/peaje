---
title: "¿Qué es el código 402 Payment Required y qué pasa si un agente pide sin pagar?"
description: Qué significa la respuesta HTTP 402, por qué estuvo reservada casi 30 años, cómo la usan hoy x402 y MPP para cobrarles a los agentes de IA y qué recibe un agente que llega sin pagar.
date: 2026-11-05
slug: que-es-el-codigo-402-payment-required-y-que-pasa-si-un-agente-pide-sin-pagar
lang: es
categoria: Guía
portada: 4
portada_titulo: El código 402
traduccion: what-is-402-payment-required-and-what-happens-when-an-agent-asks-without-paying
---

# ¿Qué es el código 402 Payment Required y qué pasa si un agente pide sin pagar?

El 402 Payment Required es la respuesta de HTTP que dice "esto cuesta, paga primero". Estuvo reservada sin un uso definido desde los primeros estándares de la web, y hoy la usan x402 y MPP para que un agente de IA pague por un recurso sin cuenta ni clave de API. Si un agente pide algo con precio sin pagar, recibe el 402 con el precio y las formas de pago, y nada más: el contenido solo sale cuando repite el pedido con un pago válido.

Actualizado: noviembre de 2026

Según [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402), el 402 sigue siendo un código no estándar, "reservado para uso futuro", y los navegadores lo muestran como un error 4xx genérico. Por eso un 402 le sirve a un agente y no a una persona que navega.

## ¿Por qué estuvo tantos años sin usarse?

Los autores de HTTP lo dejaron reservado pensando en el dinero digital y los micropagos, pero nunca definieron cómo se pagaba. Sin un formato común, cada sitio cobraba con su propio checkout y su propio registro, y el 402 quedó vacío. Los agentes de IA cambiaron eso, porque un agente no puede llenar un formulario de tarjeta, pero sí puede leer un precio en una cabecera y firmar un pago con una wallet.

## ¿Cómo lo usan hoy x402 y MPP?

Los dos siguen el mismo ciclo:

1. El agente pide el recurso.
2. El sitio contesta 402 con el precio, la moneda y a dónde va el pago.
3. El agente paga y repite el pedido con la prueba de pago.
4. El sitio verifica el pago y entrega el recurso con un recibo.

La diferencia está en las cabeceras. MPP pone cada oferta en `WWW-Authenticate: Payment` y el agente vuelve con `Authorization: Payment`, y x402 usa `PAYMENT-REQUIRED` y el agente vuelve con `PAYMENT-SIGNATURE`. Los comparamos en [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-cual-protocolo-de-pago-para-agentes-de-ia-deberia-usar), y MPP tiene su propia guía en [qué es MPP](https://usepeaje.com/blog/que-es-mpp-el-protocolo-de-pagos-de-stripe-y-tempo-para-agentes-de-ia).

## ¿Qué recibe un agente que llega sin pagar?

Con Peaje, una ruta o un link con precio contesta así (los valores van recortados):

```
HTTP/2 402
content-type: application/problem+json
cache-control: no-store
www-authenticate: Payment id="…", realm="…", method="evm", intent="charge", request="…", expires="…"
www-authenticate: Payment id="…", realm="…", method="tempo", intent="charge", request="…", expires="…"
payment-required: …

{"type":"https://paymentauth.org/problems/payment-required","title":"Payment Required","status":402,"detail":"Payment is required (Reporte 2026).", …}
```

- Hay una oferta `WWW-Authenticate` por red: USDC en Arbitrum y pathUSD en Tempo.
- `payment-required` lleva la oferta de Arbitrum en formato x402.
- Cada oferta vence a los 5 minutos, y `cache-control: no-store` evita que un intermediario guarde la respuesta.
- El cuerpo explica en texto qué falta, para el agente que no sabe leer las cabeceras de pago.

El contenido no sale en ningún caso: sin pago, el agente se queda con el 402.

## ¿Y si el pago falla o mi sitio se cae?

Hay casos en que la respuesta no es un 402:

| Caso | Qué recibe el agente |
| --- | --- |
| Los cobros están apagados | El contenido gratis, sin 402 |
| Tu sitio falla tres veces en diez minutos | Un 503 por quince minutos, y te avisamos |
| Tu sitio falla después de un pago en Arbitrum | Nada que devolver, porque Peaje le pide la respuesta a tu sitio antes de cobrar |
| Tu sitio falla después de un pago en Tempo | La devolución del pago, con su transacción en la cabecera `Payment-Refund` |

Cuando el pago sale bien, el agente recibe un 200 con el contenido y un recibo en la cabecera `Payment-Receipt`, con la red y la transacción.

## ¿Cómo sé si los agentes pagan después del 402?

En Peaje, la página "Visitas de agentes" tiene un "Embudo de cobro" con tres números: los 402 servidos, cuántos agentes volvieron con un pago y cuántos pagaron. Si casi ninguno vuelve, lo más probable es que el agente no entendió la oferta, por una descripción confusa o una cabecera que no sabe leer. Si vuelven con un pago que no se completa, revisa la red y la moneda que ofreces, porque el agente ya entendió el precio. Las rutas con precio son gratis en todos los planes, y Peaje se queda el 2% de cada pago, según la [página de precios](https://usepeaje.com/precios).

## Fuentes

- [MDN: 402 Payment Required](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402)
- [RFC 9110: HTTP Semantics, 402](https://httpwg.org/specs/rfc9110.html#status.402)
- [x402](https://www.x402.org/)
- [mpp.dev: resumen del protocolo](https://mpp.dev/overview)
- [Precios de Peaje](https://usepeaje.com/precios)
