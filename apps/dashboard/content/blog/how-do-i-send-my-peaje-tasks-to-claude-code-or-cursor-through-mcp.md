---
title: "How do I send my Peaje tasks to Claude Code or Cursor through MCP?"
description: How to connect your AI coding tool to Peaje through MCP, what to ask it afterwards and how Peaje checks on your site that each task went live.
date: 2026-10-29
slug: how-do-i-send-my-peaje-tasks-to-claude-code-or-cursor-through-mcp
lang: en
categoria: Guide
portada: 3
portada_titulo: Tasks in your favorite tool
portada_logos: claude, cursor, codex, chatgpt, lovable, windsurf, copilot
traduccion: como-paso-las-tareas-de-peaje-a-claude-code-o-cursor-por-mcp
---

# How do I send my Peaje tasks to Claude Code or Cursor through MCP?

You connect your tool once from Integrations, in your Peaje dashboard, and then you tell it "Apply my Peaje tasks". Your tool reads each task with its instructions, makes the change in your project and, once you deploy, marks it done with the URL. Peaje checks that URL on your site and closes the task only if the change is live.

Updated: October 2026

Integrations is part of the Pro plan, which costs US$30 a month at the founder price for the first 50 businesses and US$69 after that, with 500 credits a month, according to the [pricing page](https://usepeaje.com/precios).

## What is a Peaje task?

It is a change your Peaje agent leaves ready for your site: fixing a failing check, publishing a page that assistants would cite or creating a route that agents asked for and did not find. Each task comes with the text for your AI coding tool and the criteria Peaje will check on your site. Peaje never touches your site: it proposes, your tool makes the change and you decide when to deploy.

## How do I connect my tool?

In your dashboard, open "My agent" and go to Integrations. Your key is there, along with the exact line for each tool, with the key already filled in:

- **Claude Code:** open the terminal in your site's folder and run `claude mcp add --transport http peaje https://api.usepeaje.com/_owner/mcp --header "Authorization: Bearer <your key>"`. It stays connected in the terminal and in the desktop app whenever you work in that folder.
- **Cursor:** tap "Add to Cursor". The first time, Cursor asks you to sign in to Peaje and pick the business, with no key to paste. If you prefer the key, it goes in your project's `.cursor/mcp.json`.
- **Codex:** in the terminal, save your key with `export PEAJE_AGENT_KEY=<your key>` and then run `codex mcp add peaje --url https://api.usepeaje.com/_owner/mcp --bearer-token-env-var PEAJE_AGENT_KEY`. That way the key is not written into Codex's config.
- **Claude and ChatGPT (the chat apps):** you add them as a custom connector with the URL shown in Integrations, and when you connect you pick your business and allow it, with no key. In ChatGPT you have to turn on developer mode first. They are for asking your agent; the code changes are made by your coding tool.
- **Others:** Lovable, Windsurf, GitHub Copilot, v0, Replit and any tool that takes MCP. Integrations shows you how to connect each one.

## What do I ask it afterwards?

Phrases like these, in your own words:

- "Apply my Peaje tasks"
- "Ask Peaje who AI cites instead of me"
- "Ask Peaje which page to publish first"

With the first one, your tool lists the open tasks, reads one in full, marks it "in progress" so you see it in your dashboard and makes the change. You review it, and you do the commit and the deploy.

## What happens when I mark it done?

After you deploy, your tool calls Peaje with the live URL. Peaje checks the task's criteria right then: if they all pass, it closes it as verified, and if your deploy is not out yet, it leaves it waiting and checks again every day. We use it this way on Peaje's blog: the five articles we published on October 28 came from five tasks we closed from Claude Code with each one's URL.

If a task does not apply to your business, your tool can dismiss it with the reason, and it stops showing up among your open tasks.

## What if I do not use MCP?

The same list is available in the terminal with Peaje's CLI, which reads your key from `PEAJE_AGENT_KEY`: `npx @peaje/cli@1 tasks` shows the open tasks, `npx @peaje/cli@1 task <id>` the full text and `npx @peaje/cli@1 done <id> --url <url>` marks it done after you deploy.

## What does it cost and what should I watch out for?

Tasks come with Pro. Talking to your agent uses no credits, a reply that looks up your business's data uses 2, each new task it leaves you uses 8 and asking it to look for new tasks uses 30, out of your 500 a month. Your key gives access to your business in Peaje, so do not commit it to your repository: if it leaks, you create a new one in Integrations and the old one stops working.

## Sources

- [Peaje pricing](https://usepeaje.com/precios)
- [Peaje CLI on npm](https://www.npmjs.com/package/@peaje/cli)
- [Claude Code: connecting MCP servers](https://docs.claude.com/en/docs/claude-code/mcp)
- [Cursor: MCP servers](https://cursor.com/docs/context/mcp)
- [Codex: MCP servers](https://developers.openai.com/codex/mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
