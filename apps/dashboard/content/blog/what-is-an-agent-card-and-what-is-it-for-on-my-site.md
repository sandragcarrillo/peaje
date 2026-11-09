---
title: "What is an agent card and what is it for on my site?"
description: What the A2A protocol's agent card is, where it goes on your domain, which fields it has, who created the protocol and what the Peaje kit puts in your site's card.
date: 2026-11-07
slug: what-is-an-agent-card-and-what-is-it-for-on-my-site
lang: en
categoria: Guide
portada: 3
portada_titulo: What is an agent card
traduccion: que-es-una-agent-card-y-para-que-sirve-en-mi-sitio
---

# What is an agent card and what is it for on my site?

An agent card is a JSON file that describes an agent or a service so other AI agents know what it does, how to connect to it and what authentication it asks for. It comes from the A2A (Agent2Agent) protocol and lives at a fixed address on your domain, `/.well-known/agent-card.json`, so an agent can find it without anyone sending it the link.

Updated: November 2026

A2A is backed by more than 150 organizations, according to the [project's official blog](https://a2a-protocol.org/latest/blog/2026/08/27/a-new-chapter-for-a2a-joining-the-agentic-ai-foundation/), which announced on August 27, 2026 that it was joining the Agentic AI Foundation, directed by the Linux Foundation.

## Who created A2A and where does it live today?

Google [introduced it on April 9, 2025](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) with more than 50 technology companies as partners. On June 23, 2025 it handed it to the Linux Foundation, which [launched the Agent2Agent project](https://linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) with Google's specification, SDKs and tooling, and with support from companies like AWS, Cisco, Microsoft, Salesforce, SAP and ServiceNow. Version 1.0 of the specification came out on March 12, 2026.

Today the documentation is at [a2a-protocol.org](https://a2a-protocol.org/latest/specification/) and the code is on GitHub, in the [a2aproject](https://github.com/a2aproject/A2A) organization. The `/.well-known/agent-card.json` address is defined in the specification itself, which puts it forward for registration with IANA, the body that keeps the official list of these addresses.

## Which fields does an agent card have?

These are the ones in version 1.0, with the names as they appear in the JSON:

| Field | What it says | Required? |
| --- | --- | --- |
| `name` | The name of the agent or service | Yes |
| `description` | What it does | Yes |
| `supportedInterfaces` | The URLs and protocols to talk to it (JSON-RPC, gRPC or HTTP+JSON) | Yes |
| `version` | The agent's version | Yes |
| `capabilities` | Whether it streams, whether it sends notifications and whether it has an extended card | Yes |
| `defaultInputModes` and `defaultOutputModes` | The formats it takes and returns, like `application/json` | Yes |
| `skills` | Its skills, each with an `id`, `name`, `description` and `tags` | Yes |
| `provider` | The organization offering it and its URL | No |
| `securitySchemes` and `securityRequirements` | How to authenticate | No |
| `documentationUrl` and `iconUrl` | Its documentation and its icon | No |
| `signatures` | A signature that proves nobody changed the card | No |

The specification asks that the card carry no credentials or internal details, recommends serving it over HTTPS and suggests cache headers, because it changes rarely and agents request it often.

## What does having one on my site do for me?

An agent that reaches your domain can read the card before doing anything else and learn in a single request what you offer, in which format and, if you put it in the description, what it costs. The specification also expects agents to find cards through catalogs or registries, and the [ERC-8004](https://usepeaje.com/blog/what-is-erc-8004-and-what-is-the-ai-agent-registry-for) registry has a field to point to one. Having it makes you readable to the agents that look for it, although that alone does not guarantee they pick you. Along with llms.txt and openapi.json, it is one of the files an agent can check when it looks for an API ([how AI agents find my API](https://usepeaje.com/blog/how-do-ai-agents-find-my-api)).

## What does the Peaje kit put in my agent card?

The kit builds it from your business's data in Peaje and serves it on your domain, in English, because agents read it. It includes the name, your business's description, your site's URL, a version, the capabilities (no streaming or notifications), JSON as the input and output format, and one skill for each priced route or link, with its price per call. If your payments are turned off, that price shows as 0. This is the usepeaje.com card, trimmed:

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

There are two limits worth knowing:

- **Peaje does not run an A2A server.** The card says what you offer, but an agent that wants to send you messages over A2A has nobody to talk to: buying goes through your priced routes, which answer 402, or through your MCP server at `/mcp`.
- **The card uses the shape of earlier A2A versions**, with a `url` field, and it does not yet include `supportedInterfaces` or `tags` on each skill, which version 1.0 marks as required. A client that validates the card to the letter can reject it.

You install it with the rest of the kit, with `npx @peaje/cli@1 init <slug>` or by pasting a text into your AI tool ([how to install the Peaje kit](https://usepeaje.com/blog/how-do-i-install-the-peaje-kit-in-my-project-with-one-command)). The kit is part of the [free plan](https://usepeaje.com/precios).

## Sources

- [A2A specification](https://a2a-protocol.org/latest/specification/)
- [Google: A2A launch](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [Linux Foundation: Agent2Agent project launch](https://linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents)
- [A2A: version 1.0](https://a2a-protocol.org/latest/blog/2026/03/12/a2a-protocol-ships-v10-production-ready-standard-for-agent-to-agent-communication/)
- [A2A: joining the Agentic AI Foundation](https://a2a-protocol.org/latest/blog/2026/08/27/a-new-chapter-for-a2a-joining-the-agentic-ai-foundation/)
- [A2A repository on GitHub](https://github.com/a2aproject/A2A)
- [Peaje's agent card](https://usepeaje.com/.well-known/agent-card.json)
