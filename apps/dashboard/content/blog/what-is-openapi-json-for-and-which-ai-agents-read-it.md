---
title: "What is openapi.json for, and which AI agents read it?"
description: What openapi.json describes, which AI agent platforms read it according to their docs, an example request and response, the mistakes that make it useless and how to publish it with Peaje's free kit.
date: 2026-11-22
slug: what-is-openapi-json-for-and-which-ai-agents-read-it
lang: en
categoria: Guide
portada: 1
portada_titulo: Your API, readable by agents
traduccion: para-que-sirve-el-openapi-json-y-que-agentes-de-ia-lo-leen
---

# What is openapi.json for, and which AI agents read it?

`openapi.json` describes your API in the standard OpenAPI format: which routes it has, what data each one asks for, what it returns and which errors it can give. With it, an AI agent can use your API without anyone explaining it first. The platforms where people build agents read it: OpenAI's GPT actions, Google's Agent Development Kit, Amazon Bedrock agents and Microsoft Foundry agents turn the routes in the file into tools the agent can call.

Updated: November 2026. The OpenAI, Google, Amazon and Microsoft details come from their official docs, read on November 22, 2026.

The latest version of the standard is OpenAPI 3.2.1, published on September 10, 2026 ([OpenAPI specification](https://spec.openapis.org/oas/latest.html)). Peaje's kit, which is free ([pricing](https://usepeaje.com/precios)), publishes an `openapi.json` on your own domain, in OpenAPI 3.1.0.

## Which AI agents read it?

| Platform | What it does with the file | Version it accepts |
| --- | --- | --- |
| [OpenAI GPT actions](https://developers.openai.com/api/docs/actions/getting-started) | An action needs an OpenAPI schema that describes the parameters of the call | The guide does not say; its example uses 3.1.0 |
| [Google Agent Development Kit](https://adk.dev/tools-custom/openapi-tools/) | Its `OpenAPIToolset` reads the file and creates one tool per operation | 3.x |
| [Amazon Bedrock agents](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-api-schema.html) | Uses the schema to decide which operation to call and what data to ask the user for | A subset of 3.0, with the `openapi` field set to `"3.0.0"` |
| [Microsoft Foundry Agent Service](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/openapi) | Its OpenAPI tool connects the agent to external APIs | 3.0 and 3.1 |

In all of these, someone builds an agent and hands it your file. We found no official docs saying ChatGPT, Claude or Perplexity read your `openapi.json` when they visit your site to answer a question, so we leave that out.

## What should the file include?

- **`openapi`:** the version of the standard.
- **`info`:** the name and version of your API.
- **`paths`:** each route with its method (GET, POST).
- **`operationId` on every operation:** Bedrock requires it for newer models and Foundry always requires it, using only letters, hyphens and underscores.
- **`description`:** when to use the route and what it does. Bedrock says the agent uses this text to decide whether to call it.
- **`parameters` or `requestBody`:** the data it asks for, with its type and whether it is required.
- **`responses`:** what it returns for each status code, with its schema.

## What does a request and a response look like?

An agent fetches the file with a plain GET:

```
curl -s https://yoursite.com/openapi.json
```

And gets JSON like this. It is an example for a business that takes bookings; your routes are your own:

```json
{
  "openapi": "3.1.0",
  "info": { "title": "Your Business Bookings", "version": "1.0.0" },
  "paths": {
    "/api/availability": {
      "get": {
        "operationId": "getAvailability",
        "summary": "Free times for a date",
        "description": "Returns the free times on a given day for a party size. Call it before booking.",
        "parameters": [
          { "name": "date", "in": "query", "required": true, "description": "Day in YYYY-MM-DD format", "schema": { "type": "string", "format": "date" } },
          { "name": "party", "in": "query", "required": true, "schema": { "type": "integer", "minimum": 1 } }
        ],
        "responses": {
          "200": {
            "description": "Free times",
            "content": { "application/json": { "schema": { "type": "object", "properties": { "times": { "type": "array", "items": { "type": "string" } } } } } }
          },
          "400": { "description": "The date or the party size is missing" }
        }
      }
    }
  }
}
```

With that, the agent knows which route to call, what to send and what it will get back.

## Which mistakes make it useless?

| What happens | What the agent sees |
| --- | --- |
| The URL returns 404 | To the agent, your API does not exist. The radar looks for it at `/openapi.json` and `/.well-known/openapi.json` |
| It returns HTML instead of JSON | It cannot read it. This happens a lot on sites that return the homepage for any path |
| The JSON has no `openapi` field (or `swagger`, the old name) | The radar does not count it as OpenAPI |
| It sits behind a login | It cannot open it |
| Operations without `operationId` | Foundry rejects them and Bedrock requires them for newer models |
| Version 3.1 on Bedrock | Bedrock expects `"3.0.0"`, so you need to convert the file |
| Fixed values with `enum` on Bedrock | Bedrock does not support it: list the allowed values in the `description` |
| Responses without a schema | The agent does not know what it will get and guesses |
| Errors that come back as a web page | The agent has no way out. Return errors as JSON |

## What does the radar check in my openapi.json?

The [free radar](https://usepeaje.com/radar) checks whether it is published on your domain and tells you during the live scan: "Your API is described in openapi.json", or that it could not find it. Ora, the independent scanner the radar uses, also checks whether there is a machine-readable description of your service, whether the data it asks for is easy for an agent to use, whether it says what its answers look like and whether your errors come back as data ([what the radar measures](https://usepeaje.com/blog/what-does-peajes-radar-measure-and-what-does-my-score-mean)).

## How do I publish it with Peaje?

1. **Measure your domain** in the [radar](https://usepeaje.com/radar). It only asks for your email.
2. **Register your site** at [usepeaje.com/nuevo](https://usepeaje.com/nuevo), no card needed.
3. **Install the kit** from your project folder with this command:

```
npx @peaje/cli@1 init <slug> --yes
```

The command leaves `openapi.json` answering on your domain, along with llms.txt, the MCP server, the agent cards and the JSON-LD. If you already had your own `public/openapi.json`, it moves it to `.peaje-backup/` with the date ([the command step by step](https://usepeaje.com/blog/how-do-i-install-the-peaje-kit-in-my-project-with-one-command)).

Once you deploy, check that it answers:

```
npx @peaje/cli@1 verify <slug>
curl -sL -o /dev/null -w "%{http_code}\n" https://yoursite.com/openapi.json   # 200
```

## Frequently asked questions

### Is it the same as an MCP server?

They are two different things: `openapi.json` is a file that describes your API, and the MCP server is the connection an agent uses to work with your site as a tool. Peaje's kit publishes both ([what MCP is](https://usepeaje.com/blog/what-is-mcp-and-how-is-it-different-from-an-api)).

### Is it useful if I do not have an API?

Less so, because the file describes the routes of an API: if your business has none, agents get more out of your llms.txt and your JSON-LD. The kit's file still gets published and counts in the radar.

### Does ChatGPT read it when it answers questions about my business?

We could not verify that: OpenAI documents that a GPT action uses an OpenAPI schema when someone builds a GPT with your API, but says nothing about reading it for its search answers.

### JSON or YAML?

Bedrock accepts both, but the radar looks for `openapi.json`, so publish at least the JSON version.

### How much does it cost?

The kit, `openapi.json` included, is free, does not ask for a card and does not expire. The Pro agent is separate: US$30 a month at the founder price for the first 50 businesses, US$69 after that ([pricing](https://usepeaje.com/precios)).

## Sources

- [OpenAPI Specification 3.2.1](https://spec.openapis.org/oas/latest.html), published on September 10, 2026.
- [OpenAI: getting started with GPT actions](https://developers.openai.com/api/docs/actions/getting-started), read on November 22, 2026.
- [Google: OpenAPI tools in the Agent Development Kit](https://adk.dev/tools-custom/openapi-tools/), read on November 22, 2026.
- [Amazon Bedrock: OpenAPI schemas for action groups](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-api-schema.html), read on November 22, 2026.
- [Microsoft Foundry: OpenAPI tool](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/openapi), updated on November 17, 2026.
- [Peaje pricing](https://usepeaje.com/precios): the free kit with openapi.json, llms.txt, MCP server, agent cards and JSON-LD.

## Related

- [How do I install the Peaje kit in my project with one command?](https://usepeaje.com/blog/how-do-i-install-the-peaje-kit-in-my-project-with-one-command)
- [What is MCP and how is it different from an API?](https://usepeaje.com/blog/what-is-mcp-and-how-is-it-different-from-an-api)
- [Why does an AI agent get stuck on my booking form?](https://usepeaje.com/blog/why-does-an-ai-agent-get-stuck-on-my-booking-form)
