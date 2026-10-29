---
title: "Which AI bots visit my website and how do I let them in?"
description: The bots from OpenAI, Anthropic and Perplexity, what each one does, the robots.txt to let them in and how to know which ones actually show up.
date: 2026-10-28
slug: which-ai-bots-visit-my-website-and-how-do-i-let-them-in
lang: en
categoria: Guide
portada: 2
portada_titulo: AI bots on your site
traduccion: que-bots-de-ia-visitan-mi-web-y-como-los-dejo-pasar
---

# Which AI bots visit my website and how do I let them in?

The ones that matter most are OpenAI's (OAI-SearchBot, GPTBot and ChatGPT-User), Anthropic's (Claude-SearchBot, ClaudeBot and Claude-User) and Perplexity's (PerplexityBot and Perplexity-User). To get recommended with a link, you only need to let the search bots in through your `robots.txt` and check that your firewall does not stop them, and you can block the training bots without losing citations. To know which ones actually come in, you need a visit log, and Peaje includes one on the free plan.

Updated: October 2026

Peaje's agent visit log costs US$0 and needs no card, according to the [pricing page](https://usepeaje.com/precios), and it comes with the rest of the kit: llms.txt, openapi.json, an MCP server, agent cards and JSON-LD for your site.

## Which bot is which, and why does it come in?

Each company has one bot to search, another to train and another that comes in when a person asks the assistant for something, and only the first one decides whether you show up in answers.

| Bot (user-agent) | Company | Why it comes in |
| --- | --- | --- |
| OAI-SearchBot | OpenAI | Indexes for ChatGPT search. Block it and you do not show up in its answers |
| GPTBot | OpenAI | Crawls to train models |
| ChatGPT-User | OpenAI | Opens your page when someone asks ChatGPT to, and may not follow robots.txt |
| Claude-SearchBot | Anthropic | Indexes for Claude's searches |
| ClaudeBot | Anthropic | Crawls to train models |
| Claude-User | Anthropic | Opens your page when someone asks Claude to |
| PerplexityBot | Perplexity | Indexes for Perplexity's answers with links, and does not train models |
| Perplexity-User | Perplexity | Opens your page when someone asks a question, and generally does not follow robots.txt |

Google-Extended is not in the table because it never visits your site: you write it in robots.txt to decide whether Google uses your content in its AI products.

## How do I let them in?

Put this at the top of `https://yoursite.com/robots.txt` (or in `app/robots.ts` if your site generates it):

```
User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /

Sitemap: https://yoursite.com/sitemap.xml
```

If you do not want them training on your content, add `Disallow: /` for GPTBot, ClaudeBot and Google-Extended, and that does not take you out of answers. Then check that your site responds:

```
curl -I -A "OAI-SearchBot/1.0" https://yoursite.com/
```

The right answer is an `HTTP/2 200` with your page. Some firewalls also check the bot's IP, so this test catches blocks by user-agent and not every other kind.

## What happens if something blocks them?

If the response is not 200, the bot reads nothing, and these are the most common cases:

- **403 or a challenge page:** your firewall or CDN treats them as bad bots. In Cloudflare, "Block AI bots" also blocks the ones that search, so it is better to turn it off and block only the training bots.
- **429:** the request limit is too low for them, raise it for these user-agents.
- **401:** what you sell is behind a login, so leave at least what you sell and its price public.
- **200 with an empty page:** your site builds the content with JavaScript only, and the bot does not see it. Serve the text in the HTML.

## How do I know which ones really visit me?

With the visit log in the free kit. You register your site at [usepeaje.com/nuevo](https://usepeaje.com/nuevo), and in your dashboard, under "Install the kit", you get a text ready to paste into your AI coding tool or the command `npx @peaje/cli@1 init <slug>`. It counts OAI-SearchBot, PerplexityBot, Googlebot, ClaudeBot and GPTBot by name, even when they read pages your site serves on its own, like the homepage or the blog, and the rest show up under "Other" with each one's name. Visits from people in a browser do not count, and for each bot it keeps only the path and its user-agent. If you turn on your agent, it sends you the summary on Telegram every day, week or month, for example "This week 38 agents visited you: ChatGPT 21, Perplexity 9, Claude 8".

## Is letting them in enough to get recommended?

No, getting in is the minimum. After that they have to understand what you sell and at what price, and that is what the rest of the free kit is for. If you want someone to do the work with you, the Pro agent costs US$30 a month (the founder price for the first 50 businesses, then US$69), with 500 credits a month and 20 tracked questions in AI assistants. To start, the [free radar](https://usepeaje.com/radar) tells you in under a minute what an agent sees when it reaches your site.

## Sources

- [OpenAI: bots and user-agents](https://developers.openai.com/api/docs/bots)
- [Anthropic: how its crawlers work](https://support.claude.com/en/articles/8896518)
- [Perplexity: its bots](https://docs.perplexity.ai/guides/bots)
- [Peaje pricing](https://usepeaje.com/precios)
- [Free radar](https://usepeaje.com/radar)
