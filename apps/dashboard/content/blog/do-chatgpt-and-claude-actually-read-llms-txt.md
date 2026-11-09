---
title: "Do ChatGPT and Claude actually read llms.txt?"
description: What llms.txt is, what OpenAI, Anthropic and Google have said about using it, what bot visits to usepeaje.com show and why a download does not prove the file is used to answer.
date: 2026-11-07
slug: do-chatgpt-and-claude-actually-read-llms-txt
lang: en
categoria: Guide
portada: 1
portada_titulo: Does AI read llms.txt?
traduccion: chatgpt-y-claude-leen-de-verdad-el-llms-txt
---

# Do ChatGPT and Claude actually read llms.txt?

Bots download it, but there is no public confirmation that ChatGPT or Claude use your site's llms.txt to build their answers. OpenAI and Anthropic explain their bots in their documentation and only talk about robots.txt there, even though both publish an llms.txt for their own docs. On usepeaje.com, /llms.txt is among the three routes bots read most, and even so, a bot fetching the file does not prove it uses it to answer.

Updated: November 2026

In the 30 days before November 7, 2026, usepeaje.com got 1108 bot visits, and the routes they read most were /mcp, /developers and /llms.txt, according to Peaje's agent visit log ([how that log works](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in)).

## What is llms.txt?

It is a proposal by Jeremy Howard, published on [llmstxt.org](https://llmstxt.org/) on September 3, 2024, for a site to keep a Markdown file at `/llms.txt` that tells agents what the site is about and where everything is. The only required part is a heading with the site's name, and everything else is optional: a short summary, notes and sections with lists of links. The same proposal suggests offering each page in Markdown too, at the same URL ending in `.md`. It is still a proposal, as its own page says.

## What have OpenAI, Anthropic and Google said?

| Company | What it says about using llms.txt | Does it publish one? |
| --- | --- | --- |
| OpenAI | Its [bots page](https://developers.openai.com/api/docs/bots) explains OAI-SearchBot, GPTBot and ChatGPT-User and how to control them with robots.txt, and does not say they read llms.txt | Yes, at [developers.openai.com/llms.txt](https://developers.openai.com/llms.txt), and that same bots page links to it as the index of its docs |
| Anthropic | Its [help center](https://support.claude.com/en/articles/8896518) explains ClaudeBot, Claude-User and Claude-SearchBot and how to control them with robots.txt, and does not mention llms.txt | Yes, at [platform.claude.com/llms.txt](https://platform.claude.com/llms.txt) (docs.claude.com redirects there) and at [code.claude.com/docs/llms.txt](https://code.claude.com/docs/llms.txt) |
| Google | Its [guide to AI features](https://developers.google.com/search/docs/appearance/ai-features) says you need no new machine-readable files or AI text files to appear in AI Overviews and AI Mode | Yes, for the Gemini API docs, at [aistudio.google.com/llms.txt](https://aistudio.google.com/llms.txt) |

Google was the most direct. John Mueller, from its search team, wrote on Bluesky on June 17, 2025 "FWIW no AI system currently uses llms.txt" ([the post](https://bsky.app/profile/johnmu.com/post/3lrshm4gggs2v)), and we found no later Google announcement that changes it. From OpenAI and Anthropic we found no statement either way.

That all three publish an llms.txt for their docs says they find it useful for people who code with AI and hand that file to their tool. It says nothing about how ChatGPT, Claude or Google Search choose their sources.

## What does the usepeaje.com visit log show?

Of the 1108 visits, the bots that came most were Googlebot (225), ClaudeBot (197) and GPTBot (133). According to Anthropic's and OpenAI's docs, ClaudeBot and GPTBot crawl to train models, and the ones that index for answers with sources are different bots, Claude-SearchBot and OAI-SearchBot. So the two AI bots that visit usepeaje.com most are not the ones that decide which page gets cited.

There are two more limits worth stating. With this data we cannot say which bot read /llms.txt in particular, only that the route is among the most read. And usepeaje.com has llms.txt published and still had 0% of citations in the 20 questions we measured in ChatGPT and Claude on November 7, 2026, so in our case having the file has not been enough to get cited.

## So is it worth having?

Yes, if you see it as a cheap file that helps agents that already reached your site, without expecting it to bring citations on its own. If someone hands your site's URL to a tool like Claude Code or Cursor, it reads it like any other page, and a clear summary with links saves it from guessing. For ChatGPT and Claude to cite you, these weigh more:

- Letting search bots in through your robots.txt ([which ones they are](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in)).
- Having pages that answer your customers' questions, with facts that can be quoted.
- Your business data in JSON-LD, and if your goal is Google, regular SEO ([what Google asks for](https://usepeaje.com/blog/how-do-i-show-up-in-google-ai-overviews)).

## How do I add it to my site?

Peaje's free kit generates llms.txt for your site along with JSON-LD, openapi.json, an MCP server and agent cards, with no card. The steps are in [how do I add llms.txt and JSON-LD](https://usepeaje.com/blog/how-do-i-add-llms-txt-and-json-ld-so-ai-understands-my-site), and if you prefer another tool, in [the free generators that exist](https://usepeaje.com/blog/is-there-a-free-generator-for-llms-txt-json-ld-and-mcp-for-my-website). The kit also comes with the visit log, which tells you who reaches your site and which routes get read most, so you can draw your own conclusions from your site's data.

## Sources

- [llms.txt: Jeremy Howard's proposal](https://llmstxt.org/)
- [OpenAI: overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots)
- [Anthropic: how it crawls the web and how to block its bots](https://support.claude.com/en/articles/8896518)
- [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [John Mueller on Bluesky, June 17, 2025](https://bsky.app/profile/johnmu.com/post/3lrshm4gggs2v)
- [OpenAI's llms.txt](https://developers.openai.com/llms.txt)
- [Anthropic's llms.txt](https://platform.claude.com/llms.txt)
- [Claude Code's llms.txt](https://code.claude.com/docs/llms.txt)
- [Gemini API llms.txt](https://aistudio.google.com/llms.txt)
- [Peaje pricing](https://usepeaje.com/precios)
