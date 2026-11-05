---
title: "¿Cuánto se queda Peaje de cada pago de un agente de IA?"
description: La comisión exacta de Peaje sobre los pagos de agentes de IA, cuánto te llega con ejemplos, quién paga el costo de red, en qué monedas se cobra y por qué va aparte de la suscripción Pro.
date: 2026-11-05
slug: cuanto-se-queda-peaje-de-cada-pago-de-un-agente-de-ia
lang: es
categoria: Guía
portada: 2
portada_titulo: El 2% de Peaje
traduccion: how-much-does-peaje-keep-from-each-ai-agent-payment
---

# ¿Cuánto se queda Peaje de cada pago de un agente de IA?

Peaje se queda el 2% de cada pago que te hace un agente de IA, y el 98% llega a la wallet de tu negocio en la misma transacción. No hay cuota mensual por cobrar ni monto mínimo, y si no cobras nada, no pagas comisión. Ponerles precio a tus rutas y links es gratis en todos los planes.

Actualizado: noviembre de 2026

**Comisión: 2% por pago.** Lo dice la [página de precios](https://usepeaje.com/precios), y en Arbitrum está fijo en el código del [contrato que reparte cada pago](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020), que es público y está verificado.

## ¿Cuánto me llega por cada pago?

| Precio de la ruta | Comisión de Peaje (2%) | Te llega |
| --- | --- | --- |
| US$0,01 | US$0,0002 | US$0,0098 |
| US$0,05 | US$0,001 | US$0,049 |
| US$0,25 | US$0,005 | US$0,245 |
| US$1 | US$0,02 | US$0,98 |
| US$10 | US$0,20 | US$9,80 |

En Arbitrum, si el 2% no da una cifra exacta, el contrato redondea a tu favor. Los precios aceptan hasta 6 decimales.

## ¿Quién paga el costo de la red?

El agente, aparte del precio, así que no sale de tu 98%:

- **USDC en Arbitrum.** El agente suma al precio el costo de red, que hoy ronda un centavo y nunca pasa de US$0,02. Con eso Peaje paga el gas de la transacción.
- **pathUSD en Tempo.** El agente paga el gas en su propia transacción, que lleva dos transferencias: la tuya y el 2% de Peaje.

## ¿Peaje guarda mi plata en algún momento?

No, el pago se reparte en la misma transacción en que el agente paga, y el contrato de Arbitrum no guarda saldos. La plata llega a la wallet que Peaje creó para tu negocio cuando te registraste, que es tuya, solo se usa con tu sesión y Peaje no puede mover por su cuenta. Como no hay saldo en Peaje, tampoco hay nada que retirar. En Ingresos ves cada pago con la fecha, la ruta, la red, lo que te llegó y un link a la transacción.

## ¿El 2% va aparte de la suscripción Pro?

Sí, son dos cobros distintos. Pro cuesta US$30 al mes para los primeros 50 negocios y US$69 después, y lo pagas con tarjeta por Paddle, que calcula los impuestos de tu país. Los pagos de los agentes no pasan por Paddle ni por tu suscripción: van directo a tu wallet, menos el 2%, tengas el plan gratis o Pro.

## ¿Cuándo empiezo a pagar comisión?

Cuando un agente te paga por primera vez. Los cobros vienen apagados, y mientras lo estén, los agentes usan gratis tus rutas y links con precio y no hay nada que comisionar. Los prendes en Ingresos con "Activar cobros" y los apagas desde el mismo lugar. Cómo se crea una ruta con precio está en [cómo le paga un agente de IA a mi sitio](https://usepeaje.com/blog/como-le-paga-un-agente-de-ia-a-mi-sitio-y-donde-recibo-el-pago), y qué conviene cobrar, en [qué rutas de mi API conviene cobrar](https://usepeaje.com/blog/que-rutas-de-mi-api-conviene-cobrar-y-cuales-dejar-gratis).

## Fuentes

- [Precios de Peaje](https://usepeaje.com/precios)
- [Contrato de Peaje en Arbiscan](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020)
- [Peaje: cómo funciona y preguntas frecuentes](https://usepeaje.com/)
