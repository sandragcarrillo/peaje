---
title: "¿Qué es MCP (Model Context Protocol) y en qué se diferencia de una API?"
description: Qué es el Model Context Protocol, cómo lo usan ChatGPT, Claude y Cursor, en qué se diferencia de una API normal, si necesitas los dos y qué trae el servidor MCP del kit de Peaje.
date: 2026-11-05
slug: que-es-mcp-y-en-que-se-diferencia-de-una-api
lang: es
categoria: Guía
portada: 1
portada_titulo: MCP y API
traduccion: what-is-mcp-and-how-is-it-different-from-an-api
---

# ¿Qué es MCP (Model Context Protocol) y en qué se diferencia de una API?

MCP es un estándar abierto para conectar aplicaciones de IA, como ChatGPT, Claude o Cursor, con datos y herramientas de afuera. Una API está hecha para que un programador lea la documentación y escriba código que la llame, y un servidor MCP está hecho para que la IA descubra sola qué puede hacer, con qué datos y cómo, en el momento en que lo necesita. Muchas veces un servidor MCP se monta encima de una API que ya existe.

Actualizado: noviembre de 2026

La [documentación oficial de MCP](https://modelcontextprotocol.io/docs/getting-started/intro) lo compara con un puerto USB-C: una forma estándar de conectar una aplicación de IA con lo que sea. Lo soportan, entre otros, Claude, ChatGPT, VS Code y Cursor.

## ¿Cómo funciona MCP?

Hay tres piezas:

- **El host:** la aplicación de IA que usa la persona, como Claude Code o ChatGPT.
- **El cliente:** la conexión que el host abre con cada servidor.
- **El servidor:** el programa que ofrece datos y acciones, por ejemplo el de tu tienda.

Un servidor ofrece tres tipos de cosas: herramientas (acciones que la IA puede ejecutar, como consultar un pedido), recursos (datos que la IA puede leer, como tu lista de precios) y prompts (plantillas para pedir algo bien). La IA le pide la lista de herramientas al servidor con `tools/list`, lee la descripción y los parámetros de cada una, y la llama con `tools/call`. Los mensajes van en JSON-RPC, por la terminal de tu computador o por HTTP si el servidor está en internet.

## ¿En qué se diferencia de una API?

| | API | MCP |
| --- | --- | --- |
| Para quién está hecha | Para un programador que escribe código | Para una aplicación de IA que decide sola qué usar |
| Cómo se descubre | Leyendo la documentación | Preguntándole al servidor qué herramientas tiene |
| Qué describe | Rutas, métodos y formatos | Herramientas con su descripción en palabras y sus parámetros |
| Cuándo se conecta | Cuando alguien escribe la integración | Cuando la persona agrega el servidor a su aplicación de IA |
| Cómo se llama | HTTP, REST, GraphQL u otro | JSON-RPC, por la terminal o por HTTP |

La diferencia que más pesa es la descripción. En una API, el nombre de una ruta le basta a un programador que leyó la documentación, y en MCP la IA elige una herramienta por lo que dice su descripción, así que escribirla bien es parte del trabajo.

## ¿Necesito las dos?

Si ya tienes una API, no la reemplazas: le agregas un servidor MCP que la envuelve, y cada herramienta llama por debajo a una ruta de tu API. Si no tienes API, un servidor MCP igual puede ofrecer lo que está en tu sitio, como tu catálogo, tus precios y tus preguntas frecuentes. Y si solo quieres que los asistentes te encuentren y te citen, MCP ayuda, pero lo primero es que tu sitio se pueda leer: `llms.txt`, datos estructurados y páginas en texto ([por dónde empezar](https://usepeaje.com/blog/como-anado-llms-txt-y-json-ld-para-que-la-ia-entienda-mi-web)).

## ¿Qué trae el servidor MCP del kit de Peaje?

El kit gratis de Peaje deja un servidor MCP en tu propio dominio, en `/mcp`, que los agentes encuentran también en `/.well-known/mcp`. Trae:

- Una herramienta `get_pricing`, gratis, con lo que cobras y cómo se paga.
- Una herramienta por cada ruta de tu API que publiques en Peaje, con su descripción.
- Una herramienta por cada link con precio.
- Una guía y tu tabla de precios como recursos.

Las herramientas con precio cobran cuando se llaman, con MPP: si el agente no pagó, el servidor le contesta con la oferta de pago, y cuando paga recibe el resultado con su recibo. Lo explicamos paso a paso en [cómo creo un servidor MCP para mi tienda sin saber programar](https://usepeaje.com/blog/como-creo-un-servidor-mcp-para-mi-tienda-sin-saber-programar). El kit lo sacas registrando tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo), sin tarjeta.

## Fuentes

- [MCP: qué es el Model Context Protocol](https://modelcontextprotocol.io/docs/getting-started/intro)
- [MCP: arquitectura](https://modelcontextprotocol.io/docs/learn/architecture)
- [Precios de Peaje](https://usepeaje.com/precios)
