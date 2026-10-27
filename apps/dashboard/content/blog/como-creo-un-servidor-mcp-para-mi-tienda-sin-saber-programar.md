---
title: ¿Cómo creo un servidor MCP para mi tienda sin saber programar?
description: Qué hace el servidor MCP que genera Peaje, cómo se instala, en qué sitios funciona hoy y cuánto cuesta.
date: 2026-10-27
slug: como-creo-un-servidor-mcp-para-mi-tienda-sin-saber-programar
lang: es
categoria: Guía
portada: 1
portada_titulo: Tu tienda en MCP
traduccion: how-do-i-set-up-an-mcp-server-for-my-store-without-coding
---

# ¿Cómo creo un servidor MCP para mi tienda sin saber programar?

No tienes que escribir código: Peaje genera el servidor MCP de tu sitio y lo deja respondiendo en tu propio dominio con un comando, `npx @peaje/cli@1 init <slug>`, que se corre en el proyecto de tu sitio. Hoy ese comando funciona en sitios con su propio código (Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Vite, Express, Hono o un sitio estático), y Shopify y WooCommerce no están en esa lista. Va en el plan gratis, sin tarjeta.

Actualizado: octubre de 2026

El kit gratis incluye el servidor MCP, llms.txt, openapi.json, agent cards y JSON-LD generados para tu sitio, más el registro de visitas de agentes y un monitor diario, sin tarjeta y sin fecha de vencimiento ([precios](https://usepeaje.com/precios)).

## ¿Qué pasos sigo para crearlo?

1. Pega tu dominio en el [radar gratis](https://usepeaje.com/radar) y en menos de un minuto ves qué entiende un agente y qué le falta, solo con tu correo.
2. [Registra tu sitio](https://usepeaje.com/nuevo), sin tarjeta. Registrarlo no cambia nada en tu sitio, y ahí sale el slug de tu negocio.
3. En el proyecto de tu sitio, corre `npx @peaje/cli@1 plan <slug>` para ver qué archivos va a crear o cambiar, sin escribir nada todavía.
4. Corre `npx @peaje/cli@1 init <slug> --yes` y publica tu sitio. El comando trae el kit con tu servidor MCP y los archivos que leen los agentes, y si hace falta instalar un paquete, te dice cuál.
5. Revisa que quedó bien con `npx @peaje/cli@1 verify <slug>`, que mide tu dominio en vivo.

Si quien lleva tu web usa una herramienta de código con IA, como Claude Code o Cursor, le puede pedir que corra estos pasos.

## ¿Qué es un servidor MCP y para qué sirve en tu sitio?

MCP (Model Context Protocol) es un estándar abierto para que un agente de IA se conecte a un servicio y use sus herramientas directamente, en vez de ir leyendo página por página. El servidor MCP de Peaje responde en tu propio dominio, en `/mcp`, y le da al agente una guía de cómo usar tu sitio. Es una de las cosas que revisa el radar cuando mira si un agente te puede usar.

## ¿Cuánto cuesta?

El radar y el kit son gratis, sin tarjeta, y solo pagas si quieres el agente: Pro cuesta US$30 al mes como precio de fundador para los primeros 50 negocios, y US$69 al mes después. Incluye 500 créditos al mes para el trabajo del agente y 20 preguntas seguidas en asistentes de IA, y hablar con tu agente no gasta créditos ([precios](https://usepeaje.com/precios)).

## ¿Y si el comando me da miedo o no tengo quién lo instale?

Con Pro, tu agente de Peaje te explica cada arreglo en palabras simples, lo escribe y lo deja como tarea, para que se lo pases a quien lleva tu web o a tu herramienta de código. Te habla por Telegram o en tu panel, sin reuniones ni llamadas. Las páginas que te escribe las puedes copiar en cualquier sitio, también en Shopify o WooCommerce, aunque el comando del kit no se instale ahí.

## ¿Cómo sé si funcionó?

El comando `verify` revisa tu dominio en vivo y te dice si todo responde, y el radar te da tu puntaje de hoy y hasta dónde puede llegar con Peaje, que en el ejemplo del sitio es un 46 D que sube a ~74 B. Con el kit instalado tienes el registro de visitas de agentes a tu sitio y un monitor diario. Con Pro, tu agente les pregunta a ChatGPT y a Claude lo que preguntan tus clientes, te dice si te citan, vuelve a medir a las 2 y a las 6 semanas y te manda un reporte semanal por correo. Si cancelas, te quedas con el diagnóstico y los arreglos que tu agente ya te entregó.

## Fuentes

- [Peaje: cómo funciona y preguntas frecuentes](https://usepeaje.com/)
- [Precios](https://usepeaje.com/precios)
- [Radar gratis](https://usepeaje.com/radar)
- [Registrar tu sitio](https://usepeaje.com/nuevo)
- [@peaje/cli en npm](https://www.npmjs.com/package/@peaje/cli): los comandos plan, init y verify, y las tecnologías que detecta.
