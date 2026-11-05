---
title: "Is there a free generator for llms.txt, JSON-LD and MCP for my website?"
description: The free options to generate llms.txt, JSON-LD and an MCP server for your site, what each one covers, how to check what they generate and what Peaje's free kit does.
date: 2026-11-03
slug: is-there-a-free-generator-for-llms-txt-json-ld-and-mcp-for-my-website
lang: en
categoria: Guide
portada: 1
portada_titulo: Free generator for agents
traduccion: existe-un-generador-gratis-de-llms-txt-json-ld-y-mcp-para-mi-web
---

# Is there a free generator for llms.txt, JSON-LD and MCP for my website?

Yes. Peaje's free kit generates all three for your site, along with openapi.json and agent cards, and has them answering on your domain, with no card and no expiration date. If you only need llms.txt, several platforms already generate it on their own, like Yoast SEO on WordPress, Wix, or Mintlify and GitBook for documentation sites.

Updated: November 2026

The kit costs US$0 and also includes the log of agent visits and a daily monitor, according to the [pricing page](https://usepeaje.com/precios).

## Which free options are there for each file?

| File | Free options | What they cover |
| --- | --- | --- |
| llms.txt | Yoast SEO (WordPress), Wix, Mintlify, GitBook, plugins for Docusaurus and VitePress | The guide to your site for agents, built from your pages |
| JSON-LD | Your store platform, for products, and online schema generators | Your business and product data in a format AI reads without guessing |
| MCP server | The official MCP SDKs, if someone on your team codes it | The direct connection so an agent can look up or use what you offer |
| All three together | Peaje's kit | llms.txt, JSON-LD, MCP server, openapi.json and agent cards, with your site's data |

The list of tools that generate llms.txt is on the [standard's official page](https://llmstxt.org/), which Jeremy Howard proposed in September 2024. Yoast added it to its free version in June 2025, and you turn it on from the plugin's settings ([Search Engine Journal](https://www.searchenginejournal.com/yoast-seo-wordpress-plugin-adds-support-for-llms-txt/549220/)).

## What does Peaje's kit generate?

- **llms.txt:** what your site is, where everything is and how to use it.
- **JSON-LD:** your business card (Organization) in the `<head>` of your homepage, with the logo, phone, address, description and profiles on other sites that you fill in on your dashboard. It only includes what you fill in.
- **MCP server:** at `/mcp` on your domain, with your API routes as tools an agent can use.
- **openapi.json:** the description of your API, if you have published routes.
- **Agent cards:** your business card for agents under `/.well-known/`.
- **robots.txt:** a block that lets in the bots that cite by name, without touching your rules.

Everything is built from your site's data and updates on its own when you change something in your dashboard, for example a new route.

## What does it not generate?

It does not generate the data for each product. If you have a store, the product JSON-LD (name, price, currency and availability) comes from your platform, and it is worth checking that it is there and that the price matches the page ([what your store needs](https://usepeaje.com/blog/what-does-my-store-need-so-an-ai-agent-can-buy-from-it)). It does not write your site's pages either: that is what the Pro agent does.

## How do I install it?

Register your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo) and open "Kit" in your dashboard. There you have two paths: a text to paste into your AI tool (Claude Code, Cursor, Codex) or the command `npx @peaje/cli@1 init <slug>`, which recognizes Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Hono, Express and Vite ([command reference](https://usepeaje.com/blog/how-do-i-install-the-peaje-kit-in-my-project-with-one-command)). If your site runs on WordPress or Wix, use your platform's llms.txt and start with the radar to see what else is missing.

## How do I check what any tool generates?

- **llms.txt:** open `yoursite.com/llms.txt` in your browser and check that the links work.
- **JSON-LD:** run your homepage through [Google's Rich Results Test](https://search.google.com/test/rich-results) or the [schema.org validator](https://validator.schema.org/).
- **Everything together:** [Peaje's free radar](https://usepeaje.com/radar) checks these files and tells you what is missing, in under a minute and with only your email and your domain.

## Sources

- [llms.txt: the standard and its tools](https://llmstxt.org/)
- [Search Engine Journal: Yoast SEO adds llms.txt](https://www.searchenginejournal.com/yoast-seo-wordpress-plugin-adds-support-for-llms-txt/549220/)
- [Yoast: how to enable llms.txt](https://yoast.com/help/enable-llmstxt/)
- [Model Context Protocol: official SDKs](https://modelcontextprotocol.io/docs/sdk)
- [Peaje pricing](https://usepeaje.com/precios)
- [Peaje free radar](https://usepeaje.com/radar)
