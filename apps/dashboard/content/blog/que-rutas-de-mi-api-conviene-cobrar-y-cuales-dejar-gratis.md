---
title: "¿Qué rutas de mi API conviene cobrar y cuáles dejar gratis?"
description: Cómo decidir qué endpoints de tu API cobrarles a los agentes de IA y cuáles dejar abiertos, con un criterio simple, ejemplos por tipo de ruta y cómo ajustar el precio después.
date: 2026-11-05
slug: que-rutas-de-mi-api-conviene-cobrar-y-cuales-dejar-gratis
lang: es
categoria: Guía
portada: 4
portada_titulo: Qué rutas cobrar
traduccion: which-api-routes-should-i-charge-for-and-which-should-i-leave-free
---

# ¿Qué rutas de mi API conviene cobrar y cuáles dejar gratis?

Cobra las rutas que le ahorran trabajo al agente con algo que solo tú tienes, como un dato propio, un cálculo o un reporte, y deja gratis las que le sirven para encontrarte y decidir, como tu catálogo, tus precios y tu documentación. Si cobras por la puerta de entrada, el agente se va antes de saber qué vendes, y si regalas lo que vale, no tienes qué cobrar. Una regla corta: gratis lo que te hace visible, con precio lo que te cuesta producir o nadie más tiene.

Actualizado: noviembre de 2026

Con Peaje puedes probar sin riesgo: ponerle precio a una ruta es gratis, una ruta con precio 0 queda abierta y Peaje solo se queda el 2% de cada pago que recibes, según la [página de precios](https://usepeaje.com/precios).

## ¿Qué dejo gratis?

Lo que un agente necesita para entender qué ofreces y si le sirve:

- **Tu catálogo y tus precios.** Si el agente no los ve, no puede recomendarte ni comparar.
- **La documentación y los ejemplos.** Es lo que lee para decidir si paga y cómo llamarte.
- **Una muestra.** Un resultado de ejemplo, recortado o con datos viejos, para que el agente sepa qué recibe antes de pagar.
- **Las páginas que quieres que te citen.** Un bot de búsqueda que recibe un 402 no paga, se va sin leer y no te puede citar ([más sobre esto](https://usepeaje.com/blog/como-les-cobro-a-los-bots-de-ia-que-leen-mi-contenido)).

## ¿Qué cobro?

Lo que tiene valor por sí mismo y le ahorra trabajo al que lo pide:

- **Datos propios o difíciles de juntar,** como precios actualizados de un mercado, inventario en vivo o un historial.
- **Cálculos o procesos,** como una cotización, una conversión, un análisis o una validación.
- **Reportes y archivos completos,** como un PDF, un dataset o un informe que hoy vendes a personas.
- **Rutas que te cuestan plata,** porque llaman a otro servicio pago o usan mucho servidor.

## ¿Cómo se ve con un ejemplo?

Una API de clima para agricultores podría quedar así:

| Ruta | Qué devuelve | Precio |
| --- | --- | --- |
| `GET /api/ciudades` | Las ciudades con datos | Gratis |
| `GET /api/pronostico/:ciudad/hoy` | El pronóstico del día | Gratis, como muestra |
| `GET /api/pronostico/:ciudad/30-dias` | El pronóstico de 30 días con lluvia por hora | Con precio |
| `GET /api/reporte/:finca` | Un reporte de riesgo para una finca | Con precio, más alto |

Las dos primeras dejan que el agente te encuentre y pruebe, y las dos últimas son lo que vendes.

## ¿Cuánto cobro?

No hay un precio estándar todavía, así que empieza bajo en una sola ruta y mira qué pasa. Como referencia de cuenta: con Peaje, una ruta de US$0,05 te deja US$0,049 por pago, y en Arbitrum el agente paga aparte el costo de red, que hoy ronda un centavo. Revisa en "Visitas de agentes" quién pide la ruta y en Ingresos cuántos pagan, y sube el precio si casi todos pagan o bájalo si casi nadie lo hace.

Escribe la descripción de cada ruta para un agente que no conoce tu negocio: qué devuelve, en qué formato y un ejemplo. Es lo que lee para decidir si paga.

## ¿Puedo cambiar de idea después?

Sí, en Peaje cambias el precio de una ruta, la pasas a 0 o la quitas cuando quieras, y el cambio entra en tu `openapi.json`, tu `llms.txt` y tu servidor MCP. Además, los cobros vienen apagados: mientras no toques "Activar cobros" en Ingresos, los agentes usan tus rutas con precio gratis, y eso te sirve para ver cuáles piden antes de cobrar. Cómo se crea una ruta con precio, paso a paso, está en [cómo les cobro a los agentes de IA por usar mi API](https://usepeaje.com/blog/como-les-cobro-a-los-agentes-de-ia-por-usar-mi-api).

## Fuentes

- [Precios de Peaje](https://usepeaje.com/precios)
- [Cómo le paga un agente de IA a mi sitio y dónde recibo el pago](https://usepeaje.com/blog/como-le-paga-un-agente-de-ia-a-mi-sitio-y-donde-recibo-el-pago)
- [x402](https://www.x402.org/)
- [mpp.dev](https://mpp.dev/overview)
