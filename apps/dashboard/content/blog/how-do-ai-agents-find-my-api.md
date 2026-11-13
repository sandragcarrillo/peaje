---
title: "How do AI agents find my API?"
description: Where AI agents look for APIs they can use and pay for, which files your site has to publish so they find you and which directories are worth being listed in.
date: 2026-11-05
slug: how-do-ai-agents-find-my-api
lang: en
categoria: Guide
portada: 3
portada_titulo: Getting your API found
traduccion: como-encuentran-los-agentes-de-ia-mi-api
---

# How do AI agents find my API?

In three ways: by reading well-known files on your own domain, like `llms.txt`, `openapi.json` or `/.well-known/mcp`, by searching directories of MCP servers and of services that charge per request, and by following what they find when someone searches the web. An agent does not read your landing page like a person does, so if your API is not described in those places, it does not exist for the agent even if it works perfectly.

Updated: November 2026

Peaje's free kit publishes those files on your domain, and every route you add in your dashboard goes into them right away. The [free radar](https://usepeaje.com/radar) checks, among other things, whether your MCP server is listed in a directory ([what MCP is and how it differs from an API](https://usepeaje.com/blog/what-is-mcp-and-how-is-it-different-from-an-api)).

## What files does an agent look for on my domain?

| File | What it tells the agent |
| --- | --- |
| `/llms.txt` | What your business does and where everything is, in text, with a payments section for agents |
| `/openapi.json` | Each route of your API, with its parameters, its response and its price |
| `/mcp` and `/.well-known/mcp` | Your MCP server, with one tool per route |
| `/.well-known/agent-card.json` | Your service's card for agents, with what it can do and what it costs |
| `/.well-known/api-catalog` | The index of your APIs, in the IETF standard format (RFC 9727) |
| `/discovery/resources` | The list of what you charge for, in x402's catalog format |
| `/auth.md` and `/pricing.md` | How to pay and how much, explained for an agent |

If an agent reaches a priced route without having read anything, the 402 itself tells it what it costs and how to pay ([what the 402 carries](https://usepeaje.com/blog/what-is-402-payment-required-and-what-happens-when-an-agent-asks-without-paying)).

## Which directories are worth being listed in?

- **The official MCP registry,** at [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/), where AI clients look for servers.
- **The MPP services directory,** which started with more than 100 services according to [Tempo](https://tempo.xyz/blog/mainnet).
- **The x402 Bazaar,** the directory of services that charge with x402. Your `/discovery/resources` follows its format.

Agents that search the web also arrive through your public pages, the same way ChatGPT or Claude do when they cite someone. A documentation page in text, with examples, works for both.

## What makes an agent pick my API?

The description decides it: an agent chooses whether to call you, and whether to pay you, based on what each route says, so write it for someone who does not know your business:

- **What it returns,** in one sentence, with the data it brings.
- **In what format,** with an example response.
- **What it costs,** if it is priced.
- **When to use it,** with a concrete case.

"Returns the hourly rain forecast for the next 30 days for a city in Colombia, in JSON, at US$0.05 per call" works better for an agent than "Forecast endpoint".

## How do I do it with Peaje?

1. Register your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo), with no card.
2. Publish your routes in Routes, with their description and price ([step by step](https://usepeaje.com/blog/how-do-i-charge-ai-agents-for-using-my-api)).
3. Install the kit, which puts every file in the table on your domain.
4. Measure your site on the [radar](https://usepeaje.com/radar) to see what an agent sees when it arrives.

Then, in "Agent visits", you see who visits you, including clients that pay with MPP or x402, and which routes they ask for.

## Sources

- [Official MCP registry](https://registry.modelcontextprotocol.io/)
- [RFC 9727: api-catalog](https://www.rfc-editor.org/rfc/rfc9727)
- [Tempo: mainnet and MPP launch](https://tempo.xyz/blog/mainnet)
- [x402](https://www.x402.org/)
- [Peaje pricing](https://usepeaje.com/precios)
