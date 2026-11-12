---
title: "How do I show up in AI search results?"
description: Which bot each AI search engine (Google, ChatGPT, Perplexity, Claude and Copilot) uses to read your site, what each one asks for in its own documentation, how you see whether you show up and what Peaje measures.
date: 2026-11-08
slug: how-do-i-show-up-in-ai-search-results
lang: en
categoria: Guide
portada: 4
portada_titulo: AI search engines
traduccion: como-aparezco-en-los-resultados-de-busqueda-con-ia
---

# How do I show up in AI search results?

You need to let each search engine's bot read your site and have pages that answer what people ask. Google uses Googlebot for AI Overviews and AI Mode, ChatGPT search uses OAI-SearchBot, Perplexity uses PerplexityBot, Claude uses Claude-SearchBot, and Microsoft writes its Copilot controls for Bingbot, so the first step is checking that your robots.txt and your firewall let all of them through. Letting them in is the minimum, and after that what counts is that your pages answer a specific question well.

Updated: November 2026

OpenAI says its systems can take about 24 hours to adjust after you change your robots.txt, according to its [bots page](https://developers.openai.com/api/docs/bots), and Perplexity gives the same window, up to 24 hours, in its [bots guide](https://docs.perplexity.ai/guides/bots). If you just opened the door, wait at least a day before checking whether anything changed.

## Which bot does each AI search engine use to read your site?

Each company has its own search bot, and that bot decides whether your site can show up in its answers:

| Search engine | Bot that reads your site | What its documentation asks for |
| --- | --- | --- |
| Google AI Overviews and AI Mode | Googlebot (the Google Search index) | That your page is indexed and eligible to be shown with a snippet, and Google says there are no additional technical requirements |
| ChatGPT search | OAI-SearchBot | Allowing it in robots.txt and accepting the IP addresses OpenAI publishes. If you block it, you do not show up in its search answers, although you can still appear as a navigational link |
| Perplexity | PerplexityBot | Allowing it in robots.txt, and if you have a firewall, allowing its user-agent together with the IP addresses it publishes |
| Claude with search | Claude-SearchBot | Not blocking it in robots.txt, because Anthropic says blocking it can reduce your visibility in Claude's search results |
| Microsoft Copilot | Bingbot | Not blocking Bingbot, because Microsoft writes its preferences for how your content is used in Bing and Copilot answers for Bingbot |

GPTBot and ClaudeBot are not in the table because they crawl to train models, and neither is Google-Extended, which controls how your content is used in other Google AI systems: blocking them does not take you out of these answers. ChatGPT-User, Claude-User and Perplexity-User are not there either, since they open your page when a person asks the assistant to. The robots.txt ready to copy and how to test that your firewall lets them through are in [which AI bots visit my website and how do I let them in](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in).

## What does each one ask for, besides letting its bot in?

Not much, and each one says it in its own way:

- **Google:** it asks for the same SEO as always, and its guide says you do not need new machine-readable files or special markup to show up in AI Overviews and AI Mode. What it checks and how to limit what it shows are in [how do I show up in Google AI Overviews](https://usepeaje.com/blog/how-do-i-show-up-in-google-ai-overviews).
- **ChatGPT:** OpenAI asks you to allow OAI-SearchBot and accept its IP addresses, and it publishes no content requirements. It also does not say that ChatGPT search comes from the Bing index, and what is known about that relationship is in [how long does Bing take to index my website](https://usepeaje.com/blog/how-long-does-bing-take-to-index-my-website-so-chatgpt-can-find-me).
- **Perplexity:** its guide recommends allowing PerplexityBot in robots.txt, and if your site sits behind a firewall, allowing its user-agent and its IP addresses, which change and should be taken from its official lists. If you use Cloudflare, keep in mind that Perplexity warns that Bot Fight Mode cannot be skipped with custom firewall rules.
- **Claude:** Anthropic says its bots respect robots.txt, including the Crawl-delay extension, and that blocking its IP addresses may not work well as a way to opt out. It publishes no content requirements.
- **Copilot:** on October 30, 2026, Microsoft announced new preferences for answers in Bing, Copilot and Microsoft 365: one for training, which goes in robots.txt, and one for use in answers (AI Grounding), which you set page by page with a meta tag or an `X-Robots-Tag` header for Bingbot. They take effect on February 1, 2027, they are there to limit use, and they do not change your eligibility for regular Bing results. If you use `noarchive` or `nocache` today to keep Copilot out, read the announcement, because after March 1, 2027 Bing stops reading them as a preference.

In the documentation we reviewed, none of the five asks for an llms.txt to show up, and what is known about that file is in [do ChatGPT and Claude actually read llms.txt](https://usepeaje.com/blog/do-chatgpt-and-claude-actually-read-llms-txt). For the content itself, which kind of page won in our own measurement is in [which page format do ChatGPT and Claude cite most](https://usepeaje.com/blog/which-page-format-do-chatgpt-and-claude-cite-most-guide-documentation-or-comparison).

## How do I know whether I show up in each one?

It depends on the search engine, because each one shows different things:

- **Google:** in Search Console, clicks and impressions from AI Overviews and AI Mode are counted in the Performance report, under the "Web" search type, mixed in with the rest.
- **Copilot:** Bing Webmaster Tools has the AI Performance report, in public preview since February 10, 2026, with your site's citations in Copilot, in AI-generated summaries in Bing and in some partner integrations, which pages get cited and a sample of the queries that led to those citations.
- **ChatGPT and Claude:** by asking them what your customers ask and looking at the sources of each answer, again and again ([how it is done](https://usepeaje.com/blog/how-do-i-know-if-chatgpt-claude-or-perplexity-cite-my-business)). The people who arrive from ChatGPT show up in [Google Analytics](https://usepeaje.com/blog/how-do-i-see-how-much-traffic-chatgpt-sends-me-in-google-analytics).
- **Perplexity:** by asking it and checking its sources, the same as with ChatGPT and Claude.

## What does Peaje do and what does it not do?

Peaje covers part of this, and it helps to know which part:

- **Free radar:** at [usepeaje.com/radar](https://usepeaje.com/radar), with your email and your domain, it tells you in less than a minute what an agent can read on your site (robots.txt, llms.txt, sitemap, JSON-LD, prices readable without JavaScript) and asks ChatGPT and Claude three buying questions to see whether they cite you and who they cite instead.
- **Agent visit log, free with the kit:** it counts OAI-SearchBot, PerplexityBot, Googlebot, ClaudeBot and GPTBot by name, also when they read pages your site serves on its own. Claude-SearchBot and Bingbot show up under "Other" with their names when they read the kit files, like /llms.txt or /mcp, and their reads of your other pages are not counted yet.
- **Pro:** your agent measures 20 of your customers' questions in ChatGPT and Claude every week, proposes the pages you are missing and measures each verified page again at 2 and 6 weeks. It costs US$30 a month for the first 50 businesses and US$69 after that, according to the [pricing page](https://usepeaje.com/precios).

Peaje does not count your appearances in Google AI Overviews or AI Mode, Perplexity or Copilot, and for that you use Search Console, Bing Webmaster Tools and your own searches. In those engines it works another way: the kit allows Googlebot, Bingbot and PerplexityBot by name in your robots.txt and checks that Googlebot and PerplexityBot can read your home page without JavaScript, which is what they need to cite you ([how it does it with Google](https://usepeaje.com/blog/how-do-i-check-if-my-site-appears-in-googles-ai-overviews)). And Peaje cannot promise that you will be cited: on November 7, 2026, usepeaje.com had 0% citations in the 20 questions we measured in ChatGPT and Claude.

## Where do I start?

1. Check your robots.txt and your firewall against the five bots in the table, and wait a day after each change.
2. Confirm in Search Console that your important pages are indexed, and add your site to Bing Webmaster Tools to see the Copilot report.
3. Write one page for each important question your customers ask, with the answer at the top and a fact that can be cited.
4. Run your site through the [free radar](https://usepeaje.com/radar) to see what an agent reads and whether ChatGPT and Claude already cite you.

If you want to understand how all of this differs from regular SEO, it is in [what is GEO and how is it different from SEO](https://usepeaje.com/blog/what-is-geo-and-how-is-it-different-from-seo).

## Sources

- [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [OpenAI: bots and user-agents](https://developers.openai.com/api/docs/bots)
- [Perplexity: its bots](https://docs.perplexity.ai/guides/bots)
- [Anthropic: how it crawls the web and how to block its bots](https://support.claude.com/en/articles/8896518)
- [Bing: preferences for training and grounding (October 30, 2026)](https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/)
- [Bing: AI Performance in Bing Webmaster Tools (February 10, 2026)](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)
- [Peaje pricing](https://usepeaje.com/precios)
- [Peaje free radar](https://usepeaje.com/radar)
