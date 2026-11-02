---
title: "¿Cómo le paga un agente de IA a mi sitio y dónde recibo el pago?"
description: Cómo le paga un agente de IA a tu sitio con HTTP 402, cómo le pones precio a una ruta o a un link en Peaje y a qué wallet llega cada pago.
date: 2026-11-01
slug: como-le-paga-un-agente-de-ia-a-mi-sitio-y-donde-recibo-el-pago
lang: es
categoria: Guía
portada: 2
portada_titulo: Recibe pagos de agentes
traduccion: how-does-an-ai-agent-pay-my-website-and-where-does-the-money-go
---

# ¿Cómo le paga un agente de IA a mi sitio y dónde recibo el pago?

Cuando un agente pide algo de tu sitio que tiene precio, tu sitio le contesta `402 Payment Required` con ese precio. El agente paga con dólares digitales (USDC o pathUSD), repite el pedido con el pago adjunto y recibe lo que pidió. Con Peaje el pago llega a la wallet de tu negocio en la misma transacción, menos el 2% de comisión, y Peaje nunca guarda tu plata.

Actualizado: noviembre de 2026

Ponerle precio a una ruta no cuesta nada: las rutas con precio vienen en el plan gratis, y Peaje solo se queda con el 2% de cada pago que recibes, según la [página de precios](https://usepeaje.com/precios).

## ¿Cómo le paga un agente a un sitio, paso a paso?

1. El agente pide la ruta, por ejemplo `GET /api/pronostico/bogota`.
2. Tu sitio le contesta 402 con una oferta por cada red donde puede pagar. Cada oferta dice el precio, la moneda y a dónde va el pago, en los dos formatos que usan hoy los agentes, MPP y x402 ([cuál conviene](https://usepeaje.com/blog/x402-vs-mpp-cual-protocolo-de-pago-para-agentes-de-ia-deberia-usar)).
3. El agente elige una red, firma el pago con su wallet y repite el pedido con el pago adjunto.
4. Peaje revisa el pago, le pide la respuesta a tu sitio y se la entrega al agente junto con un recibo en la cabecera `Payment-Receipt`.

El agente no necesita cuenta ni clave de API, porque el pago es su credencial.

## ¿Cómo se ve ese pedido?

Así contesta una ruta con precio cuando el agente llega sin pagar (los valores van recortados):

```
curl -i https://api.usepeaje.com/tu-negocio/r/reporte-2026

HTTP/2 402
content-type: application/problem+json
www-authenticate: Payment id="…", realm="api.usepeaje.com", method="evm", intent="charge", request="…"
www-authenticate: Payment id="…", realm="api.usepeaje.com", method="tempo", intent="charge", request="…"
payment-required: …
```

Cada `www-authenticate` es una oferta de MPP, una por red, y `payment-required` lleva lo mismo en formato x402. Con el kit de Peaje instalado, esa respuesta sale en tu propio dominio y no en `api.usepeaje.com`.

## ¿En qué redes pagan los agentes?

Hoy en dos, y el agente elige cuál:

- **USDC en Arbitrum.** Además del precio, el agente paga el costo de red, que hoy es alrededor de un centavo y nunca pasa de US$0,02. Con eso Peaje cubre el gas de la transacción, y tú recibes el 98% del precio completo.
- **pathUSD en Tempo.** El agente paga el gas en su propia transacción.

## ¿Cómo creo una ruta paga en Peaje?

En tu panel, entra a Rutas, dentro de "Cobros" en el menú. Hay dos formas de ponerle precio a algo:

- **Links con precio.** Sirve con cualquier URL pública, sea una página, un PDF o un dataset. Pegas la URL, le pones precio y queda en `api.usepeaje.com/tu-negocio/r/el-link`. También puedes importar tu sitemap y elegir qué páginas cobrar. No necesitas tener una API.
- **Rutas de API con precio.** Son endpoints que tu servidor ya sirve. Pones el método, el path (por ejemplo `/api/pronostico/:ciudad`), una descripción para agentes y el precio en dólares, y le das a "Publicar ruta". Con el kit instalado, el 402 sale en tu dominio y, cuando el agente paga, Peaje le pasa el pedido a tu servidor.

Las dos entran al instante en lo que leen los agentes: tu `openapi.json`, tu `llms.txt`, tu página `/developers` y tu servidor MCP, donde cada ruta con precio aparece como una herramienta paga. Si le pones precio 0, la ruta queda gratis, y eso sirve para muestras o documentación.

Escribe la descripción pensando en un agente que no conoce tu negocio, con qué devuelve, en qué formato y un ejemplo, porque es lo que el agente lee para decidir si paga.

## ¿Cómo empiezo a cobrar?

Los cobros vienen apagados, y mientras lo estén, los agentes usan gratis tus rutas y links con precio. Para prenderlos, entra a Ingresos y toca "Activar cobros". También te aparece el aviso en Inicio. Los puedes apagar cuando quieras desde el mismo lugar.

## ¿Dónde recibo el pago?

En la wallet que Peaje creó para tu negocio cuando te registraste. Es tuya, solo se usa con tu sesión y Peaje no puede mover esos fondos. Es la misma dirección en Arbitrum y en Tempo, y la ves en Ingresos con links para revisarla en el explorador de cada red.

Cada pago llega en la misma transacción en que el agente paga, con el 98% para ti y el 2% para Peaje. En Arbitrum lo reparte un [contrato público y verificado](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020) que tiene el 2% fijo en el código, y en Tempo la propia transacción del agente lleva las dos partes. Como Peaje no guarda saldos, no hay nada que retirar.

Una ruta de US$0,05, por ejemplo, te deja US$0,049 por cada pago. En Ingresos ves cada uno con la fecha, la ruta, la red, lo que te llegó y la transacción.

## ¿Qué pasa si el agente no paga o si mi sitio falla?

- **Si no paga,** recibe el 402 y nada más, así que tu contenido no sale.
- **Si tu sitio falla en Arbitrum,** el agente no paga, porque Peaje le pide la respuesta a tu sitio antes de cobrar.
- **Si tu sitio falla en Tempo,** el agente ya pagó, así que Peaje le devuelve el pago de su propia cuenta, con topes. Lo que te llegó a ti se queda en tu wallet.
- **Si tu sitio falla tres veces en diez minutos,** Peaje deja de ofrecer el pago por quince minutos y te avisa por Telegram o por correo.

Si quieres ver qué más necesita tu tienda para venderles a los agentes, mira [qué necesita mi tienda para que un agente de IA pueda comprarle](https://usepeaje.com/blog/que-necesita-mi-tienda-para-que-un-agente-de-ia-pueda-comprarle).
