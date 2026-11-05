---
title: "¿Cómo les cobro a los agentes de IA por usar mi API?"
description: Los pasos para cobrarles a los agentes de IA por cada llamada a tu API, sin claves ni registro, con la respuesta 402, x402 y MPP, desde publicar la ruta hasta ver el primer pago.
date: 2026-11-05
slug: como-les-cobro-a-los-agentes-de-ia-por-usar-mi-api
lang: es
categoria: Guía
portada: 4
portada_titulo: Cobrar por tu API
traduccion: how-do-i-charge-ai-agents-for-using-my-api
---

# ¿Cómo les cobro a los agentes de IA por usar mi API?

Le pones precio a cada ruta de tu API y tu servidor le contesta `402 Payment Required` al agente que llega sin pagar, con el precio y las formas de pago. El agente paga desde su wallet, repite la llamada con el pago y recibe la respuesta, sin clave de API ni registro. Con Peaje lo haces desde tu panel: publicas la ruta, instalas el kit en tu sitio y activas los cobros.

Actualizado: noviembre de 2026

Publicar rutas con precio es gratis en todos los planes, y Peaje se queda el 2% de cada pago, que llega a la wallet de tu negocio en la misma transacción, según la [página de precios](https://usepeaje.com/precios).

## ¿Qué necesito antes de empezar?

- **Una API que ya responda.** Peaje no la reemplaza: se pone delante, cobra y le pasa la llamada a tu servidor.
- **Tu sitio registrado en Peaje,** en [usepeaje.com/nuevo](https://usepeaje.com/nuevo), sin tarjeta. Al registrarte, Peaje te crea la wallet donde llegan los pagos.
- **El kit instalado,** para que el 402 salga en tu propio dominio ([cómo se instala](https://usepeaje.com/blog/como-instalo-el-kit-de-peaje-en-mi-proyecto-con-un-comando)).

## ¿Cómo publico una ruta con precio?

1. En tu panel, entra a Rutas, dentro de "Cobros".
2. Pon el método y el path, por ejemplo `GET /api/pronostico/:ciudad`.
3. Escribe una descripción para un agente que no conoce tu negocio: qué devuelve, en qué formato y un ejemplo.
4. Pon el precio en dólares, mayor a 0, con hasta 6 decimales.
5. Toca "Publicar ruta".

La ruta entra al instante en tu `openapi.json`, tu `llms.txt`, tu página `/developers` y tu servidor MCP, donde aparece como una herramienta con precio. Así la encuentran los agentes ([cómo te encuentran](https://usepeaje.com/blog/como-encuentran-los-agentes-de-ia-mi-api)).

## ¿Qué cambio en mi servidor?

Casi nada: el kit agrega en tu sitio el paso que cobra antes de llegar a tu API, y te deja un paso manual: agregar `PEAJE_ORIGIN_SECRET` a las variables de entorno de tu hosting. Lo copias de la página del kit. Ese secreto le prueba a tu servidor que la llamada viene de Peaje después del pago, y sin él tus rutas con precio no se cobran en tu dominio.

## ¿Cómo pruebo que cobra?

Llama la ruta sin pagar y mira la respuesta:

```bash
curl -i https://tudominio.com/api/pronostico/bogota
```

Tienes que ver un `402` con dos cabeceras `www-authenticate: Payment` (MPP, una por red) y una `payment-required` (x402). Qué trae cada una está en [qué es el código 402](https://usepeaje.com/blog/que-es-el-codigo-402-payment-required-y-que-pasa-si-un-agente-pide-sin-pagar). Si ves la respuesta normal de tu API, revisa que los cobros estén activos y que `PEAJE_ORIGIN_SECRET` esté en tu hosting.

## ¿Cómo activo los cobros?

Vienen apagados, y mientras lo estén, los agentes usan tus rutas con precio gratis, lo que te sirve para ver cuáles piden antes de cobrar. Entra a Ingresos y toca "Activar cobros". Desde ahí ves cada pago con la fecha, la ruta, la red, lo que te llegó y la transacción, y en "Visitas de agentes" ves el embudo: cuántos 402 serviste, cuántos agentes volvieron con un pago y cuántos pagaron.

Los agentes pagan con USDC en Arbitrum o pathUSD en Tempo, y tú recibes el 98% del precio. En Arbitrum, si tu API falla, el agente no paga, porque Peaje le pide la respuesta a tu servidor antes de cobrar.

## ¿Qué rutas cobro?

Las que entregan algo que solo tú tienes o que te cuesta producir, y dejas gratis las que sirven para encontrarte y probarte. Lo desarrollamos con ejemplos en [qué rutas de mi API conviene cobrar y cuáles dejar gratis](https://usepeaje.com/blog/que-rutas-de-mi-api-conviene-cobrar-y-cuales-dejar-gratis).

## Fuentes

- [Precios de Peaje](https://usepeaje.com/precios)
- [Cómo le paga un agente de IA a mi sitio y dónde recibo el pago](https://usepeaje.com/blog/como-le-paga-un-agente-de-ia-a-mi-sitio-y-donde-recibo-el-pago)
- [x402](https://www.x402.org/)
- [mpp.dev: resumen del protocolo](https://mpp.dev/overview)
