---
title: "ACP, UCP y AP2: ¿qué protocolo de compra con agentes de IA necesita mi tienda?"
description: Qué son ACP de OpenAI y Stripe, UCP de Google y AP2 de Google, quién los creó, qué resuelve cada uno, en qué se diferencian de x402 y MPP y qué hace hoy Peaje con cada uno.
date: 2026-11-07
slug: acp-ucp-y-ap2-que-protocolo-de-compra-con-agentes-de-ia-necesita-mi-tienda
lang: es
categoria: Guía
portada: 3
portada_titulo: ACP, UCP y AP2
traduccion: acp-ucp-and-ap2-which-ai-agent-shopping-protocol-does-my-store-need
---

# ACP, UCP y AP2: ¿qué protocolo de compra con agentes de IA necesita mi tienda?

Depende de dónde compran tus clientes: ACP es el que usa ChatGPT para comprarle a una tienda, y UCP es el que usa Google para el checkout en el Modo IA del buscador y en Gemini. AP2 se ocupa de otra parte de la compra, la prueba firmada de que una persona la autorizó, y funciona junto con UCP. Si vendes productos en una plataforma grande como Shopify o Etsy, lo más probable es que ACP y UCP te lleguen por ahí, junto con tu procesador de pagos.

Actualizado: noviembre de 2026

Google lanzó UCP el 11 de enero de 2026 con Shopify, Etsy, Wayfair, Target y Walmart, y con el respaldo de más de 20 empresas más, entre ellas Visa y Mastercard, según el [anuncio de Google](https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/).

## ¿Qué es ACP y qué resuelve?

ACP (Agentic Commerce Protocol) es el estándar abierto que publicaron OpenAI y Stripe el 29 de septiembre de 2025, el día en que salió Instant Checkout en ChatGPT para usuarios de Estados Unidos, que arrancó con tiendas de Etsy. Lo mantienen las dos empresas, tiene licencia Apache 2.0, sigue en beta y saca versiones con fecha. Resuelve dos cosas:

- **El checkout.** Tu tienda expone `/checkout_sessions` para crear, actualizar, completar y cancelar una compra, y el agente arma ahí el carrito del comprador.
- **El pago delegado.** El procesador de pagos de tu tienda expone `/agentic_commerce/delegate_payment`, que convierte la tarjeta del comprador en un token de un solo uso, con monto máximo, fecha de vencimiento y válido para un solo comercio. Stripe fue el primer procesador compatible, con su Shared Payment Token.

El agente no pasa a ser el comercio de registro (merchant of record): la venta sigue siendo tuya y la cobras con tu procesador. La documentación de OpenAI arranca la integración pidiendo tu catálogo de productos en un formato estructurado.

## ¿Qué es UCP y qué resuelve?

UCP (Universal Commerce Protocol) es el estándar abierto de Google para todo el recorrido de compra: buscar en el catálogo, armar el carrito, vincular la cuenta del comprador, pagar y seguir el pedido. Tu tienda publica un archivo JSON en `/.well-known/ucp` que dice qué servicios tiene, qué capacidades soporta (checkout, descuentos, envíos) y con qué medios de pago cobra, y el agente lo lee para saber cómo comprarte sin una integración hecha a mano.

Funciona sobre REST, MCP o A2A, tiene licencia Apache 2.0 y separa el instrumento (con qué paga el comprador) del payment handler (quién procesa el cobro), así que cada tienda declara sus propios rieles. Google lo usa para el checkout en el Modo IA del buscador y en la app de Gemini, con Google Pay y los datos guardados en Google Wallet, por ahora para tiendas elegibles de Estados Unidos.

## ¿Qué es AP2 y para qué sirve?

AP2 (Agent Payments Protocol) lo anunció Google el 16 de septiembre de 2025 con más de 60 organizaciones, entre ellas Adyen, American Express, Coinbase, Mastercard y PayPal. Su trabajo es probar que una persona autorizó lo que el agente compra. Cada compra lleva mandatos, que son contratos digitales firmados con credenciales verificables: en el lanzamiento eran uno con la intención del comprador y otro con el carrito exacto y su precio, y en la versión 0.2 se llaman mandato de checkout y mandato de pago.

Acepta tarjetas, transferencias bancarias en tiempo real y stablecoins, y Google sacó con Coinbase y otras empresas la extensión A2A x402 para pagos en cripto. Funciona como extensión de A2A y de MCP, y también con UCP. El 28 de abril de 2026 Google donó AP2 a la FIDO Alliance, y ese día salió la versión 0.2, que agrega pagos sin la persona presente, autorizados de antemano.

## ¿En qué se diferencian de x402 y MPP?

| | Qué resuelve | Quién está detrás | Con qué se paga |
| --- | --- | --- | --- |
| ACP | El checkout dentro de ChatGPT | OpenAI y Stripe | Tarjeta convertida en token por el procesador de la tienda |
| UCP | El recorrido de compra, descubierto en `/.well-known/ucp` | Google con Shopify, Etsy, Wayfair, Target y Walmart | El payment handler que declare la tienda, como Google Pay |
| AP2 | La prueba firmada de que la persona autorizó | Google, ahora en la FIDO Alliance | Tarjeta, transferencia o stablecoin |
| x402 y MPP | El cobro por cada pedido HTTP con un 402 | Coinbase y la x402 Foundation, Stripe y Tempo | Stablecoins, y en MPP también tarjetas |

ACP, UCP y AP2 están pensados para compras con carrito, envío y una persona que decide, y x402 y MPP para cobrar por uso a una API o a contenido digital, sin carrito. Los dos del 402 tienen su propia guía: [qué es x402](https://usepeaje.com/blog/que-es-x402-y-como-funciona-el-pago-de-un-agente-de-ia-con-http-402) y [qué es MPP](https://usepeaje.com/blog/que-es-mpp-el-protocolo-de-pagos-de-stripe-y-tempo-para-agentes-de-ia).

## ¿Cuál necesita mi tienda y qué hace Peaje con cada uno?

- **Vendes productos en Shopify, Etsy u otra plataforma:** revisa los ajustes de tu plataforma antes de construir nada, porque ACP y UCP dependen de tu catálogo, tu checkout y tu procesador.
- **Tienes tienda propia y cobras con Stripe:** la [guía de comercio agéntico de Stripe](https://docs.stripe.com/agentic-commerce) es el punto de partida, con el Shared Payment Token de ACP y una sección de UCP.
- **Vendes acceso a una API, datos o contenido por uso:** el camino es el 402, y lo explicamos en [cómo les cobro a los agentes de IA por usar mi API](https://usepeaje.com/blog/como-les-cobro-a-los-agentes-de-ia-por-usar-mi-api).

El kit gratis de Peaje sirve en tu dominio las rutas de UCP y ACP, conectadas al cobro en stablecoin por 402 y sin tarjetas:

- **`/.well-known/ucp`:** un perfil UCP con el servicio REST en `/checkout_sessions` y el servidor MCP, la capacidad de checkout, la extensión de mandatos AP2 y un medio de pago cuyos instrumentos son USDC en Arbitrum y pathUSD en Tempo, más la llave pública para verificar las firmas.
- **`POST /checkout_sessions`:** arma un carrito con tus links con precio y lo devuelve listo para pagar (`ready_for_payment`) y firmado, con una URL de pago por línea que responde 402. La sesión vence a los 15 minutos, y Peaje no implementa completar ni cancelar la sesión, porque el pago ocurre en cada URL.
- **`POST /agentic_commerce/delegate_payment`:** contesta con el error de ACP `unsupported_payment_method`, no recibe ni guarda datos de tarjeta y le indica al agente que pague por el 402.

Peaje no procesa compras ACP con tarjeta, no te inscribe en Instant Checkout de ChatGPT ni en el checkout de Google, y hoy no verifica mandatos AP2 que traiga un agente. Lo que sí hace es que un agente que habla ACP o UCP encuentre tus links con precio y llegue a un cobro que funciona, en lugar de un 404. El [radar gratis](https://usepeaje.com/radar) revisa en su capa de pagos si tu sitio responde ACP, UCP, AP2, x402 y MPP, y la lista completa de lo que mira un agente antes de comprarte está en [qué necesita mi tienda para que un agente de IA pueda comprarle](https://usepeaje.com/blog/que-necesita-mi-tienda-para-que-un-agente-de-ia-pueda-comprarle).

## Fuentes

- [Agentic Commerce Protocol](https://www.agenticcommerce.dev)
- [ACP en GitHub: especificación de checkout y de pago delegado](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [Stripe: Instant Checkout en ChatGPT y el Agentic Commerce Protocol](https://stripe.com/newsroom/news/stripe-openai-instant-checkout)
- [OpenAI: documentación de comercio](https://developers.openai.com/commerce/)
- [Google: anuncio del Universal Commerce Protocol](https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/)
- [Google Developers: cómo funciona UCP por dentro](https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/)
- [Universal Commerce Protocol](https://ucp.dev)
- [Google Cloud: anuncio de AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [Agent Payments Protocol](https://ap2-protocol.org/)
- [Google: donación de AP2 a la FIDO Alliance](https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
