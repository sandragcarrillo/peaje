---
title: "¿Por qué los agentes de IA pagan con stablecoins como USDC?"
description: Por qué los agentes de IA pagan con stablecoins y no con tarjeta, qué necesita un pago por pedido de centavos, qué dicen x402, MPP, Stripe y Circle, y con qué stablecoins te pagan los agentes en Peaje.
date: 2026-11-13
slug: por-que-los-agentes-de-ia-pagan-con-stablecoins-como-usdc
lang: es
categoria: Guía
portada: 4
portada_titulo: Por qué stablecoins
traduccion: why-do-ai-agents-pay-with-stablecoins-like-usdc
---

# ¿Por qué los agentes de IA pagan con stablecoins como USDC?

Los agentes pagan con stablecoins porque necesitan pagar por cada pedido, muchas veces centavos, sin crear una cuenta ni tener una tarjeta a su nombre, y porque el sitio necesita ver el pago antes de entregar lo que vende. Una stablecoin como USDC está atada al dólar, se manda desde una wallet que el agente controla y se liquida en segundos a cualquier hora, así que el pago cabe dentro de la misma petición HTTP. Por eso x402 y MPP, los dos protocolos con los que pagan hoy los agentes, aceptan stablecoins, y x402 las nombra como su uso principal.

Actualizado: noviembre de 2026

Stripe no deja cobrar menos de US$0,50 por pago en dólares, un mínimo que pone para que su comisión no supere el cobro, según su [página de monedas](https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts). En su [guía de MPP](https://docs.stripe.com/payments/machine/mpp), el mínimo con tarjeta es el mismo, US$0,50, y con stablecoins baja a 0,01 USDC.

## ¿Por qué la tarjeta no sirve para cobrar centavos?

Hay dos problemas: el mínimo de cada cobro y todo lo que pide antes de pagar. Si tu ruta cuesta un centavo, con tarjeta por Stripe no la puedes cobrar sola, porque cada pago tiene que llegar a US$0,50. Y un agente que paga con tarjeta tiene que pasar por un checkout pensado para personas: la [documentación de MPP](https://mpp.dev/overview) dice que lo que hace cómodo un pago para una persona (formularios que cambian, captchas, automatizar un navegador) es un obstáculo para un programa, y que vuelve el pago menos confiable, más lento y más caro.

La página de [x402](https://www.x402.org/) resume el modelo de siempre con la misma lista: crear una cuenta lleva tiempo, la verificación de identidad demora el acceso, hay claves que guardar y rotar, se paga por adelantado y las transacciones son lentas, con contracargos y comisiones. Para una persona que compra una vez al mes eso se tolera, y para un agente que hace cientos de consultas al día no.

## ¿Qué tiene una stablecoin que le sirva a un agente?

Esto es lo que necesita un pago por pedido y lo que dicen las fuentes de cada punto:

| Lo que necesita el agente | Qué dicen las fuentes |
| --- | --- |
| Que el precio en dólares sea el que se paga | Circle dice que USDC se puede canjear 1 a 1 por dólares y que está respaldado al 100% por efectivo y equivalentes de alta liquidez |
| Pagar sin cuenta ni clave de API | x402 deja pagar sin cuentas, sesiones ni manejo de credenciales, y MPP sin registro, cuenta de facturación ni clave de API |
| Cobrar montos muy chicos | MPP permite cobrar menos de un centavo por consulta o por pedido, y x402 trae soporte para micropagos |
| Que el pago se confirme rápido, a cualquier hora | Circle dice que los pagos con USDC se liquidan en segundos y funcionan las 24 horas, todos los días |
| Que el agente lo haga solo | Circle presenta USDC como una capa de dinero programable para que los agentes de IA paguen y cobren de forma autónoma |

Lo que une todo es la wallet: el agente firma el pago con su llave, el sitio lo revisa y lo liquida en la red, y nadie tiene que aprobar nada a mano. Cómo viaja esa firma en un pedido está en [qué es x402](https://usepeaje.com/blog/que-es-x402-y-como-funciona-el-pago-de-un-agente-de-ia-con-http-402) y en [qué es MPP](https://usepeaje.com/blog/que-es-mpp-el-protocolo-de-pagos-de-stripe-y-tempo-para-agentes-de-ia), y en qué se diferencian los dos, en [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-cual-protocolo-de-pago-para-agentes-de-ia-deberia-usar).

## ¿Los agentes solo pueden pagar con stablecoins?

No, los protocolos también aceptan otras formas de pago. MPP dice que funciona con stablecoins, tarjetas y transferencias bancarias, y Stripe lo usa con tarjetas por medio de tokens de pago compartidos. x402 dice que apunta a soportar todas las redes, cripto y tradicionales. Desde US$0,50 la tarjeta entra en el mínimo de Stripe, y para cobrar por pedido montos de centavos lo que hoy cabe es la stablecoin.

Una aclaración: aquí explicamos cómo funciona el pago, y nada de esto es una recomendación para comprar o guardar criptomonedas.

## ¿Con qué stablecoins te pagan los agentes en Peaje?

Con dos, y el agente elige cuál:

- **USDC en Arbitrum.** Sale en el 402 como oferta x402 y como oferta MPP. El agente paga aparte el costo de red, que nunca pasa de US$0,02.
- **pathUSD en Tempo.** Sale como oferta MPP. pathUSD es una stablecoin en dólares de la red Tempo, emitida por Bridge con reservas 1 a 1 en dólares, según la [documentación de Tempo](https://tempo.xyz/developers/docs/protocol/exchange/pathUSD). El agente paga el gas en su propia transacción.

En las dos, el 98% llega a la wallet de tu negocio en la misma transacción en que paga el agente, y Peaje se queda el 2%, que en Arbitrum está fijo en un [contrato público](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020). El pago queda en tu wallet en la misma stablecoin con que pagó el agente: Peaje no guarda saldos y no lo pasa a una cuenta bancaria. Cómo se reparte cada pago está en [cuánto se queda Peaje](https://usepeaje.com/blog/cuanto-se-queda-peaje-de-cada-pago-de-un-agente-de-ia), y cómo le pones precio a una ruta, en [cómo le paga un agente de IA a mi sitio](https://usepeaje.com/blog/como-le-paga-un-agente-de-ia-a-mi-sitio-y-donde-recibo-el-pago).

Peaje no cobra con tarjeta los pedidos de los agentes: cada 402 trae ofertas solo en esas dos stablecoins. Los cobros vienen apagados, y los prendes en Ingresos con "Activar cobros". Si todavía no sabes qué cobrar, mira [qué rutas de mi API conviene cobrar](https://usepeaje.com/blog/que-rutas-de-mi-api-conviene-cobrar-y-cuales-dejar-gratis), y el [radar gratis](https://usepeaje.com/radar) te dice si tu sitio ya responde x402 y MPP.

## Fuentes

- [Stripe: monto mínimo por cobro](https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts)
- [Stripe: aceptar pagos de agentes con MPP](https://docs.stripe.com/payments/machine/mpp)
- [mpp.dev: resumen del protocolo](https://mpp.dev/overview)
- [x402.org](https://www.x402.org/)
- [Documentación de x402](https://docs.x402.org/)
- [x402 en GitHub](https://github.com/x402-foundation/x402)
- [Circle: USDC](https://www.circle.com/usdc)
- [Tempo: pathUSD](https://tempo.xyz/developers/docs/protocol/exchange/pathUSD)
- [Contrato de Peaje en Arbiscan](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020)
- [Precios de Peaje](https://usepeaje.com/precios)
