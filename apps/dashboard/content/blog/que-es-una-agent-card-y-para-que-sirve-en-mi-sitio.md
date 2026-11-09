---
title: "¿Qué es una agent card y para qué sirve en mi sitio?"
description: Qué es la agent card del protocolo A2A, dónde va en tu dominio, qué campos tiene, quién creó el protocolo y qué pone el kit de Peaje en la tarjeta de tu sitio.
date: 2026-11-07
slug: que-es-una-agent-card-y-para-que-sirve-en-mi-sitio
lang: es
categoria: Guía
portada: 3
portada_titulo: Qué es una agent card
traduccion: what-is-an-agent-card-and-what-is-it-for-on-my-site
---

# ¿Qué es una agent card y para qué sirve en mi sitio?

Una agent card es un archivo JSON que describe a un agente o a un servicio para que otros agentes de IA sepan qué hace, cómo conectarse y qué autenticación pide. Viene del protocolo A2A (Agent2Agent) y vive en una dirección fija de tu dominio, `/.well-known/agent-card.json`, así que un agente la encuentra sin que nadie le pase el link.

Actualizado: noviembre de 2026

A2A tiene el respaldo de más de 150 organizaciones, según el [blog oficial del proyecto](https://a2a-protocol.org/latest/blog/2026/08/27/a-new-chapter-for-a2a-joining-the-agentic-ai-foundation/), que el 27 de agosto de 2026 anunció su entrada a la Agentic AI Foundation, dirigida por la Linux Foundation.

## ¿Quién creó A2A y dónde vive hoy?

Google lo [presentó el 9 de abril de 2025](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) con más de 50 empresas de tecnología como socias. El 23 de junio de 2025 lo donó a la Linux Foundation, que [lanzó el proyecto Agent2Agent](https://linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) con la especificación, los SDK y las herramientas de Google, y con el apoyo de empresas como AWS, Cisco, Microsoft, Salesforce, SAP y ServiceNow. La versión 1.0 de la especificación salió el 12 de marzo de 2026.

Hoy la documentación está en [a2a-protocol.org](https://a2a-protocol.org/latest/specification/) y el código en GitHub, en la organización [a2aproject](https://github.com/a2aproject/A2A). La dirección `/.well-known/agent-card.json` está definida en la misma especificación, que la propone para el registro de IANA, el organismo que lleva la lista oficial de estas direcciones.

## ¿Qué campos tiene una agent card?

Estos son los de la versión 1.0, con los nombres tal como van en el JSON:

| Campo | Qué dice | ¿Obligatorio? |
| --- | --- | --- |
| `name` | El nombre del agente o servicio | Sí |
| `description` | Qué hace | Sí |
| `supportedInterfaces` | Las URLs y protocolos para hablarle (JSON-RPC, gRPC o HTTP+JSON) | Sí |
| `version` | La versión del agente | Sí |
| `capabilities` | Si hace streaming, si manda notificaciones y si tiene una tarjeta extendida | Sí |
| `defaultInputModes` y `defaultOutputModes` | Los formatos que recibe y entrega, como `application/json` | Sí |
| `skills` | Sus habilidades, cada una con `id`, `name`, `description` y `tags` | Sí |
| `provider` | La organización que lo ofrece y su URL | No |
| `securitySchemes` y `securityRequirements` | Cómo autenticarse | No |
| `documentationUrl` e `iconUrl` | Su documentación y su ícono | No |
| `signatures` | Una firma que prueba que nadie cambió la tarjeta | No |

La especificación pide que la tarjeta no traiga credenciales ni detalles internos, recomienda servirla por HTTPS y sugiere cabeceras de caché, porque cambia poco y los agentes la piden seguido.

## ¿Para qué me sirve tener una en mi sitio?

Un agente que llega a tu dominio puede leer la tarjeta antes de hacer nada y saber en un solo pedido qué ofreces, en qué formato y, si lo pones en la descripción, cuánto cuesta. La especificación también contempla que los agentes la encuentren en catálogos o registros, y el registro [ERC-8004](https://usepeaje.com/blog/que-es-erc-8004-y-para-que-sirve-el-registro-de-agentes-de-ia) tiene un campo para apuntar a ella. Tenerla te hace legible para los agentes que la buscan, aunque eso solo no garantiza que te elijan. Junto con llms.txt y openapi.json, es uno de los archivos que un agente puede revisar cuando busca una API ([cómo encuentran los agentes de IA mi API](https://usepeaje.com/blog/como-encuentran-los-agentes-de-ia-mi-api)).

## ¿Qué pone el kit de Peaje en mi agent card?

El kit la arma con los datos de tu negocio en Peaje y la sirve en tu dominio, en inglés, porque la leen agentes. Trae el nombre, la descripción de tu negocio, la URL de tu sitio, una versión, las capacidades (sin streaming ni notificaciones), JSON como formato de entrada y salida, y una habilidad por cada ruta o link con precio, con su precio por llamada. Si tienes los cobros apagados, ese precio sale en 0. Así se ve, recortada, la tarjeta de usepeaje.com:

```json
{
  "name": "Peaje",
  "description": "Peaje makes websites and APIs discoverable and readable by AI agents, ...",
  "url": "https://usepeaje.com",
  "version": "1.0.0",
  "capabilities": { "streaming": false, "pushNotifications": false },
  "defaultInputModes": ["application/json"],
  "defaultOutputModes": ["application/json"],
  "skills": [
    {
      "id": "get_api_radar__dominio",
      "name": "Agent-readiness score for any website, measured by Ora. ..."
    }
  ]
}
```

Hay dos límites que conviene que sepas:

- **Peaje no levanta un servidor A2A.** La tarjeta dice qué ofreces, pero un agente que quiera mandarte mensajes por A2A no tiene con quién hablar: la compra pasa por tus rutas con precio, que responden 402, o por tu servidor MCP en `/mcp`.
- **La tarjeta usa la forma de las versiones anteriores de A2A**, con un campo `url`, y todavía no trae `supportedInterfaces` ni `tags` en cada habilidad, que la versión 1.0 marca como obligatorios. Un cliente que valide la tarjeta al pie de la letra la puede rechazar.

La instalas con el resto del kit, con `npx @peaje/cli@1 init <slug>` o pegando un texto en tu herramienta de IA ([cómo instalo el kit de Peaje](https://usepeaje.com/blog/como-instalo-el-kit-de-peaje-en-mi-proyecto-con-un-comando)). El kit es parte del [plan gratis](https://usepeaje.com/precios).

## Fuentes

- [Especificación de A2A](https://a2a-protocol.org/latest/specification/)
- [Google: lanzamiento de A2A](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [Linux Foundation: lanzamiento del proyecto Agent2Agent](https://linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents)
- [A2A: versión 1.0](https://a2a-protocol.org/latest/blog/2026/03/12/a2a-protocol-ships-v10-production-ready-standard-for-agent-to-agent-communication/)
- [A2A: entrada a la Agentic AI Foundation](https://a2a-protocol.org/latest/blog/2026/08/27/a-new-chapter-for-a2a-joining-the-agentic-ai-foundation/)
- [Repositorio de A2A en GitHub](https://github.com/a2aproject/A2A)
- [Agent card de Peaje](https://usepeaje.com/.well-known/agent-card.json)
