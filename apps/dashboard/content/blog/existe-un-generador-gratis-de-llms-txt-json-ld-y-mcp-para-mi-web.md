---
title: "¿Existe un generador gratis de llms.txt, JSON-LD y MCP para mi web?"
description: Las opciones gratis para generar llms.txt, JSON-LD y un servidor MCP para tu sitio, qué cubre cada una, cómo revisar lo que generan y qué hace el kit gratis de Peaje.
date: 2026-11-03
slug: existe-un-generador-gratis-de-llms-txt-json-ld-y-mcp-para-mi-web
lang: es
categoria: Guía
portada: 1
portada_titulo: Generador gratis para agentes
traduccion: is-there-a-free-generator-for-llms-txt-json-ld-and-mcp-for-my-website
---

# ¿Existe un generador gratis de llms.txt, JSON-LD y MCP para mi web?

Sí. El kit gratis de Peaje genera los tres para tu sitio, junto con openapi.json y agent cards, y los deja respondiendo en tu dominio, sin tarjeta y sin fecha de vencimiento. Si solo necesitas el llms.txt, varias plataformas ya lo generan solas, como Yoast SEO en WordPress, Wix o Mintlify y GitBook para sitios de documentación.

Actualizado: noviembre de 2026

El kit cuesta US$0 e incluye también el registro de visitas de agentes y un monitor diario, según la [página de precios](https://usepeaje.com/precios).

## ¿Qué opciones gratis hay para cada archivo?

| Archivo | Opciones gratis | Qué cubren |
| --- | --- | --- |
| llms.txt | Yoast SEO (WordPress), Wix, Mintlify, GitBook, plugins para Docusaurus y VitePress | La guía de tu sitio para agentes, armada con tus páginas |
| JSON-LD | Tu plataforma de tienda, para los productos, y los generadores de schema en línea | Los datos de tu negocio y tus productos en un formato que la IA lee sin adivinar |
| Servidor MCP | Los SDK oficiales de MCP, si alguien de tu equipo lo programa | La conexión directa para que un agente consulte o use lo que ofreces |
| Los tres juntos | El kit de Peaje | llms.txt, JSON-LD, servidor MCP, openapi.json y agent cards, con datos de tu sitio |

La lista de herramientas que generan llms.txt está en la [página oficial del estándar](https://llmstxt.org/), que propuso Jeremy Howard en septiembre de 2024. Yoast lo agregó a su versión gratis en junio de 2025, y se prende desde los ajustes del plugin ([Search Engine Journal](https://www.searchenginejournal.com/yoast-seo-wordpress-plugin-adds-support-for-llms-txt/549220/)).

## ¿Qué genera el kit de Peaje?

- **llms.txt:** qué es tu sitio, dónde está cada cosa y cómo usarlo.
- **JSON-LD:** la ficha de tu negocio (Organization) en el `<head>` de tu portada, con el logo, el teléfono, la dirección, la descripción y tus perfiles en otros sitios que cargues en tu panel. Solo pone lo que llenas.
- **Servidor MCP:** en `/mcp` de tu dominio, con tus rutas de API como herramientas que un agente puede usar.
- **openapi.json:** la descripción de tu API, si tienes rutas publicadas.
- **Agent cards:** la ficha de tu negocio para agentes en `/.well-known/`.
- **robots.txt:** un bloque que deja pasar por nombre a los bots que citan, sin tocar tus reglas.

Todo se arma con los datos de tu sitio y se actualiza solo cuando cambias algo en tu panel, por ejemplo una ruta nueva.

## ¿Qué no genera?

No genera los datos de cada producto. Si tienes una tienda, el JSON-LD de producto (nombre, precio, moneda y disponibilidad) lo genera tu plataforma, y conviene revisar que esté y que el precio coincida con el de la página ([qué necesita tu tienda](https://usepeaje.com/blog/que-necesita-mi-tienda-para-que-un-agente-de-ia-pueda-comprarle)). Tampoco escribe las páginas de tu sitio: eso lo hace el agente Pro.

## ¿Cómo lo instalo?

Registra tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo) y entra a "Kit" en tu panel. Ahí tienes dos caminos: un texto para pegarle a tu herramienta de IA (Claude Code, Cursor, Codex) o el comando `npx @peaje/cli@1 init <slug>`, que reconoce Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Hono, Express y Vite ([referencia del comando](https://usepeaje.com/blog/como-instalo-el-kit-de-peaje-en-mi-proyecto-con-un-comando)). Si tu sitio está en WordPress o Wix, usa el llms.txt de tu plataforma y empieza por el radar para ver qué más falta.

## ¿Cómo reviso lo que genera cualquier herramienta?

- **llms.txt:** abre `tusitio.com/llms.txt` en el navegador y revisa que los links funcionen.
- **JSON-LD:** pasa tu portada por la [prueba de resultados enriquecidos de Google](https://search.google.com/test/rich-results) o por el [validador de schema.org](https://validator.schema.org/).
- **Todo junto:** el [radar gratis de Peaje](https://usepeaje.com/radar) revisa estos archivos y te dice qué falta, en menos de un minuto y solo con tu correo y tu dominio.

## Fuentes

- [llms.txt: el estándar y sus herramientas](https://llmstxt.org/)
- [Search Engine Journal: Yoast SEO agrega llms.txt](https://www.searchenginejournal.com/yoast-seo-wordpress-plugin-adds-support-for-llms-txt/549220/)
- [Yoast: cómo activar llms.txt](https://yoast.com/help/enable-llmstxt/)
- [Model Context Protocol: SDK oficiales](https://modelcontextprotocol.io/docs/sdk)
- [Precios de Peaje](https://usepeaje.com/precios)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
