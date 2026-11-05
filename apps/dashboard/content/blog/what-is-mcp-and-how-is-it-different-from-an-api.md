---
title: "What is MCP (Model Context Protocol) and how is it different from an API?"
description: What the Model Context Protocol is, how ChatGPT, Claude and Cursor use it, how it differs from a regular API, whether you need both and what the MCP server in Peaje's kit includes.
date: 2026-11-05
slug: what-is-mcp-and-how-is-it-different-from-an-api
lang: en
categoria: Guide
portada: 1
portada_titulo: MCP and APIs
traduccion: que-es-mcp-y-en-que-se-diferencia-de-una-api
---

# What is MCP (Model Context Protocol) and how is it different from an API?

MCP is an open standard for connecting AI applications, like ChatGPT, Claude or Cursor, to outside data and tools. An API is made for a programmer to read the documentation and write code that calls it, while an MCP server is made for the AI to discover on its own what it can do, with what data and how, at the moment it needs it. An MCP server is often built on top of an API that already exists.

Updated: November 2026

The [official MCP documentation](https://modelcontextprotocol.io/docs/getting-started/intro) compares it to a USB-C port: a standard way to connect an AI application to anything. Claude, ChatGPT, VS Code and Cursor, among others, support it.

## How does MCP work?

There are three pieces:

- **The host:** the AI application the person uses, like Claude Code or ChatGPT.
- **The client:** the connection the host opens to each server.
- **The server:** the program that offers data and actions, for example your store's.

A server offers three kinds of things: tools (actions the AI can run, like checking an order), resources (data the AI can read, like your price list) and prompts (templates for asking for something the right way). The AI asks the server for its list of tools with `tools/list`, reads each one's description and parameters, and calls it with `tools/call`. Messages travel as JSON-RPC, through your computer's terminal or over HTTP if the server is on the internet.

## How is it different from an API?

| | API | MCP |
| --- | --- | --- |
| Who it is made for | A programmer writing code | An AI application deciding on its own what to use |
| How it is discovered | By reading the documentation | By asking the server what tools it has |
| What it describes | Routes, methods and formats | Tools with a plain-language description and their parameters |
| When it gets connected | When someone writes the integration | When the person adds the server to their AI application |
| How it is called | HTTP, REST, GraphQL or others | JSON-RPC, through the terminal or over HTTP |

The difference that matters most is the description. In an API, a route's name is enough for a programmer who read the documentation, while in MCP the AI picks a tool based on what its description says, so writing it well is part of the job.

## Do I need both?

If you already have an API, you do not replace it: you add an MCP server that wraps it, and each tool calls one of your API routes underneath. If you do not have an API, an MCP server can still offer what is on your site, like your catalog, your prices and your FAQ. And if all you want is for assistants to find and cite you, MCP helps, but the first step is a site that can be read: `llms.txt`, structured data and pages in text ([where to start](https://usepeaje.com/blog/how-do-i-add-llms-txt-and-json-ld-so-ai-understands-my-site)).

## What does the MCP server in Peaje's kit include?

Peaje's free kit puts an MCP server on your own domain, at `/mcp`, which agents also find at `/.well-known/mcp`. It includes:

- A `get_pricing` tool, free, with what you charge for and how to pay.
- One tool for each API route you publish in Peaje, with its description.
- One tool for each priced link.
- A guide and your price list as resources.

Priced tools charge when they are called, with MPP: if the agent has not paid, the server answers with the payment offer, and when it pays it gets the result with its receipt. We go step by step in [how do I set up an MCP server for my store without coding](https://usepeaje.com/blog/how-do-i-set-up-an-mcp-server-for-my-store-without-coding). You get the kit by registering your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo), with no card.

## Sources

- [MCP: what is the Model Context Protocol](https://modelcontextprotocol.io/docs/getting-started/intro)
- [MCP: architecture](https://modelcontextprotocol.io/docs/learn/architecture)
- [Peaje pricing](https://usepeaje.com/precios)
