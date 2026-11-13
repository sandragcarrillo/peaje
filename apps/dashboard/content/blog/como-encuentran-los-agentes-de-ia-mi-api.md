---
title: "¿Cómo encuentran los agentes de IA mi API?"
description: Dónde buscan los agentes de IA las APIs que pueden usar y pagar, qué archivos tiene que publicar tu sitio para que te encuentren y en qué directorios conviene aparecer.
date: 2026-11-05
slug: como-encuentran-los-agentes-de-ia-mi-api
lang: es
categoria: Guía
portada: 3
portada_titulo: Que tu API se encuentre
traduccion: how-do-ai-agents-find-my-api
---

# ¿Cómo encuentran los agentes de IA mi API?

De tres formas: leyendo archivos conocidos en tu propio dominio, como `llms.txt`, `openapi.json` o `/.well-known/mcp`, buscando en directorios de servidores MCP y de servicios que cobran por pedido, y siguiendo lo que encuentran cuando alguien busca algo en la web. Un agente no lee tu landing como una persona, así que si tu API no está descrita en esos lugares, para él no existe aunque funcione perfecto.

Actualizado: noviembre de 2026

El kit gratis de Peaje publica esos archivos en tu dominio, y cada ruta que agregas en tu panel entra en ellos al instante. El [radar gratis](https://usepeaje.com/radar) revisa, entre otras cosas, si tu servidor MCP aparece en un directorio ([qué es MCP y en qué se diferencia de una API](https://usepeaje.com/blog/que-es-mcp-y-en-que-se-diferencia-de-una-api)).

## ¿Qué archivos busca un agente en mi dominio?

| Archivo | Qué le dice al agente |
| --- | --- |
| `/llms.txt` | Qué hace tu negocio y dónde está cada cosa, en texto, con una sección de pagos para agentes |
| `/openapi.json` | Cada ruta de tu API, con sus parámetros, su respuesta y su precio |
| `/mcp` y `/.well-known/mcp` | Tu servidor MCP, con una herramienta por ruta |
| `/.well-known/agent-card.json` | La tarjeta de tu servicio para agentes, con lo que sabe hacer y cuánto cuesta |
| `/.well-known/api-catalog` | El índice de tus APIs, en el formato estándar de la IETF (RFC 9727) |
| `/discovery/resources` | La lista de lo que cobras, en el formato de catálogo de x402 |
| `/auth.md` y `/pricing.md` | Cómo se paga y cuánto, explicado para un agente |

Si un agente llega a una ruta con precio sin haber leído nada, el propio 402 le dice cuánto cuesta y cómo pagar ([qué trae el 402](https://usepeaje.com/blog/que-es-el-codigo-402-payment-required-y-que-pasa-si-un-agente-pide-sin-pagar)).

## ¿En qué directorios conviene aparecer?

- **El registro oficial de MCP,** en [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/), donde los clientes de IA buscan servidores.
- **El directorio de servicios de MPP,** que arrancó con más de 100 servicios según [Tempo](https://tempo.xyz/blog/mainnet).
- **El Bazaar de x402,** el directorio de servicios que cobran con x402. Tu `/discovery/resources` sigue su formato.

Además, los agentes que buscan en la web llegan por tus páginas públicas, igual que ChatGPT o Claude cuando citan a alguien. Una página de documentación en texto, con ejemplos, te sirve para las dos cosas.

## ¿Qué hace que un agente elija mi API?

Lo decide la descripción: un agente elige si te llama, y si te paga, por lo que dice cada ruta, así que escríbela para alguien que no conoce tu negocio:

- **Qué devuelve,** en una frase, con los datos que trae.
- **En qué formato,** con un ejemplo de respuesta.
- **Cuánto cuesta,** si tiene precio.
- **Cuándo usarla,** con un caso concreto.

"Devuelve el pronóstico de lluvia por hora de los próximos 30 días para una ciudad de Colombia, en JSON, por US$0,05 la consulta" le sirve más a un agente que "Endpoint de pronóstico".

## ¿Cómo lo hago con Peaje?

1. Registra tu sitio en [usepeaje.com/nuevo](https://usepeaje.com/nuevo), sin tarjeta.
2. Publica tus rutas en Rutas, con su descripción y su precio ([paso a paso](https://usepeaje.com/blog/como-les-cobro-a-los-agentes-de-ia-por-usar-mi-api)).
3. Instala el kit, que deja todos los archivos de la tabla en tu dominio.
4. Mide tu sitio en el [radar](https://usepeaje.com/radar) para ver qué ve un agente cuando llega.

Después, en "Visitas de agentes" ves quién te visita, incluidos los clientes que pagan con MPP o con x402, y qué rutas piden.

## Fuentes

- [Registro oficial de MCP](https://registry.modelcontextprotocol.io/)
- [RFC 9727: api-catalog](https://www.rfc-editor.org/rfc/rfc9727)
- [Tempo: lanzamiento de la red principal y de MPP](https://tempo.xyz/blog/mainnet)
- [x402](https://www.x402.org/)
- [Precios de Peaje](https://usepeaje.com/precios)
