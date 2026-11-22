---
title: "What is MCP (Model Context Protocol) and how is it different from an API?"
description: What MCP is, what an MCP server and an MCP connector are, how MCP servers work step by step, how MCP differs from an API, how you build one and a real example with Peaje's own server.
date: 2026-11-05
updated: 2026-11-22
slug: what-is-mcp-and-how-is-it-different-from-an-api
lang: en
categoria: Guide
portada: 1
portada_titulo: MCP and APIs
traduccion: que-es-mcp-y-en-que-se-diferencia-de-una-api
---

# What is MCP (Model Context Protocol) and how is it different from an API?

MCP (Model Context Protocol) is an open standard for connecting AI applications like Claude, ChatGPT or Cursor to outside data and tools. An MCP server is the program that offers those tools: the AI asks it what it can do, reads each tool's description and calls the one it needs. An API is made for a programmer who reads the documentation and writes the code, while MCP is made for the AI to find out on its own, and an MCP server is often built on top of an API that already exists.

Updated: November 22, 2026

The [official MCP documentation](https://modelcontextprotocol.io/docs/getting-started/intro) compares it to a USB-C port: one standard way to plug an AI application into anything. Anthropic published it on November 25, 2024, and on December 9, 2025 it donated it to the Agentic AI Foundation, part of the Linux Foundation, which Anthropic, Block and OpenAI co-founded. At that point MCP had about 10,000 active servers and 97 million monthly SDK downloads, according to the [MCP blog](https://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/). The current version of the specification is 2026-07-28.

## What is an MCP server?

It is a program that gives an AI application three kinds of things:

- **Tools:** actions the AI can run, like checking an order or searching a catalog.
- **Resources:** data the AI can read, like a price list or a database schema.
- **Prompts:** templates for asking for something the right way.

A server can run on your computer (a local server, which talks through the terminal) or on the internet (a remote server, which talks over HTTP and serves many people at once). Claude, ChatGPT, VS Code and Cursor, among others, support MCP.

## How do MCP servers work?

There are three parts. The host is the AI application the person uses, like Claude Code. The client is the connection the host opens to each server, one per server. The server is the program with the tools. A conversation goes like this:

1. **The person adds the server** to their AI application, with its URL or the command that starts it.
2. **The client asks what the server supports.** Since version 2026-07-28 each request carries the protocol version and what the client can do, and the server answers `server/discover` with its versions and its capabilities.
3. **The client asks for the tool list** with `tools/list`. Each tool comes with a name, a description in plain words and the parameters it accepts.
4. **The model picks a tool.** When the person asks for something, the model reads the descriptions and decides which tool to use and with what data.
5. **The client calls it** with `tools/call`, and the server does the work and returns the result in text, images or structured data.
6. **The model answers** with that result. If the server's tools change, it can notify the client so it asks for the list again.

All messages are JSON-RPC 2.0. A local server receives them through standard input and output, and a remote one through Streamable HTTP, where the MCP specification recommends OAuth for signing in.

## What is an MCP connector?

It is the name Claude uses for an MCP server once you add it. Anthropic's documentation says it plainly: an MCP server gives Claude access to your product or data, and people who use Claude see it as a connector. You add it as a custom connector with its URL, or install it from Claude's directory. In ChatGPT you add a custom MCP server, and the plugins that let ChatGPT buy from a store are, according to OpenAI, an MCP server plus skills.

## How is MCP different from an API?

| | API | MCP |
| --- | --- | --- |
| Who it is made for | A programmer writing code | An AI application deciding on its own what to use |
| How it is discovered | By reading the documentation | By asking the server what tools it has |
| What it describes | Routes, methods and formats | Tools with a plain-language description and their parameters |
| When it gets connected | When someone writes the integration | When the person adds the server to their AI application |
| How it is called | HTTP, REST, GraphQL or others | JSON-RPC 2.0, through the terminal or over Streamable HTTP |

The difference that matters most is the description. In an API, a route's name is enough for a programmer who read the documentation. In MCP the model picks a tool based on what its description says, so writing it well is part of the job.

## Do I need both?

If you already have an API, you do not replace it: you add an MCP server that wraps it, and each tool calls one of your API routes underneath. If you do not have an API, an MCP server can still offer what is on your site, like your catalog and your FAQ. And if all you want is for assistants to find and cite you, MCP helps, but the first step is a site they can read: `llms.txt`, structured data and pages in text ([where to start](https://usepeaje.com/blog/how-do-i-add-llms-txt-and-json-ld-so-ai-understands-my-site)).

## How do you build an MCP server?

The usual path has four steps:

1. **Pick what you expose.** A few tools that each do one clear thing, with a description that says when to use it.
2. **Use an official SDK.** There are SDKs for TypeScript and Python, among other languages, that handle the protocol for you.
3. **Test it.** The MCP Inspector lets you call each tool by hand. Then add it to Claude as a custom connector and ask it something real.
4. **Publish it.** For others to find it, you can list it in the [official MCP registry](https://usepeaje.com/blog/how-do-i-publish-my-mcp-server-to-the-official-mcp-registry).

If you have a website and do not want to write code, Peaje's free kit generates an MCP server for your site with one command, answering on your own domain at `/mcp` with a guide to using your site ([step by step](https://usepeaje.com/blog/how-do-i-set-up-an-mcp-server-for-my-store-without-coding)).

## An example: Peaje's own MCP server

Peaje has a remote MCP server at `https://api.usepeaje.com/_owner/mcp`. You connect it to Claude Code, Cursor, Codex, Claude or ChatGPT, and it gives your AI tool a short list of tools, among them `peaje_plan` (your goal and priorities), `peaje_ask` (ask your agent about your business), `peaje_list_tasks`, `peaje_get_task` and `peaje_complete_task`.

This article went through that server. Peaje's agent saw in Search Console that this page showed up for "what is mcp" and "how do mcp servers work" without answering them well, and it left a task. Claude Code read it with `peaje_get_task`, with its instructions and the criteria Peaje checks, and the change you are reading came out of that. How to connect it, and what it can do without your approval, is in [Peaje's MCP documentation](https://usepeaje.com/docs/mcp). Tasks and the connection come with Pro, which costs US$30 a month as the founder price for the first 50 businesses, and US$69 after that ([pricing](https://usepeaje.com/precios)).

## Frequently asked questions

### What does MCP stand for?

Model Context Protocol. The "context" is the data and tools an AI application receives from outside to answer or act.

### Who maintains MCP?

Anthropic created it, and since December 2025 it lives in the Agentic AI Foundation, under the Linux Foundation. The project keeps its own maintainers and technical direction.

### Is MCP only for Claude?

No. ChatGPT, VS Code, Cursor and many other tools support it, so one server works in all of them.

### Is MCP safe?

It depends on the server. A server can read data and take actions for you, so connect only the ones you trust, check what each tool does and prefer servers that ask for your approval before changing anything.

## Sources

- [MCP: what is the Model Context Protocol](https://modelcontextprotocol.io/docs/getting-started/intro)
- [MCP: architecture](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP: specification versioning](https://modelcontextprotocol.io/specification/versioning)
- [Anthropic: introducing the Model Context Protocol (November 25, 2024)](https://www.anthropic.com/news/model-context-protocol)
- [MCP blog: MCP joins the Agentic AI Foundation (December 9, 2025)](https://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/)
- [Claude: build an MCP server for Claude](https://claude.com/docs/connectors/building)
- [OpenAI: MCP in the API and ChatGPT](https://developers.openai.com/api/docs/mcp/)
- [OpenAI: build a commerce plugin](https://developers.openai.com/commerce/guides/build-a-plugin)
- [Peaje MCP documentation](https://usepeaje.com/docs/mcp)
- [Peaje pricing](https://usepeaje.com/precios)
