---
title: "Peaje for SaaS: get ChatGPT and Claude to list you among the options in your category"
description: The questions software buyers use to pick a tool in ChatGPT and Claude, what Peaje checks on a SaaS site (pricing, docs, comparisons) and which tasks your agent hands to Claude Code or Cursor.
date: 2026-11-22
updated: 2026-11-22
slug: saas
lang: en
corto: SaaS
orden: 2
traduccion: saas
---

# Peaje for SaaS: get ChatGPT and Claude to list you among the options in your category

People shopping for software ask AI for a short list: the best options for their case, alternatives to the tool they already use, or one product against another. ChatGPT and Claude build that list from the pages they read: comparisons, "best of" lists, pricing pages and documentation. If your product has none of those, or keeps them behind a login, the list comes out without you. Peaje measures which questions in your category you show up for, checks what an agent finds on your site and hands the tasks to your coding tool.

## What software buyers ask AI

- Which invoicing software works for a small business in Mexico?
- Best tool to book appointments online for a small clinic
- Cheaper alternatives to a big CRM for a team of five
- Which WhatsApp messaging API has good documentation?
- Inventory software that connects to my online store
- Which payroll tool works for companies in Mexico and Colombia?
- Survey platform with a free plan and Excel export

The free Radar writes three questions like these from your site, without your brand, and shows you which products and pages ChatGPT and Claude cite instead of you.

## What Peaje checks on a SaaS site

- **Whether an agent can find what you charge.** With no visible pricing, an agent comparing options cannot recommend you.
- **Whether your homepage links to your docs**, and whether those docs can be read without signing in. Anything behind a login does not exist for an agent.
- **Whether there is a portal where people get their keys on their own** and a test mode to build the connection without touching real data.
- **Whether an agent can start using you without a person's help.** Every manual step is a place where it gives up.
- **Whether AI recommends you when someone looks for what you do without naming you**, and whether your site comes up first when people search your brand.
- **Whether your pages are a length an agent can read.** A very long page gets cut off before it reaches the part that matters.
- **Whether your content shows without JavaScript.** Many SaaS landing pages are built in the browser, and an AI crawler sees them empty.

## Which tasks your agent leaves for your team

- **Comparisons and lists in the shape AI cites.** Peaje records which kind of page AI cites for each question. If it answers "alternatives to a big CRM" with comparisons, the draft is a comparison: who each option is for, a table with price, limits and coverage, and a verdict per use case. If it cites documentation, the draft is documentation with a working example. With Pro that is up to {{paginas}} drafts a month, using only facts from your site.
- **Routes agents ask for that do not exist.** If agents asked for a path on your site at least twice in 30 days and got a 404, the task asks whether you can answer it with your own data, and how.
- **Search Console, if you connect it.** Rewriting the title and description of a page Google shows and nobody clicks, or improving one that sits on the first page behind others. It is read-only: Peaje changes nothing in your Search Console.
- **Getting named elsewhere.** The lists, reviews and forums AI cites for your questions, with a short request for each one that you send.
- **Old or undated pages**, so you check the facts and say when you updated them.

Each task arrives as a complete prompt with acceptance criteria. Claude Code or Cursor pick it up over MCP or with the Peaje CLI. When you mark it done, Peaje opens your live site and closes it only if the change is published.

## What Peaje does not do

- It only measures ChatGPT and Claude. It does not measure Gemini, Perplexity, Copilot or Google's AI Overviews.
- It tracks {{preguntas}} questions per site, not hundreds. If your product has many lines and markets, that falls short.
- The subscription is per site. Two products on different domains are two subscriptions.
- Your agent does not commit or deploy. It prepares the task, and your team or your coding tool applies it once you say yes.
- We do not guarantee you will be cited. Peaje measures each fix again at 2 and 6 weeks.

## Frequently asked questions

### Does Peaje work with my stack?

The kit command recognizes Next.js, Nuxt, Astro, SvelteKit, Remix, React Router, Hono, Express and Vite, and for hosting Vercel, Cloudflare, nginx and Caddy. If you use something else, it leaves the kit in a folder with what has to be added by hand.

### How do I hand the tasks to Claude Code or Cursor?

You connect your tool to Peaje's MCP and it lists your tasks, reads each one, applies it in your repo and marks it done with the live URL. If you prefer the terminal, the Peaje CLI does the same.

### Do the comparisons it writes mention my competitors?

Yes, when the question is a comparison. The draft lists your product honestly among the options and only uses facts anyone can check. You review it before it goes live.

### How much does it cost?

The Radar and the kit are free. Pro is US${{founder}} a month at the founder price for the first {{cupos}} businesses, and US${{pro}} a month after that, with {{creditos}} credits a month for the agent's work. Talking to your agent does not use credits.

## Guides for your SaaS

- [How do I see how much traffic ChatGPT sends me in Google Analytics?](https://usepeaje.com/blog/how-do-i-see-how-much-traffic-chatgpt-sends-me-in-google-analytics)
- [How do I send my Peaje tasks to Claude Code or Cursor through MCP?](https://usepeaje.com/blog/how-do-i-send-my-peaje-tasks-to-claude-code-or-cursor-through-mcp)
- [How do I get Claude to cite my website?](https://usepeaje.com/blog/how-do-i-get-claude-to-cite-my-website)
