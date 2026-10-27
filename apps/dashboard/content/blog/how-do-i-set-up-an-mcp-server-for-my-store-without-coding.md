---
title: How do I set up an MCP server for my store without coding?
description: What the MCP server Peaje generates does, how to install it, which sites it works on today and what it costs.
date: 2026-10-27
slug: how-do-i-set-up-an-mcp-server-for-my-store-without-coding
lang: en
categoria: Guide
portada: 1
portada_titulo: Your store on MCP
traduccion: como-monto-un-servidor-mcp-para-mi-tienda-sin-saber-programar
---

# How do I set up an MCP server for my store without coding?

You do not have to write code: Peaje generates your site's MCP server and makes it answer on your own domain with one command, `npx @peaje/cli@1 init <slug>`, which runs in your site's project. Today that command works on sites with their own code (Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Vite, Express, Hono or a static site), and Shopify and WooCommerce are not on that list. It is part of the free plan, with no card.

Updated: October 2026

The free kit includes the MCP server, llms.txt, openapi.json, agent cards and JSON-LD generated for your site, plus a log of agent visits and a daily monitor, with no card and no expiry date ([pricing](https://usepeaje.com/precios)).

## What steps do I follow to set it up?

1. Paste your domain into the [free radar](https://usepeaje.com/radar) and in under a minute you see what an agent understands and what it is missing, with just your email.
2. [Register your site](https://usepeaje.com/nuevo), with no card. Registering changes nothing on your site, and it gives you your business slug.
3. In your site's project, run `npx @peaje/cli@1 plan <slug>` to see which files it would create or change, without writing anything yet.
4. Run `npx @peaje/cli@1 init <slug> --yes` and deploy your site. The command brings the kit with your MCP server and the files agents read, and if a package needs installing, it tells you which one.
5. Check that it worked with `npx @peaje/cli@1 verify <slug>`, which measures your live domain.

If whoever runs your website uses an AI coding tool such as Claude Code or Cursor, they can ask it to run these steps.

## What is an MCP server and what does it do for your site?

MCP (Model Context Protocol) is an open standard that lets an AI agent connect to a service and use its tools directly, instead of reading page after page. Peaje's MCP server answers on your own domain, at `/mcp`, and gives the agent a guide to using your site. It is one of the things the radar checks when it looks at whether an agent can use your site.

## How much does it cost?

The radar and the kit are free, with no card, and you only pay if you want the agent: Pro costs US$30 a month as the founder price for the first 50 businesses, and US$69 a month after that. It includes 500 credits a month for the agent's work and 20 tracked questions in AI assistants, and talking to your agent uses no credits ([pricing](https://usepeaje.com/precios)).

## What if the command scares me or I have no one to install it?

With Pro, your Peaje agent explains each fix in plain words, writes it and leaves it as a task, so you can hand it to whoever runs your website or to your coding tool. It talks to you on Telegram or on your dashboard, with no meetings or calls. You can copy the pages it writes into any site, Shopify and WooCommerce included, even though the kit command does not install there.

## How do I know it worked?

The `verify` command checks your live domain and tells you whether everything answers, and the radar gives you your score today and how far it can go with Peaje, which in the example on the site is a 46 D that rises to ~74 B. With the kit installed you get the log of agent visits to your site and a daily monitor. With Pro, your agent asks ChatGPT and Claude what your customers ask, tells you whether they cite you, measures again at 2 and 6 weeks and emails you a weekly report. If you cancel, you keep the diagnosis and the fixes your agent already handed you.

## Sources

- [Peaje: how it works and common questions](https://usepeaje.com/)
- [Pricing](https://usepeaje.com/precios)
- [Free radar](https://usepeaje.com/radar)
- [Register your site](https://usepeaje.com/nuevo)
- [@peaje/cli on npm](https://www.npmjs.com/package/@peaje/cli): the plan, init and verify commands, and the stacks it detects.
