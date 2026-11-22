---
title: "¿Para qué sirve el openapi.json y qué agentes de IA lo leen?"
description: Qué describe el openapi.json, qué plataformas de agentes de IA lo leen según su documentación, un ejemplo de petición y respuesta, los errores que lo dejan inútil y cómo publicarlo con el kit gratis de Peaje.
date: 2026-11-22
slug: para-que-sirve-el-openapi-json-y-que-agentes-de-ia-lo-leen
lang: es
categoria: Guía
portada: 1
portada_titulo: Tu API, legible para agentes
traduccion: what-is-openapi-json-for-and-which-ai-agents-read-it
---

# ¿Para qué sirve el openapi.json y qué agentes de IA lo leen?

El `openapi.json` describe tu API en el formato estándar OpenAPI: qué rutas tiene, qué datos pide cada una, qué devuelve y qué errores puede dar. Con él, un agente de IA puede usar tu API sin que nadie le explique nada. Lo leen las plataformas donde se arman agentes: las acciones de los GPTs de OpenAI, el Agent Development Kit de Google, los agentes de Amazon Bedrock y los de Microsoft Foundry convierten las rutas del archivo en herramientas que el agente puede llamar.

Actualizado: noviembre de 2026. Lo de OpenAI, Google, Amazon y Microsoft sale de su documentación oficial, consultada el 22 de noviembre de 2026.

La versión más reciente del estándar es OpenAPI 3.2.1, publicada el 10 de septiembre de 2026 ([especificación de OpenAPI](https://spec.openapis.org/oas/latest.html)). El kit de Peaje, que es gratis ([precios](https://usepeaje.com/precios)), publica un `openapi.json` en tu propio dominio, en formato OpenAPI 3.1.0.

## ¿Qué agentes de IA lo leen?

| Plataforma | Qué hace con el archivo | Versión que acepta |
| --- | --- | --- |
| [Acciones de GPTs, de OpenAI](https://developers.openai.com/api/docs/actions/getting-started) | Una acción necesita un esquema OpenAPI que describa los parámetros de la llamada | La guía no lo dice; su ejemplo usa 3.1.0 |
| [Agent Development Kit, de Google](https://adk.dev/tools-custom/openapi-tools/) | Su `OpenAPIToolset` lee el archivo y crea una herramienta por cada operación | 3.x |
| [Agentes de Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-api-schema.html) | Usa el esquema para decidir qué operación llamar y qué datos pedirle al usuario | Parte de 3.0, con el campo `openapi` en `"3.0.0"` |
| [Microsoft Foundry Agent Service](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/openapi) | Su herramienta OpenAPI conecta al agente con APIs externas | 3.0 y 3.1 |

En todos estos casos alguien arma un agente y le pasa tu archivo. No encontramos documentación oficial que diga que ChatGPT, Claude o Perplexity leen tu `openapi.json` cuando visitan tu sitio para responder una pregunta, así que no lo contamos aquí.

## ¿Qué tiene que traer el archivo?

- **`openapi`:** la versión del estándar.
- **`info`:** el nombre y la versión de tu API.
- **`paths`:** cada ruta con su método (GET, POST).
- **`operationId` en cada operación:** Bedrock lo pide en los modelos nuevos y Foundry lo exige siempre, solo con letras, guiones y guiones bajos.
- **`description`:** cuándo usar la ruta y qué hace. Bedrock dice que el agente decide con ese texto si la llama.
- **`parameters` o `requestBody`:** los datos que pide, con su tipo y si son obligatorios.
- **`responses`:** qué devuelve en cada código, con su esquema.

## ¿Cómo se ve una petición y una respuesta?

Un agente pide el archivo con un GET normal:

```
curl -s https://tusitio.com/openapi.json
```

Y recibe un JSON como este. Es un ejemplo de un negocio con reservas; tus rutas son las tuyas:

```json
{
  "openapi": "3.1.0",
  "info": { "title": "Reservas de Tu Negocio", "version": "1.0.0" },
  "paths": {
    "/api/disponibilidad": {
      "get": {
        "operationId": "getDisponibilidad",
        "summary": "Horas libres para una fecha",
        "description": "Devuelve las horas libres de un día para un número de personas. Úsala antes de reservar.",
        "parameters": [
          { "name": "fecha", "in": "query", "required": true, "description": "Día en formato AAAA-MM-DD", "schema": { "type": "string", "format": "date" } },
          { "name": "personas", "in": "query", "required": true, "schema": { "type": "integer", "minimum": 1 } }
        ],
        "responses": {
          "200": {
            "description": "Horas libres",
            "content": { "application/json": { "schema": { "type": "object", "properties": { "horas": { "type": "array", "items": { "type": "string" } } } } } }
          },
          "400": { "description": "Falta la fecha o el número de personas" }
        }
      }
    }
  }
}
```

Con eso el agente sabe qué ruta llamar, qué mandarle y qué va a recibir.

## ¿Qué errores lo dejan inútil?

| Lo que pasa | Qué ve el agente |
| --- | --- |
| La URL responde 404 | Para el agente tu API no existe. El radar lo busca en `/openapi.json` y en `/.well-known/openapi.json` |
| Responde HTML en vez de JSON | No lo puede leer. Pasa mucho en sitios que devuelven la página de inicio en cualquier ruta |
| El JSON no trae el campo `openapi` (o `swagger`, el nombre viejo) | El radar no lo cuenta como OpenAPI |
| Está detrás de un inicio de sesión | No lo puede abrir |
| Operaciones sin `operationId` | Foundry no las acepta y Bedrock las pide en los modelos nuevos |
| Versión 3.1 en Bedrock | Bedrock espera `"3.0.0"`, así que hay que convertir el archivo |
| Valores fijos con `enum` en Bedrock | Bedrock no lo admite: pon los valores posibles en la `description` |
| Respuestas sin esquema | El agente no sabe qué va a recibir y adivina |
| Errores que llegan como página web | El agente se queda sin salida. Conviene responder los errores en JSON |

## ¿Qué revisa el radar de mi openapi.json?

El [radar gratis](https://usepeaje.com/radar) mira si está publicado en tu dominio y te lo dice en la medición en vivo: "Tu API está descrita en openapi.json" o que no lo encontró. Además, Ora, el medidor independiente que usa el radar, revisa si existe una descripción de tu servicio que lean las máquinas, si los datos que pide son fáciles de usar para un agente, si dice qué forma tienen sus respuestas y si tus errores llegan como datos ([qué mide el radar](https://usepeaje.com/blog/que-mide-el-radar-de-peaje-y-que-significa-mi-puntuacion)).

## ¿Cómo lo publico con Peaje?

1. **Mide tu dominio** en el [radar](https://usepeaje.com/radar). Solo pide tu correo.
2. **Registra tu sitio** en [usepeaje.com/nuevo](https://usepeaje.com/nuevo), sin tarjeta.
3. **Instala el kit** desde la carpeta de tu proyecto, con este comando:

```
npx @peaje/cli@1 init <slug> --yes
```

El comando deja el `openapi.json` respondiendo en tu dominio, junto con llms.txt, el servidor MCP, las agent cards y el JSON-LD. Si ya tenías tu propio `public/openapi.json`, lo mueve a `.peaje-backup/` con la fecha ([el comando paso a paso](https://usepeaje.com/blog/como-instalo-el-kit-de-peaje-en-mi-proyecto-con-un-comando)).

Cuando publiques, revisa que responda:

```
npx @peaje/cli@1 verify <slug>
curl -sL -o /dev/null -w "%{http_code}\n" https://tusitio.com/openapi.json   # 200
```

## Preguntas frecuentes

### ¿Es lo mismo que un servidor MCP?

Son dos cosas distintas: el `openapi.json` es un archivo que describe tu API, y el servidor MCP es la conexión por la que un agente usa tu sitio como herramienta. El kit de Peaje publica los dos ([qué es MCP](https://usepeaje.com/blog/que-es-mcp-y-en-que-se-diferencia-de-una-api)).

### ¿Me sirve si no tengo API?

Te sirve menos, porque el archivo describe rutas de una API: si tu negocio no tiene ninguna, los agentes sacan más de tu llms.txt y tu JSON-LD. El del kit queda publicado igual y cuenta en el radar.

### ¿ChatGPT lo lee cuando responde preguntas sobre mi negocio?

No lo pudimos verificar: OpenAI documenta que una acción de un GPT usa un esquema OpenAPI cuando alguien arma un GPT con tu API, pero no dice nada de leerlo en sus respuestas de búsqueda.

### ¿JSON o YAML?

Bedrock acepta los dos, pero el radar busca `openapi.json`, así que publica al menos la versión en JSON.

### ¿Cuánto cuesta?

El kit, con el `openapi.json` incluido, es gratis, no pide tarjeta y no vence. El agente Pro va aparte: US$30 al mes con el precio de fundador para los primeros 50 negocios, US$69 después ([precios](https://usepeaje.com/precios)).

## Fuentes

- [Especificación de OpenAPI 3.2.1](https://spec.openapis.org/oas/latest.html), publicada el 10 de septiembre de 2026.
- [OpenAI: primeros pasos con acciones de GPTs](https://developers.openai.com/api/docs/actions/getting-started), consultada el 22 de noviembre de 2026.
- [Google: herramientas OpenAPI en el Agent Development Kit](https://adk.dev/tools-custom/openapi-tools/), consultada el 22 de noviembre de 2026.
- [Amazon Bedrock: esquemas OpenAPI para grupos de acciones](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-api-schema.html), consultada el 22 de noviembre de 2026.
- [Microsoft Foundry: herramienta OpenAPI](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/openapi), actualizada el 17 de noviembre de 2026.
- [Precios de Peaje](https://usepeaje.com/precios): el kit gratis con openapi.json, llms.txt, servidor MCP, agent cards y JSON-LD.

## Relacionado

- [¿Cómo instalo el kit de Peaje en mi proyecto con un comando?](https://usepeaje.com/blog/como-instalo-el-kit-de-peaje-en-mi-proyecto-con-un-comando)
- [¿Qué es MCP y en qué se diferencia de una API?](https://usepeaje.com/blog/que-es-mcp-y-en-que-se-diferencia-de-una-api)
- [¿Por qué un agente de IA se atasca en mi formulario de reserva?](https://usepeaje.com/blog/por-que-un-agente-de-ia-se-atasca-en-mi-formulario-de-reserva)
