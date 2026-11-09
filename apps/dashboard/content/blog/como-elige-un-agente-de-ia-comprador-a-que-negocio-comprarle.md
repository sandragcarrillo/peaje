---
title: "¿Cómo elige un agente de IA comprador a qué negocio comprarle?"
description: Qué mira un agente de IA cuando busca dónde comprar (descripción, precio y disponibilidad en texto, señales de terceros y una forma de pagar) y cómo revisar si te elegiría a ti.
date: 2026-11-07
slug: como-elige-un-agente-de-ia-comprador-a-que-negocio-comprarle
lang: es
categoria: Guía
portada: 3
portada_titulo: Cómo elige un agente
traduccion: how-does-an-ai-shopping-agent-choose-which-business-to-buy-from
---

# ¿Cómo elige un agente de IA comprador a qué negocio comprarle?

Un agente comprador elige leyendo texto: busca negocios cuya descripción calce con lo que le pidieron, compara el precio y la disponibilidad que puede leer sin adivinar, mira las señales que dejan otros (reseñas, uso, reputación) y descarta a quien no puede pagarle. Si tu descripción es vaga o tu precio no se lee, el agente nunca llega a compararte, y si el paso de pago falla, elige a otro aunque fueras la mejor opción.

Actualizado: noviembre de 2026

El 7 de noviembre de 2026, el Bazaar de x402, el catálogo de Coinbase de servicios que cobran por pedido, listaba 34.115 servicios, según su [API pública de descubrimiento](https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources). Un agente que compra datos o servicios elige entre todo eso en segundos, y lo único que tiene para decidir es lo que cada servicio dice de sí mismo.

## ¿Qué tiene que poder leer el agente?

Hoy hay dos tipos de agente comprador: los asistentes que compran productos para una persona, como las compras dentro de ChatGPT, y los agentes con wallet que compran datos o servicios por cada pedido. Los dos leen lo mismo, en formatos distintos:

| Qué mira | Asistente que compra productos | Agente que compra datos o servicios |
| --- | --- | --- |
| Qué vendes | Nombre y descripción del producto | La descripción de cada ruta: qué devuelve, con qué datos y en qué formato |
| Precio | El precio en tu feed de productos y en la página (JSON-LD con Offer) | El precio por pedido en tus archivos para agentes y en la respuesta 402 |
| Disponibilidad | Si hay stock, en preventa o agotado | Que la ruta responda cuando la llama |
| Señales de terceros | Cantidad de reseñas y estrellas | Uso reciente y reputación en registros públicos |
| Pago | Un checkout que el agente sepa completar (ACP o UCP) | Un 402 con x402 o MPP |

En el caso de los productos, la [especificación del feed de OpenAI](https://developers.openai.com/commerce/specs/feed) pide el precio y la disponibilidad como campos obligatorios, rechaza la fila si la disponibilidad falta o no se entiende, y aclara que cumplir los requisitos no garantiza que tu producto aparezca. En el caso de los servicios, Coinbase dice que la búsqueda del [Bazaar](https://docs.cdp.coinbase.com/x402/bazaar) toma en cuenta qué tan completa está la descripción, el esquema de la respuesta y los datos del servicio.

Si el precio solo aparece después de que carga un script o detrás de un login, muchos agentes no lo ven. La lista completa de lo que necesita una tienda está en [qué necesita mi tienda para que un agente de IA pueda comprarle](https://usepeaje.com/blog/que-necesita-mi-tienda-para-que-un-agente-de-ia-pueda-comprarle).

## ¿Qué pesa más, el precio o la descripción?

Cada agente decide distinto y casi ninguno publica sus criterios, así que el ejemplo más concreto que podemos darte es el del agente comprador de Peaje, cuyo código conocemos. Así decide:

1. **Pertinencia primero.** Cada palabra del pedido que aparece en el nombre, la descripción o las etiquetas del servicio suma más que cualquier diferencia de precio.
2. **Precio después.** Lo que pasa del presupuesto por pedido queda fuera, y entre los que quedan, el más barato suma un poco más.
3. **Una opción por proveedor.** Tres rutas del mismo negocio cuentan como una sola en la lista corta.
4. **Un veto final.** Antes de pagar, un modelo revisa si comprar ese servicio entrega el dato que pide el pedido, y descarta la documentación, las demos y las páginas informativas aunque hablen del tema.

En la práctica, una descripción como "Endpoint de pronóstico" te deja fuera antes de que tu precio importe, y "Pronóstico de lluvia por hora de los próximos 30 días para una ciudad de Colombia, en JSON" le da al agente las palabras que va a buscar.

## ¿Cuentan las reseñas y lo que dicen otros de ti?

Sí, y cada tipo de agente las lee en un lugar distinto:

- **Productos:** el feed de OpenAI acepta la cantidad de reseñas y la calificación en estrellas como campos opcionales.
- **Servicios por pedido:** el Bazaar muestra cuántas veces llamaron a cada servicio y cuántos pagadores distintos tuvo en los últimos 30 días.
- **Agentes y servicios con identidad propia:** [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004), una propuesta de estándar de Ethereum que sigue en borrador, define un registro de identidad y otro de reputación donde quien te usó deja su calificación. El agente de Peaje suma esa reputación cuando el servicio está registrado.

Ninguna de estas señales la controlas del todo. Lo que sí está en tus manos es que tus datos sean ciertos y digan lo mismo en tu página, en tu feed y en tus archivos para agentes, porque un precio distinto en cada lugar hace dudar a cualquier agente ([por qué la IA a veces da datos equivocados de tu negocio](https://usepeaje.com/blog/por-que-chatgpt-da-informacion-equivocada-de-mi-negocio-y-como-la-corrijo)).

## ¿Qué pasa si el agente no puede pagarte?

Elige a otro, aunque te haya encontrado primero. Si vendes productos físicos, el pago casi siempre llega por los protocolos de compra de tu plataforma de tienda (ACP en ChatGPT, UCP en Google). Si vendes datos, acceso a una API o contenido por uso, el agente espera una respuesta `402 Payment Required` que le diga cuánto cuesta y cómo pagar, y como cada agente habla x402 o MPP, conviene responder con los dos en el mismo 402 ([qué trae el 402](https://usepeaje.com/blog/que-es-el-codigo-402-payment-required-y-que-pasa-si-un-agente-pide-sin-pagar)). Un 402 sin las cabeceras de pago, o con un monto distinto al precio que publicaste, hace que un cliente estricto se detenga ahí.

## ¿Cómo sé si un agente me elegiría?

El comprador misterioso de Peaje (plan Pro, 30 créditos por prueba) lo revisa con el mismo agente comprador del punto anterior, y nunca paga:

1. Un modelo escribe tres pedidos realistas que tu negocio debería ganar con lo que vendes, sin tu nombre ni tu dominio.
2. Por cada pedido, el agente busca en el directorio de Peaje, en el Bazaar de x402 y en el registro ERC-8004, y anota si te encontró, en qué puesto, si te compraría y, si no, a quién eligió (con su dominio y su precio) y por qué: tu precio pasa el tope de US$0,10 por pedido que usa la prueba, tu descripción no tiene las palabras que buscó, el otro es más barato o su descripción calza mejor.
3. Después pide tu URL con precio sin pagar, en tu dominio y en el gateway de Peaje, y revisa lo mismo que un cliente estricto: que responda 402, que traiga la cabecera `PAYMENT-REQUIRED` de x402 versión 2 y el desafío `WWW-Authenticate: Payment` de MPP, que cada forma de pago tenga monto, token, destinatario y red, que el monto coincida con tu precio, que el pago nombre tu dominio y que la descripción diga algo más que la ruta.

Lo que puedes arreglar queda como tarea, y la tarea se cierra sola cuando la siguiente prueba ya no ve el problema. Puedes repetirla cada 6 horas. Para probar algo, necesitas al menos una ruta o un link con precio, y si no tienes ninguno, el comprador te lo dice y no busca nada.

Tiene un límite que conviene saber: simula agentes que compran APIs y links por pedido, y no simula a ChatGPT comprando un producto físico en tu tienda. Para eso, el [radar gratis](https://usepeaje.com/radar) te dice si tus precios se leen sin JavaScript, si tienes JSON-LD y si aceptas algún protocolo de compra. Qué falla del lado de los propios agentes cuando compran lo explicamos en [por qué los agentes de IA compradores fallan casi la mitad de las veces](https://usepeaje.com/blog/por-que-los-agentes-de-ia-compradores-fallan-casi-la-mitad-de-las-veces).

## Fuentes

- [OpenAI: especificación del feed de productos](https://developers.openai.com/commerce/specs/feed)
- [Coinbase Developer Platform: x402 Bazaar](https://docs.cdp.coinbase.com/x402/bazaar)
- [API de descubrimiento del Bazaar de x402](https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources)
- [ERC-8004: Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004)
- [Peaje: qué incluyen los 500 créditos al mes](https://usepeaje.com/blog/cuanto-cuesta-peaje-y-que-incluyen-los-500-creditos-al-mes)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
