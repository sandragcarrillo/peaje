---
title: "How do I install the Peaje kit in my project with one command?"
description: Reference for the Peaje kit command, what you need, which files it touches in each stack, its options, the exit codes, how to check it and how to undo it.
date: 2026-11-03
slug: how-do-i-install-the-peaje-kit-in-my-project-with-one-command
lang: en
categoria: Guide
portada: 3
portada_titulo: The kit in one command
traduccion: como-instalo-el-kit-de-peaje-en-mi-proyecto-con-un-comando
---

# How do I install the Peaje kit in my project with one command?

In your project folder, run `npx @peaje/cli@1 init <slug> --yes`, where `<slug>` is your site's identifier in Peaje. The command detects your stack and your hosting, connects your site to Peaje and has llms.txt, openapi.json, the MCP server, the agent cards and the JSON-LD answering on your domain. Before that, it pays to run `npx @peaje/cli@1 plan <slug>`, which shows you every file it would touch without changing anything.

Updated: November 2026

The kit is free, with no card, and it does not expire, according to the [pricing page](https://usepeaje.com/precios), and the CLI is open source under the MIT license ([on npm](https://www.npmjs.com/package/@peaje/cli)).

## What do I need before running it?

- **Node 20 or newer.** The CLI has no dependencies.
- **Your slug.** Register your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo) and open "Kit" in your dashboard menu. The page lives at `usepeaje.com/t/<slug>/kit` and has the commands with your slug already filled in.
- **Being in your site's folder.** In a monorepo with several sites, the command stops and asks you for the folder with `--dir`.

If you would rather have your AI tool do it, the same kit page has a text to paste into Claude Code, Cursor or Codex, which runs these commands for you and shows you the list before changing anything ([the step by step](https://usepeaje.com/blog/how-do-i-add-llms-txt-and-json-ld-so-ai-understands-my-site)).

## Which commands are there?

| Command | What it does |
| --- | --- |
| `npx @peaje/cli@1 plan <slug>` | Lists what it would create, edit or move, without writing anything |
| `npx @peaje/cli@1 init <slug> --yes` | Installs the kit in your project |
| `npx @peaje/cli@1 verify <slug>` | Checks on your live domain that everything answers |
| `npx @peaje/cli@1 clean <slug>` | Only moves old copies that shadow the kit to `.peaje-backup/` |

The `@1` pins the major version, so a future release never changes what a script you already have does.

## Which files does it touch?

It depends on your stack:

- **Next.js:** wraps your `next.config` with `withPeaje()`, creates `proxy.ts` (Next 16) or `middleware.ts` (older versions), adds `<PeajeHead />` to the `<head>` of your root layout and adds `@peaje/next` to your `package.json`.
- **Vite on Vercel:** creates a `middleware.ts` at the root and adds `@peaje/proxy`.
- **Express and Hono:** adds one `app.use(...)` line right after your app is created, if it finds it without doubt. If not, it prints the two lines for you to add.
- **Astro and SvelteKit:** prints the lines for your middleware.
- **All of them:** creates `public/robots.txt` if you have none, and if you have one, it appends a block between `# peaje:begin` and `# peaje:end` that lets in the bots that cite, without touching your rules.

It also recognizes Nuxt, Remix, React Router and static sites, and for hosting it recognizes Vercel, Cloudflare, nginx and Caddy. If it does not recognize your stack, it leaves the full kit in the `peaje/` folder for you to set up by hand.

## What does it not touch?

It touches nothing else. The CLI does not run your package manager (it prints the install command), does not delete files, does not rewrite a config it cannot parse and does not edit your footer. If you have your own copies of files the kit serves, like a `public/openapi.json`, it moves them to `.peaje-backup/` with the date.

It also warns you before writing if any of your pages will be shadowed, because the kit answers first on paths like `/docs`, `/developers`, `/mcp` and `/.well-known/`. If you have your own page at `/docs`, move it before you deploy.

## Which options does it have?

| Option | What for |
| --- | --- |
| `--yes` or `-y` | Installs without asking for confirmation |
| `--dir <folder>` | Picks the site folder in a monorepo |
| `--host next\|vercel\|cloudflare\|nginx\|caddy` | Forces the hosting if it does not detect it right |
| `--only aeo` | Installs only robots.txt and your business card in JSON-LD, with no proxy or payments |
| `--json` | Returns the result as JSON, for scripts and AI tools |
| `--wait <seconds>` | With `verify`, retries every 15 seconds for up to that long |

## How do I know it worked?

Deploy your site and run `npx @peaje/cli@1 verify <slug> --wait 600`, which checks on your domain the proxy, the JSON-LD, the `<head>` links, robots.txt and that the assistants' bots can read your site. If you run it right after starting the deploy, it retries for up to 10 minutes. You also see it under "Kit" in your dashboard.

The exit codes are 0 if everything went well, 1 if there was an error or the check failed, 2 if confirmation was needed and there was no terminal or `--yes`, and 3 if it did not recognize your stack.

There is one step the CLI leaves to you: adding `PEAJE_ORIGIN_SECRET` to your hosting's environment variables. You copy it from the kit page, and without it your priced routes are not charged on your domain, although everything else works.

## How do I uninstall it?

Revert the files the command wrote (with git, a `git checkout` of the edited ones and deleting the new ones), delete the block between `# peaje:begin` and `# peaje:end` from your robots.txt, move back what ended up in `.peaje-backup/`, uninstall `@peaje/next` or `@peaje/proxy` and delete `PEAJE_ORIGIN_SECRET` from your hosting. Then you deploy, and your site is back the way it was.

## Sources

- [Peaje CLI on npm](https://www.npmjs.com/package/@peaje/cli)
- [Peaje pricing](https://usepeaje.com/precios)
- [Register your site on Peaje](https://usepeaje.com/nuevo)
