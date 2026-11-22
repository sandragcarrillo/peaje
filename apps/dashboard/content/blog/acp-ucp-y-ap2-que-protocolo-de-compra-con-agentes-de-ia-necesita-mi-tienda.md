---
title: "ACP vs UCP vs AP2: ¿qué protocolo de compra con agentes de IA necesita mi tienda?"
description: ACP vs UCP vs AP2 en noviembre de 2026, comparados en una tabla. Quién mantiene cada uno, qué resuelve, dónde se usa hoy, qué procesadores de pago soportan ACP y UCP, y cuál necesita tu tienda.
date: 2026-11-07
updated: 2026-11-22
slug: acp-ucp-y-ap2-que-protocolo-de-compra-con-agentes-de-ia-necesita-mi-tienda
lang: es
categoria: Guía
portada: 3
portada_titulo: ACP, UCP y AP2
traduccion: acp-ucp-and-ap2-which-ai-agent-shopping-protocol-does-my-store-need
---

# ACP vs UCP vs AP2: ¿qué protocolo de compra con agentes de IA necesita mi tienda?

ACP y UCP hacen el mismo trabajo para empresas distintas: los dos dejan que un agente de IA arme un carrito y pague en tu tienda. ACP viene de OpenAI y Stripe, y UCP de Google con Shopify, Etsy, Wayfair, Target y Walmart. AP2 trabaja en otra capa, la prueba firmada de que una persona autorizó la compra, y UCP lo soporta. Si vendes en Shopify, Etsy o con un procesador de pagos grande, lo más probable es que ACP y UCP te lleguen por ahí, sin construirlos tú.

Actualizado: 22 de noviembre de 2026

Los tres son estándares abiertos con licencia Apache 2.0, así que usarlos no cuesta nada. Lo que pagas son las comisiones de tu procesador, como en cualquier venta.

## ACP vs UCP vs AP2 en una tabla

| | ACP | UCP | AP2 |
| --- | --- | --- | --- |
| Qué resuelve | El checkout y la entrega del medio de pago | Toda la compra: catálogo, carrito, cuenta del comprador, checkout y pedido | La prueba de que una persona autorizó lo que compra el agente |
| Quién lo mantiene | OpenAI y Stripe | Un Tech Council que fundaron Google, Shopify, Etsy, Target y Wayfair | La FIDO Alliance, desde abril de 2026 |
| Última versión | 2026-04-17, todavía en beta | Versiones con fecha, y la especificación actual usa la 2026-08-25 | 0.2, del 28 de abril de 2026 |
| Cómo te encuentra el agente | Los endpoints de checkout de tu tienda | Un perfil JSON en `/.well-known/ucp` | Viaja dentro de la compra, como mandatos firmados |
| Por dónde viaja | REST o MCP | REST, MCP o A2A | Extensión de A2A y MCP, y de UCP para los mandatos |
| Con qué paga el comprador | Tarjeta convertida en un token de un solo uso por tu procesador | El medio de pago que declare tu tienda, como Google Pay | Tarjetas hoy, con transferencias bancarias en la hoja de ruta |

## ¿Qué es ACP y qué resuelve?

ACP (Agentic Commerce Protocol) es el estándar abierto que publicaron OpenAI y Stripe el 29 de septiembre de 2025, el día en que salió Instant Checkout en ChatGPT. Resuelve dos cosas:

- **El checkout.** Tu tienda expone `/checkout_sessions` para crear, actualizar, completar y cancelar una compra, y el agente arma ahí el carrito del comprador.
- **El pago delegado.** Tu procesador de pagos expone `/agentic_commerce/delegate_payment`, que convierte la tarjeta del comprador en un token de un solo uso, con monto máximo, fecha de vencimiento y válido para un solo comercio. Stripe fue el primer procesador compatible, con su Shared Payment Token.

El agente no pasa a ser el comercio de registro (merchant of record): la venta sigue siendo tuya y la cobras con tu procesador. La especificación saca versiones con fecha. La última, del 17 de abril de 2026, agregó carrito, catálogo de productos, pedidos, autenticación y MCP.

### ¿ChatGPT sigue usando ACP para comprar?

No con ese nombre. La documentación de comercio de OpenAI, leída el 22 de noviembre de 2026, no menciona ACP ni Instant Checkout. Describe cuatro caminos: un catálogo de productos (product feed) para que ChatGPT encuentre lo que vendes, su navegador en la nube comprando por tu checkout de siempre, ChatGPT Wallet para pagar en tu sitio, y un plugin, que es un servidor MCP más skills ([qué es MCP](https://usepeaje.com/blog/que-es-mcp-y-en-que-se-diferencia-de-una-api)), para que ChatGPT llame directo a tu carrito y tu checkout. La especificación de ACP se sigue manteniendo en GitHub, pero si tu meta es vender en ChatGPT, hoy se empieza por la guía de OpenAI.

## ¿Qué es UCP y qué resuelve?

UCP (Universal Commerce Protocol) es el estándar abierto que lanzó Google el 11 de enero de 2026 para todo el recorrido de compra: buscar en el catálogo, armar el carrito, vincular la cuenta del comprador, pagar y seguir el pedido. Tu tienda publica un archivo JSON en `/.well-known/ucp` que dice qué servicios tiene, qué capacidades soporta y con qué medios de pago cobra, y el agente lo lee para saber cómo comprarte sin una integración hecha a mano.

Funciona sobre REST, MCP o A2A, y separa el instrumento (con qué paga el comprador) del payment handler (quién procesa el cobro), así que cada tienda declara sus propios rieles. Google lo usa para el checkout en el Modo IA del buscador, con Google Pay y para tiendas elegibles de Estados Unidos, y su página para comercios pone la app de Gemini como próxima y una lista de espera para sumarse. El 24 de abril de 2026 entraron a su Tech Council, el grupo que vota los cambios de la especificación, Amazon, Meta, Microsoft, Salesforce y Stripe.

## ¿Qué es AP2 y para qué sirve?

AP2 (Agent Payments Protocol) prueba que una persona autorizó lo que el agente compra. Google lo anunció el 16 de septiembre de 2025 con más de 60 organizaciones, y el 28 de abril de 2026 lo donó a la FIDO Alliance, el mismo día en que salió la versión 0.2.

Cada compra lleva dos mandatos, que son contratos digitales firmados con credenciales verificables: el mandato de checkout, que va al comercio, y el mandato de pago, que va al procesador y a la red de la tarjeta. Cada uno tiene una etapa abierta, con los límites que pone la persona (presupuesto, medios de pago permitidos), y una etapa cerrada, con el carrito y el monto exactos. Así cubre compras con la persona presente y también compras autorizadas de antemano. Hoy acepta tarjetas, y su hoja de ruta suma billeteras, transferencias bancarias en tiempo real como PIX o UPI y otros medios.

## ACP vs UCP: ¿qué procesadores de pago soportan cada uno?

Stripe está en los dos lados: mantiene ACP con OpenAI, fue el primer procesador con el Shared Payment Token de ACP y está en el Tech Council de UCP, con su propia [guía de UCP](https://docs.stripe.com/agentic-commerce/protocols/ucp). El sitio oficial de ACP todavía no nombra otro procesador compatible.

UCP tiene más nombres. Su sitio oficial pone a Stripe, Adyen, PayPal, Visa, Mastercard, American Express y Worldpay entre quienes lo respaldan, junto con Klarna, Affirm, Block y Fiserv. Que un procesador respalde un protocolo no quiere decir que ya lo ofrezca en tu país, así que pregúntale al tuyo antes de construir nada.

## ¿Cuál necesita mi tienda?

- **Vendes productos en Shopify, Etsy u otra plataforma:** revisa primero los ajustes de tu plataforma, porque ACP y UCP dependen de tu catálogo, tu checkout y tu procesador, y casi siempre es la plataforma la que los conecta.
- **Quieres vender en ChatGPT:** empieza por la documentación de comercio de OpenAI, con tu catálogo de productos y un checkout que su navegador en la nube pueda completar.
- **Quieres vender en el Modo IA o en Gemini:** empieza por Merchant Center y la página de UCP de Google. Hoy es para tiendas elegibles de Estados Unidos.
- **Tienes tienda propia y cobras con Stripe:** la [guía de comercio agéntico de Stripe](https://docs.stripe.com/agentic-commerce) cubre el Shared Payment Token y UCP.

Antes que cualquier protocolo, un agente tiene que encontrar tus precios y entender qué vendes. En la sección "¿Te pueden comprar?", el [radar gratis](https://usepeaje.com/radar) de Peaje revisa si un agente encuentra tus precios (en un pricing.md o en tus datos estructurados) y si publicas un perfil UCP en `/.well-known/ucp`, y en sus resultados también ves si respondes ACP y AP2. Peaje no te inscribe en el checkout de ChatGPT ni en el de Google, y no procesa pagos con tarjeta. La lista completa de lo que mira un agente antes de comprarte está en [qué necesita mi tienda para que un agente de IA pueda comprarle](https://usepeaje.com/blog/que-necesita-mi-tienda-para-que-un-agente-de-ia-pueda-comprarle).

## Preguntas frecuentes

### ¿Mi tienda puede soportar ACP y UCP a la vez?

Sí. Son especificaciones separadas, y Stripe, por ejemplo, ofrece las dos.

### ¿Necesito AP2 si ya uso UCP?

Para empezar, no. UCP tiene una extensión de mandatos AP2 para probar que el comprador autorizó. Si la necesitas depende de tu procesador y de los agentes que te compran, así que pregúntale a tu procesador, sobre todo si esperas compras sin la persona presente.

### ¿ACP sigue vivo?

La especificación sí. Su última versión es del 17 de abril de 2026 y sigue en beta. Lo que cambió es ChatGPT: su documentación de comercio actual ya no describe Instant Checkout.

### ¿ACP, UCP y AP2 sirven fuera de Estados Unidos?

Las especificaciones están abiertas para cualquiera. Los checkouts que las usan hoy, en ChatGPT y en Google, tienen sus propias reglas, y Google limita por ahora su checkout a tiendas elegibles de Estados Unidos.

## Fuentes

- [Agentic Commerce Protocol](https://www.agenticcommerce.dev)
- [ACP en GitHub: versiones y especificaciones](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [Stripe: Instant Checkout en ChatGPT y el Agentic Commerce Protocol](https://stripe.com/newsroom/news/stripe-openai-instant-checkout)
- [OpenAI: documentación de comercio](https://developers.openai.com/commerce/)
- [OpenAI: aceptar pagos en ChatGPT](https://developers.openai.com/commerce/guides/accept-payments)
- [OpenAI: crear un plugin de comercio](https://developers.openai.com/commerce/guides/build-a-plugin)
- [Google: anuncio del Universal Commerce Protocol (11 de enero de 2026)](https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/)
- [Google Developers: cómo funciona UCP por dentro](https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/)
- [Google Merchant Center: UCP](https://developers.google.com/merchant/ucp)
- [Universal Commerce Protocol](https://ucp.dev)
- [Tech Council de UCP: entran Amazon, Meta, Microsoft, Salesforce y Stripe (24 de abril de 2026)](https://www.financialcontent.com/article/newsfile-2026-4-24-amazon-meta-microsoft-salesforce-and-stripe-join-the-universal-commerce-protocol-tech-council)
- [Google Cloud: anuncio de AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [Agent Payments Protocol](https://ap2-protocol.org/)
- [Google: donación de AP2 a la FIDO Alliance](https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/)
- [Stripe: comercio agéntico](https://docs.stripe.com/agentic-commerce)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
