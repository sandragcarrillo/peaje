---
title: "¿Qué es x402 y cómo funciona el pago de un agente de IA con HTTP 402?"
description: Qué es x402, quién lo creó y quién lo gobierna hoy, qué viaja en las cabeceras de la versión 2, cómo funcionan el esquema exact y el facilitador, qué es el Bazaar y cómo lo ofrece Peaje.
date: 2026-11-07
slug: que-es-x402-y-como-funciona-el-pago-de-un-agente-de-ia-con-http-402
lang: es
categoria: Guía
portada: 4
portada_titulo: Qué es x402
traduccion: what-is-x402-and-how-does-an-ai-agent-pay-with-http-402
---

# ¿Qué es x402 y cómo funciona el pago de un agente de IA con HTTP 402?

x402 es un estándar abierto para que un agente de IA pague por un recurso dentro de la misma petición HTTP, con stablecoins y sin cuenta ni clave de API. Lo creó Coinbase en mayo de 2025, y hoy lo custodia la x402 Foundation, que funciona dentro de la Linux Foundation. Tu sitio contesta `402` con sus condiciones en la cabecera `PAYMENT-REQUIRED`, el agente firma el pago y lo manda en `PAYMENT-SIGNATURE`, y recibe el recurso con el resultado del cobro en `PAYMENT-RESPONSE`.

Actualizado: noviembre de 2026

Según la [documentación de Coinbase Developer Platform](https://docs.cdp.coinbase.com/x402/welcome), su servicio ya procesó más de 100 millones de pagos x402 en Base y Solana.

## ¿Quién creó x402 y quién lo gobierna hoy?

Coinbase lo empezó, y en menos de un año pasó a una fundación neutral:

| Fecha | Qué pasó |
| --- | --- |
| Mayo de 2025 | Coinbase lanza x402 |
| 23 de septiembre de 2025 | Cloudflare y Coinbase anuncian la x402 Foundation |
| 9 de diciembre de 2025 | Sale la versión 2 de la especificación |
| 2 de abril de 2026 | La Linux Foundation anuncia que lanza la x402 Foundation y recibe el protocolo que aporta Coinbase |
| 14 de julio de 2026 | La fundación arranca operaciones con 40 organizaciones miembro |

La especificación y el código de referencia están en GitHub con licencia Apache 2.0, ahora en la cuenta de la fundación. Ya no depende de una sola empresa, y cualquiera puede implementarlo sin pedir permiso. Cómo se compara con el protocolo de Stripe y Tempo está en [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-cual-protocolo-de-pago-para-agentes-de-ia-deberia-usar).

## ¿Qué viaja en las cabeceras de la versión 2?

La versión 2 pasó todos los datos de pago a cabeceras y dejó atrás las de la versión 1, `X-PAYMENT` y `X-PAYMENT-RESPONSE`. Las tres cabeceras nuevas llevan JSON codificado en base64:

| Cabecera | Quién la manda | Qué lleva |
| --- | --- | --- |
| `PAYMENT-REQUIRED` | Tu sitio, junto con el 402 | El recurso y una lista `accepts` con cada forma de pago: esquema, red, monto, moneda, a quién se paga y cuántos segundos vale la oferta |
| `PAYMENT-SIGNATURE` | El agente, cuando repite el pedido | La oferta que eligió y su pago firmado |
| `PAYMENT-RESPONSE` | Tu sitio, junto con el recurso | Si el cobro salió bien, la red, quién pagó y la transacción |

Las redes se escriben en formato CAIP-2, que pone primero la familia y después el número de la cadena, por ejemplo `eip155:42161` para Arbitrum One. El monto va en la unidad mínima de la moneda, así que con USDC, que tiene 6 decimales, `10000` es un centavo. La versión 2 también formalizó las extensiones, que permiten sumar funciones sin cambiar el protocolo base, y las librerías oficiales siguen entendiendo a los clientes de la versión 1. Qué es el 402 en sí y qué recibe un agente que no paga está en [qué es el código 402](https://usepeaje.com/blog/que-es-el-codigo-402-payment-required-y-que-pasa-si-un-agente-pide-sin-pagar).

## ¿Cómo funcionan el esquema "exact" y el facilitador?

`exact` es el esquema para cobrar un monto fijo, como un centavo por consulta. En redes compatibles con Ethereum, el agente firma una autorización de transferencia por el monto y la dirección exactos de la oferta, y la transacción la manda otro. Con USDC esa autorización usa EIP-3009, la función `transferWithAuthorization` que el token ya trae. Quien recibe la firma la envía a la red y paga el gas, así que el agente no necesita tener ETH. Para tokens sin EIP-3009, la especificación usa Permit2, que pide una aprobación previa del agente.

El facilitador es el servidor que hace esa parte por tu sitio: revisa la firma (`/verify`) y liquida el pago en la red (`/settle`), en una o varias redes. La especificación dice que el facilitador no puede cambiar el monto ni el destino, y que su papel se limita a enviar la transacción. Tu sitio puede usar uno externo, como el de Coinbase, o hacerlo por su cuenta.

Además de `exact`, la especificación define `upto`, que autoriza hasta un tope y cobra lo que se usó, y `batch-settlement`, que en redes EVM junta muchos cobros chicos para liquidarlos en lote.

## ¿Qué es el Bazaar de x402?

Es la forma de descubrir qué servicios cobran con x402. En la especificación, `bazaar` es una extensión: tu servidor describe el endpoint en el 402 (método, parámetros y qué devuelve), y los facilitadores que la soportan lo catalogan y lo publican en `GET /discovery/resources` y `GET /discovery/search`. Coinbase tiene el suyo y lo define como un catálogo de servicios con cobro que descubre su facilitador. Para un agente, funciona como un buscador de APIs pagas: encuentra la URL, ve el precio y paga sin registrarse. Hay otras formas de que te encuentren, y las juntamos en [cómo encuentran los agentes de IA mi API](https://usepeaje.com/blog/como-encuentran-los-agentes-de-ia-mi-api).

## ¿Cómo ofrece x402 Peaje?

Cada ruta o link con precio contesta un 402 con ofertas MPP y, en la misma respuesta, la cabecera `PAYMENT-REQUIRED` en formato x402 versión 2. La oferta x402 hoy es una sola:

- **Red y moneda:** USDC en Arbitrum One (`eip155:42161`), con el esquema `exact` y autorización EIP-3009. El pago en pathUSD en Tempo sale solo como oferta MPP ([qué es MPP](https://usepeaje.com/blog/que-es-mpp-el-protocolo-de-pagos-de-stripe-y-tempo-para-agentes-de-ia)).
- **A quién se paga:** al contrato de Peaje, que en la misma transacción manda el 98% a la wallet de tu negocio y el 2% a Peaje ([cuánto se queda Peaje](https://usepeaje.com/blog/cuanto-se-queda-peaje-de-cada-pago-de-un-agente-de-ia)).
- **Monto:** el precio más el costo de red, que nunca pasa de US$0,02, porque Peaje envía la transacción y paga el gas.
- **Facilitador:** Peaje cumple ese papel sin usar uno externo: revisa la firma, le pide la respuesta a tu sitio antes de cobrar y, si el pago sale, entrega el recurso con `PAYMENT-RESPONSE`.
- **Catálogo:** tu dominio sirve `/discovery/resources` con la forma del Bazaar, una entrada por cada URL que cobra y las mismas condiciones que trae su 402. Como los pagos no pasan por el facilitador de Coinbase, tus rutas no se suman solas a su Bazaar.

En "Visitas de agentes" ves aparte a los clientes x402 y el "Embudo de cobro": 402 servidos, cuántos agentes volvieron con un pago y cuántos pagaron. Los cobros vienen apagados y los prendes en Ingresos con "Activar cobros". Antes de eso, el [radar gratis](https://usepeaje.com/radar) te dice si tu sitio ya responde x402 y MPP.

## Fuentes

- [x402.org: lanzamiento de la versión 2](https://x402.org/x402-v2-launch/)
- [Especificación de x402, versión 2](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md)
- [x402: transporte HTTP de la versión 2](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md)
- [x402: esquema exact en redes EVM](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md)
- [x402: extensión bazaar](https://github.com/x402-foundation/x402/blob/main/specs/extensions/bazaar.md)
- [Coinbase Developer Platform: x402](https://docs.cdp.coinbase.com/x402/welcome)
- [Coinbase Developer Platform: Bazaar](https://docs.cdp.coinbase.com/x402/bazaar)
- [Cloudflare: Cloudflare y Coinbase lanzarán la x402 Foundation](https://www.cloudflare.com/press/press-releases/2025/cloudflare-and-coinbase-will-launch-x402-foundation/)
- [Linux Foundation: lanzamiento de la x402 Foundation](https://www.linuxfoundation.org/press/linux-foundation-is-launching-the-x402-foundation-and-welcoming-the-contribution-of-the-x402-protocol)
- [x402.org: lanzamiento operativo de la x402 Foundation](https://x402.org/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications/)
- [Precios de Peaje](https://usepeaje.com/precios)
