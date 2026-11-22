---
title: "¿Qué es MCP (Model Context Protocol) y en qué se diferencia de una API?"
description: Qué es MCP, qué son un servidor MCP y un conector MCP, cómo funciona paso a paso, en qué se diferencia de una API, cómo se implementa y un ejemplo real con el servidor de Peaje.
date: 2026-11-05
updated: 2026-11-22
slug: que-es-mcp-y-en-que-se-diferencia-de-una-api
lang: es
categoria: Guía
portada: 1
portada_titulo: MCP y API
traduccion: what-is-mcp-and-how-is-it-different-from-an-api
---

# ¿Qué es MCP (Model Context Protocol) y en qué se diferencia de una API?

MCP (Model Context Protocol) es un estándar abierto para conectar aplicaciones de IA como Claude, ChatGPT o Cursor con datos y herramientas de afuera. Un servidor MCP es el programa que ofrece esas herramientas: la IA le pregunta qué puede hacer, lee la descripción de cada herramienta y llama a la que necesita. Una API está hecha para que un programador lea la documentación y escriba el código, y MCP está hecho para que la IA lo descubra sola. Muchas veces un servidor MCP se monta encima de una API que ya existe.

Actualizado: 22 de noviembre de 2026

La [documentación oficial de MCP](https://modelcontextprotocol.io/docs/getting-started/intro) lo compara con un puerto USB-C: una sola forma estándar de enchufar una aplicación de IA a lo que sea. Anthropic lo publicó el 25 de noviembre de 2024, y el 9 de diciembre de 2025 lo donó a la Agentic AI Foundation, parte de la Linux Foundation, que fundaron Anthropic, Block y OpenAI. En ese momento MCP tenía unos 10.000 servidores activos y 97 millones de descargas mensuales de sus SDK, según el [blog de MCP](https://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/). La versión actual de la especificación es la 2026-07-28.

## ¿Qué es un servidor MCP?

Es un programa que le da a una aplicación de IA tres tipos de cosas:

- **Herramientas:** acciones que la IA puede ejecutar, como consultar un pedido o buscar en un catálogo.
- **Recursos:** datos que la IA puede leer, como una lista de precios o el esquema de una base de datos.
- **Prompts:** plantillas para pedir algo bien.

Un servidor puede correr en tu computador (servidor local, que se comunica por la terminal) o en internet (servidor remoto, que se comunica por HTTP y atiende a muchas personas a la vez). Claude, ChatGPT, VS Code y Cursor, entre otros, soportan MCP.

## ¿Cómo funciona un servidor MCP?

Hay tres partes. El host es la aplicación de IA que usa la persona, como Claude Code. El cliente es la conexión que el host abre con cada servidor, una por servidor. El servidor es el programa con las herramientas. Una conversación va así:

1. **La persona agrega el servidor** a su aplicación de IA, con su URL o con el comando que lo arranca.
2. **El cliente pregunta qué soporta el servidor.** Desde la versión 2026-07-28 cada pedido lleva la versión del protocolo y lo que el cliente puede hacer, y el servidor contesta `server/discover` con sus versiones y sus capacidades.
3. **El cliente pide la lista de herramientas** con `tools/list`. Cada herramienta trae un nombre, una descripción en palabras y los parámetros que acepta.
4. **El modelo elige una herramienta.** Cuando la persona pide algo, el modelo lee las descripciones y decide cuál usar y con qué datos.
5. **El cliente la llama** con `tools/call`, y el servidor hace el trabajo y devuelve el resultado en texto, imágenes o datos estructurados.
6. **El modelo responde** con ese resultado. Si las herramientas del servidor cambian, puede avisarle al cliente para que pida la lista otra vez.

Todos los mensajes van en JSON-RPC 2.0. Un servidor local los recibe por la entrada y la salida estándar, y uno remoto por Streamable HTTP, donde la especificación de MCP recomienda OAuth para iniciar sesión.

## ¿Qué es un conector MCP?

Es el nombre que usa Claude para un servidor MCP cuando lo agregas. La documentación de Anthropic lo dice así: un servidor MCP le da a Claude acceso a tu producto o tus datos, y quien usa Claude lo ve como un conector. Lo agregas como conector personalizado con su URL, o lo instalas desde el directorio de Claude. En ChatGPT agregas un servidor MCP personalizado, y los plugins con los que ChatGPT le compra a una tienda son, según OpenAI, un servidor MCP más skills.

## ¿En qué se diferencia de una API?

| | API | MCP |
| --- | --- | --- |
| Para quién está hecha | Para un programador que escribe código | Para una aplicación de IA que decide sola qué usar |
| Cómo se descubre | Leyendo la documentación | Preguntándole al servidor qué herramientas tiene |
| Qué describe | Rutas, métodos y formatos | Herramientas con su descripción en palabras y sus parámetros |
| Cuándo se conecta | Cuando alguien escribe la integración | Cuando la persona agrega el servidor a su aplicación de IA |
| Cómo se llama | HTTP, REST, GraphQL u otro | JSON-RPC 2.0, por la terminal o por Streamable HTTP |

La diferencia que más pesa es la descripción. En una API, el nombre de una ruta le basta a un programador que leyó la documentación. En MCP el modelo elige una herramienta por lo que dice su descripción, así que escribirla bien es parte del trabajo.

## ¿Necesito las dos?

Si ya tienes una API, no la reemplazas: le agregas un servidor MCP que la envuelve, y cada herramienta llama por debajo a una ruta de tu API. Si no tienes API, un servidor MCP igual puede ofrecer lo que está en tu sitio, como tu catálogo y tus preguntas frecuentes. Y si solo quieres que los asistentes te encuentren y te citen, MCP ayuda, pero lo primero es que tu sitio se pueda leer: `llms.txt`, datos estructurados y páginas en texto ([por dónde empezar](https://usepeaje.com/blog/como-anado-llms-txt-y-json-ld-para-que-la-ia-entienda-mi-web)).

## ¿Cómo se implementa un servidor MCP?

El camino de siempre tiene cuatro pasos:

1. **Elige qué ofreces.** Pocas herramientas que hagan una cosa clara cada una, con una descripción que diga cuándo usarla.
2. **Usa un SDK oficial.** Hay SDK para TypeScript y Python, entre otros lenguajes, que se encargan del protocolo por ti.
3. **Pruébalo.** El MCP Inspector te deja llamar cada herramienta a mano. Después agrégalo a Claude como conector personalizado y pregúntale algo real.
4. **Publícalo.** Para que otros lo encuentren, puedes listarlo en el [registro oficial de MCP](https://usepeaje.com/blog/como-publico-mi-servidor-mcp-en-el-registro-oficial-de-mcp).

Si tienes un sitio web y no quieres escribir código, el kit gratis de Peaje genera un servidor MCP para tu sitio con un comando, que responde en tu propio dominio en `/mcp` con una guía para usar tu sitio ([paso a paso](https://usepeaje.com/blog/como-creo-un-servidor-mcp-para-mi-tienda-sin-saber-programar)).

## Un ejemplo: el servidor MCP de Peaje

Peaje tiene un servidor MCP remoto en `https://api.usepeaje.com/_owner/mcp`. Lo conectas a Claude Code, Cursor, Codex, Claude o ChatGPT, y le da a tu herramienta de IA una lista corta de herramientas, entre ellas `peaje_plan` (tu meta y tus prioridades), `peaje_ask` (preguntarle a tu agente por tu negocio), `peaje_list_tasks`, `peaje_get_task` y `peaje_complete_task`.

Este artículo pasó por ese servidor. El agente de Peaje vio en Search Console que esta página salía en búsquedas como "que es mcp" e "implementacion mcp" sin responderlas bien, y dejó una tarea. Claude Code la leyó con `peaje_get_task`, con sus instrucciones y los criterios que revisa Peaje, y de ahí salió el cambio que estás leyendo. Cómo conectarlo, y qué puede hacer sin tu aprobación, está en la [documentación del MCP de Peaje](https://usepeaje.com/docs/mcp). Las tareas y la conexión vienen con Pro, que cuesta US$30 al mes como precio fundador para los primeros 50 negocios, y US$69 después ([precios](https://usepeaje.com/precios)).

## Preguntas frecuentes

### ¿Qué significa MCP?

Model Context Protocol, protocolo de contexto para modelos. El "contexto" son los datos y las herramientas que una aplicación de IA recibe de afuera para responder o actuar.

### ¿Quién mantiene MCP?

Lo creó Anthropic, y desde diciembre de 2025 vive en la Agentic AI Foundation, dentro de la Linux Foundation. El proyecto conserva sus propios mantenedores y su dirección técnica.

### ¿MCP es solo para Claude?

No. Lo soportan ChatGPT, VS Code, Cursor y muchas otras herramientas, así que un mismo servidor sirve en todas.

### ¿MCP es seguro?

Depende del servidor. Un servidor puede leer datos y hacer cosas por ti, así que conecta solo los que conoces, revisa qué hace cada herramienta y prefiere los que te piden aprobación antes de cambiar algo.

## Fuentes

- [MCP: qué es el Model Context Protocol](https://modelcontextprotocol.io/docs/getting-started/intro)
- [MCP: arquitectura](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP: versiones de la especificación](https://modelcontextprotocol.io/specification/versioning)
- [Anthropic: presentación del Model Context Protocol (25 de noviembre de 2024)](https://www.anthropic.com/news/model-context-protocol)
- [Blog de MCP: MCP se une a la Agentic AI Foundation (9 de diciembre de 2025)](https://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/)
- [Claude: crear un servidor MCP para Claude](https://claude.com/docs/connectors/building)
- [OpenAI: MCP en la API y en ChatGPT](https://developers.openai.com/api/docs/mcp/)
- [OpenAI: crear un plugin de comercio](https://developers.openai.com/commerce/guides/build-a-plugin)
- [Documentación del MCP de Peaje](https://usepeaje.com/docs/mcp)
- [Precios de Peaje](https://usepeaje.com/precios)
