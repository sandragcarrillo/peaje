---
title: "¿Cómo pruebo que un agente de IA puede pagarle a mi API antes de lanzarla?"
description: Tres pruebas en orden para saber si un agente de IA puede pagarle a tu API antes de abrirla, revisar el 402 con curl, correr el comprador misterioso de Peaje y hacer un pago real de unos centavos con tu propia wallet.
date: 2026-11-13
slug: como-pruebo-que-un-agente-de-ia-puede-pagarle-a-mi-api-antes-de-lanzarla
lang: es
categoria: Guía
portada: 1
portada_titulo: Probar el cobro
traduccion: how-do-i-test-that-an-ai-agent-can-pay-my-api-before-launch
---

# ¿Cómo pruebo que un agente de IA puede pagarle a mi API antes de lanzarla?

Lo pruebas en tres pasos, de lo más barato a lo más completo: pides tu ruta con `curl` para ver que responda 402 con las ofertas de pago, corres el comprador misterioso de Peaje para ver si un agente te encuentra y si tu paso de pago pasa un cliente estricto, y haces un pago real pequeño desde una wallet tuya. Peaje no tiene una red de prueba en producción, así que ese último paso mueve plata de verdad, aunque sean centavos.

Actualizado: noviembre de 2026

Con una ruta de US$0,01 en Arbitrum, la prueba te cuesta como mucho US$0,0202: pagas el precio más un costo de red que nunca pasa de US$0,02, y el 98% del precio vuelve a tu wallet de cobro. Los dos topes están en el [contrato de Peaje en Arbitrum](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020), que fija la comisión en 200 puntos básicos (2%) y el costo de red máximo en 0,02 USDC por pago.

## ¿Cómo reviso el 402 a mano?

Antes de la primera prueba deja tres cosas listas:

- **Tu wallet de cobro,** elegida en Ingresos. Sin ella tus rutas responden 503 en vez de 402, porque el 98% no tiene a dónde ir.
- **Los cobros activos.** Vienen apagados, y mientras lo estén, tus rutas con precio responden gratis y no hay ningún 402 que probar. Se prenden en Ingresos con "Activar cobros" y valen para todas tus rutas y links con precio a la vez, así que desde ese momento cualquier agente que llegue también paga.
- **El kit en tu dominio,** con `PEAJE_ORIGIN_SECRET` en las variables de tu hosting, como explicamos en [cómo les cobro a los agentes de IA por usar mi API](https://usepeaje.com/blog/como-les-cobro-a-los-agentes-de-ia-por-usar-mi-api).

Si quieres que todo salga barato, publica una ruta con precio de US$0,01 solo para la prueba. Después pide la ruta sin pagar dos veces, en tu dominio y en el gateway de Peaje, que es por donde pasa el cobro aunque el agente no lo vea:

```bash
curl -i https://tudominio.com/api/pronostico/bogota
curl -i https://api.usepeaje.com/<tu-slug>/api/pronostico/bogota
```

En las dos tienes que ver lo mismo:

| Qué miras | Qué tiene que decir |
| --- | --- |
| Estado | `402` |
| `content-type` | `application/problem+json`, con un cuerpo que explica qué falta |
| `cache-control` | `no-store` |
| `www-authenticate` | Una oferta `Payment` por red, en formato MPP |
| `payment-required` | La oferta en formato x402, como JSON en base64 |

Si el gateway responde 402 y tu dominio no, el problema está en tu sitio: el proxy no le pasa esa ruta a Peaje, o un CDN o un middleware quita las cabeceras de pago. Al decodificar `payment-required`, revisa dos cosas que comparan los clientes x402 estrictos: que `x402Version` sea 2 y que `resource.url` nombre tu dominio y no el de Peaje. Qué trae cada cabecera lo explicamos en [qué es el código 402](https://usepeaje.com/blog/que-es-el-codigo-402-payment-required-y-que-pasa-si-un-agente-pide-sin-pagar).

## ¿Qué agrega el comprador misterioso?

Te dice lo que `curl` no puede: si un agente te encontraría y si te elegiría. Está en el plan Pro, cuesta 30 créditos y lo corres desde Mi agente con "Probar ahora" o pidiéndoselo al agente en el chat. Recibe tres pedidos que tu negocio debería ganar, busca en el directorio de Peaje, el Bazaar de x402 y los registros de ERC-8004, y anota si te encontró, en qué puesto, a quién eligió y por qué. Después pide sin pagar tu primera ruta GET con precio (o tu primer link, si no tienes rutas), en tu dominio y en el gateway, y la revisa como un cliente estricto. Necesita al menos una ruta o un link con precio, y cómo decide lo contamos en [cómo elige un agente de IA comprador a qué negocio comprarle](https://usepeaje.com/blog/como-elige-un-agente-de-ia-comprador-a-que-negocio-comprarle).

Antes de lanzar te sirve por tres razones:

- Separa lo tuyo de lo de Peaje. Lo que se arregla en tu sitio queda como tarea, que se cierra sola cuando la siguiente prueba ya no ve el problema, y lo que es del gateway sale marcado con "Del lado de Peaje, no tienes que hacer nada".
- Sus pedidos no cuentan en Visitas de agentes, así que no te inflan el embudo de cobro.
- Si la prueba falla, o la pides antes de que pasen 6 horas desde la anterior, te devuelve los créditos.

Tiene un límite que conviene saber: nunca paga, así que no te prueba que la plata llegue a tu wallet. Para eso está el paso siguiente.

## ¿Cómo hago un pago real de prueba?

Pagas tú, como lo haría un agente, desde una wallet distinta de tu wallet de cobro. El gateway de Peaje corre en la red principal, como muestra su [estado público](https://api.usepeaje.com/health), así que necesitas USDC en Arbitrum One o pathUSD en Tempo. En Arbitrum no te hace falta ETH para el gas, porque firmas una autorización por el precio más el costo de red y Peaje envía la transacción. En Tempo pagas el gas en tu propia transacción.

Para pagar, usa un cliente oficial en vez de armar las cabeceras a mano:

- **MPP:** `mppx`, la librería de [mpp.dev](https://mpp.dev/quickstart/client), con métodos de pago para Tempo y para redes EVM. Es la que usa Peaje en sus propios scripts de compra.
- **x402:** `@x402/fetch` (o `@x402/axios`) junto con `@x402/evm`, los paquetes del [quickstart para compradores de x402](https://docs.x402.org/getting-started/quickstart-for-buyers), que pagan la oferta de `payment-required`.

Con el cliente configurado, pides la ruta como con cualquier `fetch`: el cliente recibe el 402, paga y repite el pedido. Si sale bien, recibes un 200 con la respuesta de tu API y un recibo con la red y la transacción. Cada agente habla uno de los dos protocolos, así que prueba con el cliente que use el agente que esperas, o con los dos si no lo sabes.

Después revisa tu panel:

- **Visitas de agentes:** tu pago aparece como "Cliente MPP" o "Cliente x402", según el cliente que usaste, y el "Embudo de cobro" muestra tu pedido en "402 servidos", "volvieron con pago" y "pagaron". Tus `curl` también cuentan como 402 servidos, y las pruebas del comprador misterioso no.
- **Ingresos:** el pago con la fecha, la ruta, la red, el neto y el link "ver tx" a la transacción. El neto es el 98% del precio, y el costo de red no sale de ahí ([cuánto se queda Peaje](https://usepeaje.com/blog/cuanto-se-queda-peaje-de-cada-pago-de-un-agente-de-ia)).

## ¿Qué significan los errores que pueden salir?

El cuerpo de cada error trae un campo `code` que te dice qué pasó:

| Lo que recibes | Qué pasó | Qué haces |
| --- | --- | --- |
| Tu respuesta normal, sin 402 | Los cobros están apagados, o tu dominio no le pasa la ruta a Peaje | Activa los cobros en Ingresos, o compara con la respuesta del gateway |
| 503 con `no-payout-address` | El negocio no tiene wallet de cobro | Elige la wallet en Ingresos |
| 503 con `origin-paused` | Tu servidor falló 3 veces en 10 minutos y Peaje dejó de cobrar por 15 | Revisa tu servidor, Peaje te avisa por correo o por Telegram |
| 503 con `settlement-pending` | El pago se envió y todavía está confirmando | No pagues otra vez: repite el mismo pedido con la misma credencial en un minuto |
| Un 5xx con la cabecera `x-peaje-payment: not-charged` | Tu servidor falló, o el pago no se pudo liquidar, y no se cobró | Arregla el origen y prueba con un pago nuevo |
| 409 con `authorization-used` | La autorización de pago ya se había usado | Paga con una autorización nueva |
| Otro 402 después de pagar | La credencial no pasó la verificación, y el cuerpo dice por qué | Pide el 402 de nuevo, porque cada oferta vence a los 5 minutos |

Si tu servidor falla después de un pago en Tempo, Peaje le devuelve el pago al agente, como contamos en [qué es el código 402](https://usepeaje.com/blog/que-es-el-codigo-402-payment-required-y-que-pasa-si-un-agente-pide-sin-pagar).

## Fuentes

- [Contrato de Peaje en Arbiscan](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020)
- [Estado del gateway de Peaje](https://api.usepeaje.com/health)
- [x402: quickstart para compradores](https://docs.x402.org/getting-started/quickstart-for-buyers)
- [mpp.dev: quickstart del cliente](https://mpp.dev/quickstart/client)
- [mpp.dev: método de pago EVM](https://mpp.dev/payment-methods/evm)
- [Precios de Peaje](https://usepeaje.com/precios)
