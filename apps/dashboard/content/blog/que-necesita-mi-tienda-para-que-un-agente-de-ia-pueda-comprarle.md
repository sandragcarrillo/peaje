---
title: "¿Qué necesita mi tienda para que un agente de IA pueda comprarle?"
description: Las cuatro cosas que revisa un agente antes de comprarte (encontrarte, entenderte, usarte y pagarte), con un checklist por paso y los protocolos de compra que existen hoy.
date: 2026-10-29
slug: que-necesita-mi-tienda-para-que-un-agente-de-ia-pueda-comprarle
lang: es
categoria: Guía
portada: 4
portada_titulo: Tienda lista para agentes
traduccion: what-does-my-store-need-so-an-ai-agent-can-buy-from-it
---

# ¿Qué necesita mi tienda para que un agente de IA pueda comprarle?

Necesita cuatro cosas, en este orden: que el agente te encuentre, que entienda qué vendes y a qué precio, que pueda usar tu sitio sin trabarse y que tenga una forma de pagarte. Si falla cualquiera de las dos primeras, el agente nunca llega al pago, así que conviene empezar por ahí. El [radar gratis de Peaje](https://usepeaje.com/radar) revisa las cuatro en menos de un minuto.

Actualizado: octubre de 2026

El radar de Peaje agrupa sus chequeos en esas cuatro capas, es gratis y solo pide tu correo y tu dominio, según la [página del radar](https://usepeaje.com/radar).

## ¿Qué revisa un agente antes de comprarte?

| Paso | Qué necesita el agente | Qué falla más seguido |
| --- | --- | --- |
| Encontrarte | Permiso para leer tu sitio y un mapa de tus páginas | Un robots.txt o un firewall que bloquea a los bots de búsqueda |
| Entenderte | Tus productos, precios y datos en un formato que lee sin adivinar | Precios que solo aparecen con JavaScript o detrás de un login |
| Usarte | Botones, formularios y una conexión que funcionen sin una persona | La protección contra robots corta al agente en el carrito |
| Pagarte | Un protocolo de compra o de pago que el agente conozca | Un checkout que solo funciona con una persona escribiendo la tarjeta |

## ¿Qué necesita para encontrarte?

- Un `robots.txt` que deje pasar a los bots de búsqueda de OpenAI, Anthropic y Perplexity, y también a los que entran cuando un cliente le pide algo a su asistente. En [esta guía](https://usepeaje.com/blog/que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar) está cuál es cuál.
- Un `sitemap.xml` con la fecha de cambio de cada página.
- Que tu portada no tenga `noindex` y que salga arriba cuando alguien busca tu marca.

## ¿Qué necesita para entender qué vendes y a qué precio?

- **Datos estructurados (JSON-LD):** la ficha de tu negocio (Organization) y, en cada producto, su nombre, precio, moneda y disponibilidad (Product y Offer). Muchas plataformas de tienda ya generan los de producto, así que revisa que estén y que el precio coincida con el de la página.
- **Contenido sin JavaScript:** si el precio o la descripción solo aparecen después de que carga un script, muchos agentes no los ven.
- **Sin login para mirar:** el catálogo y los precios tienen que poder leerse sin iniciar sesión.
- **Una guía para agentes (llms.txt):** qué vendes, dónde está cada cosa y cómo comprarte.
- **Páginas de confianza:** quiénes son, contacto y privacidad, que el agente usa para decidir si eres un negocio real.

## ¿Qué necesita para usar tu tienda sin trabarse?

- **Una protección contra robots que distinga:** la que bloquea todo lo automático también corta al agente que compra por un cliente.
- **Botones y formularios bien hechos:** botones que son botones de verdad, con nombre, y campos con su etiqueta. Un agente que navega tu tienda los lee igual que un lector de pantalla.
- **Reintentos sin pedidos duplicados:** si tu tienda tiene API, que acepte una clave de idempotencia (Idempotency-Key), para que un agente pueda reintentar sin cobrar dos veces.
- **Una conexión directa (MCP u OpenAPI):** le permite al agente consultar productos o hacer un pedido sin pasar por las pantallas.

## ¿Cómo te paga un agente?

Hoy conviven varios protocolos, y cada asistente usa el suyo:

| Protocolo | Quién lo creó | Para qué sirve |
| --- | --- | --- |
| ACP (Agentic Commerce Protocol) | OpenAI y Stripe, septiembre de 2025 | Que el agente complete la compra en tu checkout. Es lo que usa la compra dentro de ChatGPT, que arrancó con vendedores de Etsy en Estados Unidos |
| UCP (Universal Commerce Protocol) | Google con Shopify, Walmart y otras empresas, enero de 2026 | Descubrir productos, comprar y la atención después de la compra, en el Modo IA de Google y en Gemini |
| AP2 (Agent Payments Protocol) | Google con más de 60 empresas, septiembre de 2025 | Probar con una firma que el cliente autorizó esa compra. Acepta tarjetas, transferencias y stablecoins |
| x402 y MPP | Coinbase, y Stripe con Tempo | Cobrar por cada uso con una respuesta HTTP 402. Sirven más para APIs y contenido digital que para un carrito. Comparamos los dos en [esta guía](https://usepeaje.com/blog/x402-vs-mpp-cual-protocolo-de-pago-para-agentes-de-ia-deberia-usar) |

Si vendes productos físicos en Shopify o Etsy, lo más probable es que ACP y UCP te lleguen a través de tu plataforma, así que revisa sus ajustes antes de construir nada. Si vendes acceso a una API o contenido por uso, el camino es el 402. Peaje responde con x402 y MPP en el mismo 402, hoy en redes de prueba, así que todavía no mueve dinero real.

## ¿Por dónde empiezo?

Por el [radar gratis](https://usepeaje.com/radar), que te dice en menos de un minuto en cuál de los cuatro pasos te caes. Después, el kit gratis de Peaje resuelve buena parte de los dos primeros: tu robots.txt, la ficha de tu negocio en JSON-LD, llms.txt, un servidor MCP y agent cards. Lo sacas registrando tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo) y lo instalas desde tu panel, con un texto para tu herramienta de IA o con un comando. Los datos de cada producto y el checkout siguen siendo de tu plataforma de tienda.

Si quieres que alguien revise todo esto contigo cada semana, el agente Pro cuesta US$30 al mes (precio de fundador para los primeros 50 negocios, después US$69), con 500 créditos al mes y 20 preguntas seguidas en asistentes de IA.

## Fuentes

- [Agentic Commerce Protocol](https://www.agenticcommerce.dev)
- [OpenAI: compras dentro de ChatGPT](https://openai.com/index/buy-it-in-chatgpt/)
- [Universal Commerce Protocol](https://ucp.dev)
- [Shopify: resumen de NRF 2026 y el UCP de Google](https://www.shopify.com/enterprise/blog/nrf-2026-recap)
- [Google Cloud: anuncio de AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
- [Precios de Peaje](https://usepeaje.com/precios)
