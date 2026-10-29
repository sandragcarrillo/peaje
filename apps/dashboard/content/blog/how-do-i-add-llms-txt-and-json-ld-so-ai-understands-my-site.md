---
title: "How do I add llms.txt and JSON-LD so AI understands my site?"
description: The prompt for your AI coding tool or the command that generates llms.txt, JSON-LD and the rest of the kit for your site, what each file does and how to check it worked.
date: 2026-10-28
slug: how-do-i-add-llms-txt-and-json-ld-so-ai-understands-my-site
lang: en
categoria: Guide
portada: 1
portada_titulo: llms.txt and JSON-LD
traduccion: como-anado-llms-txt-y-json-ld-para-que-la-ia-entienda-mi-web
---

# How do I add llms.txt and JSON-LD so AI understands my site?

Peaje's kit is free and you get it by registering your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo). From there you have two ways. If you use Claude Code, Cursor or another AI tool that edits your code, your dashboard has a text ready to paste into it: it reviews your project, shows you what will change and touches nothing until you say yes. If you prefer the terminal, it takes two commands: `npx @peaje/cli@1 plan <slug>` shows you which files it would create or change without writing anything, and `npx @peaje/cli@1 init <slug> --yes` installs them once you agree. Either way you end up with llms.txt, JSON-LD, openapi.json, an MCP server and agent cards made for your site.

Updated: October 2026

The kit generates those five files for US$0 and with no card, according to the [pricing page](https://usepeaje.com/precios), and it does not expire.

## What steps do I follow?

1. Measure your site with the [free radar](https://usepeaje.com/radar), which takes under a minute and only asks for your email and your domain.
2. [Register your site](https://usepeaje.com/nuevo) with the same email. On your dashboard home, the "Install the kit" button takes you there; later you find it in the menu, under "Kit", or at `usepeaje.com/t/<slug>/kit`. Everything is ready there, with your site's identifier (the slug) already filled in.
3. Pick how to install it:
   - **With your AI tool:** in the "Use your AI coding tool" tab, copy the text and paste it into Claude Code, Cursor, Codex, Copilot or Windsurf open in your project. It first shows you the list of files and the change in each one, and edits nothing until you say yes.
   - **Yourself in the terminal:** in your project's folder run `npx @peaje/cli@1 plan <slug>`, which lists every file it would create, edit or move without touching anything. If the list works for you, run `npx @peaje/cli@1 init <slug> --yes` and review the change with `git diff`.
4. Deploy and go back to "Kit" in your dashboard, which checks that everything answers on your site (from the terminal it is `npx @peaje/cli@1 verify <slug>`). If something is still missing, Peaje measures your domain right there and builds a prompt with only those items, so you can paste it into your tool again.

## What does the kit generate and what is each file for?

- **llms.txt:** a guide to your site written for agents, with what you sell and where everything is.
- **JSON-LD:** your facts (name, what you sell, prices) in a format ChatGPT and Claude read without guessing.
- **openapi.json:** the description of your API, if you have one, so an agent can use it.
- **MCP server:** the way an agent connects to your business to use what you offer.
- **Agent cards:** the card that says who you are and what an agent can do with you.

## Which sites does it work with?

The command recognizes Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Hono, Express and Vite, and for hosting it recognizes Vercel, Cloudflare, nginx and Caddy. If your site uses something else, it leaves the full kit in a `peaje/` folder with what you have to add by hand: the proxy file for your host, the block for your homepage's `<head>` and the robots.txt. In a monorepo it asks you to point it at the site's folder with `--dir`. The text for your AI tool also works in Lovable, v0 or Bolt if your site is Next.js, or Vite deployed on Vercel.

## How do I check it worked?

Run the radar on your domain again. It gives you today's score, what fails and how far you can go, and in the example on the radar page a site goes from 46 to about 74 with the fixes. After that the monitor checks your site every day and tells you if something breaks, and the visit log tells you which agents came to read those files.

## Do I need to know how to code?

No. If you use Claude Code or Cursor, you paste the text that is ready in your dashboard and it does the rest, and if not, you pass it to whoever runs your site. That text tells your tool not to commit or deploy, and the kit does not do it on its own either: you decide that.

## What does it cost and what comes next?

The radar and the kit are free, with no card. If you want an agent that tells you what you are missing, writes those pages and measures whether ChatGPT and Claude cite you, that is Pro: US$30 a month at the founder price for the first 50 businesses, and US$69 after that, with 500 credits a month for the agent's work and 20 tracked questions in AI assistants. Talking to your agent uses no credits.

## Sources

- [Peaje pricing](https://usepeaje.com/precios)
- [Peaje: how it works](https://usepeaje.com/)
- [Free radar](https://usepeaje.com/radar)
- [Peaje CLI on npm](https://www.npmjs.com/package/@peaje/cli)
