---
title: "How do I check if my site appears in Google's AI Overviews?"
description: What Search Console shows you about AI Overviews and AI Mode, how to check by hand, which tools track your appearances and what Peaje does so Google can read you.
date: 2026-11-08
slug: how-do-i-check-if-my-site-appears-in-googles-ai-overviews
lang: en
categoria: Guide
portada: 2
portada_titulo: Your AI Overviews appearances
traduccion: como-se-si-mi-sitio-aparece-en-los-ai-overviews-de-google
---

# How do I check if my site appears in Google's AI Overviews?

Open Search Console and go to the Generative AI performance report: it tells you how many times links to your site showed up in AI Overviews and AI Mode, by page, country, date and device. That report does not tell you which searches you appeared for and does not split AI Overviews from AI Mode, so to know which question you show up for you have to search it on Google or use a tool that tracks it.

Updated: November 2026

Google launched that report on June 3, 2026 for a group of sites, and since August 31, 2026 it is available to every site worldwide, according to the [Google Search Central blog](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports).

## What does Search Console tell you about AI Overviews?

AI Overviews show up in two reports, and each one shows something different:

| Report | What it tells you | What it does not tell you |
| --- | --- | --- |
| Generative AI performance (Search) | Impressions of your links in AI Overviews and AI Mode, by page, country, date and device | Clicks, queries, and how much comes from each feature on its own |
| Performance, Web search type | Clicks, impressions, queries and position | Which of that data comes from AI Overviews, because it is added to everything else |

In the regular Performance report, Google counts AI Overviews and AI Mode under the Web search type. A click to your page from an AI Overview counts as a click, impressions follow the standard rules and an AI Overview takes a single position in the results, so all of its links get that same position. If someone asks a follow-up question inside AI Mode, Google counts it as a new search. Search Labs experiments are left out of both reports.

If you do not see the Generative AI report, Google says it is usually because your site has very few impressions in those features, or because you excluded it under **Settings > Search generative AI**. That control is set to include by default, and if you switch it to exclude, your links stop showing in AI Overviews, AI Mode and the generative AI features in Discover.

To combine the two reports, look at which pages have impressions in the Generative AI report, filter the Performance report by that page and check which queries it shows up for. Those are the questions worth searching by hand.

## How do I check by hand whether I show up?

By searching your questions on Google and looking at the links in the summary:

1. Open a private window, so your Google account history stays out of it. If you search while signed in and the results are personalized, Google puts a "Try without personalization" link at the bottom of the page.
2. Type the question the way a customer would, for example "how to see if you are featured in ai overviews", and check whether an AI Overview appears.
3. Look at the links the summary uses as sources and write down whether your site is there, with which page and who it cites instead of you.
4. Repeat the search in AI Mode. Google says AI Mode and AI Overviews may use different models and techniques, so their responses and links vary.

What you see holds for that search, at that moment and from that place. Google explains that its results change with time, location, language, device type and personalization, so someone else may see something different. Google also shows an AI Overview only when its systems decide it helps, so some searches come without one. To make the check useful, keep a short list of questions and search them the same way every week or two.

## Which tools track appearances in AI Overviews?

SEO tools that track keywords already check whether your searches show an AI Overview and whether your site is cited. These say so on their own websites:

- **Semrush:** its Position Tracking follows appearances in AI Overviews for the keywords you define, and its guide explains how to filter the ones that show an AI Overview citing your domain and the ones that do not.
- **Ahrefs:** Brand Radar covers AI Overviews and AI Mode, along with ChatGPT, Perplexity, Gemini and Copilot.
- **SE Ranking:** its AI Overviews Tracker shows whether your keywords have an AI Overview, where your site appears inside it and which domains it uses as sources.

What they show comes from the searches each tool runs, in the countries and on the devices you choose, while Search Console uses Google's own data, so their numbers do not have to match. We do not list their prices because they change, so check them on each site. If you want a comparison of tools for ChatGPT and Claude, see [AEO tools: which exist and what they cost](https://usepeaje.com/blog/aeo-tools-which-exist-and-what-they-cost).

## What does Peaje do about AI Overviews?

Peaje does not count your appearances in AI Overviews, because Search Console has that data. It works on the same goal another way: making sure Google can read your site and understand who you are, which is what it needs to cite you.

- **The kit** allows Googlebot and the other search bots by name in your robots.txt, and puts the data that identifies your business in the head of your home page. In the "Answer engines" section it checks that Googlebot, OAI-SearchBot and PerplexityBot can read your home page and /developers, and warns you if your server rejects them with a 403, 429 or 503, if Cloudflare gives them a challenge they cannot pass or if your home page depends on JavaScript.
- **The agent visit log**, which comes with the free plan, counts how many times Googlebot reads your site. On usepeaje.com it counted 225 Googlebot visits in 30 days. That tells you Google reads you, and whether it also cites you in an AI Overview you see in Search Console or by searching by hand.
- **The free radar** checks what an AI agent can read on your site and gives you your score in less than a minute. On the same page it shows you what ChatGPT and Claude answer to three questions from someone looking for what you offer.
- **Pro** measures 20 of your customers' questions in ChatGPT and Claude every week, tells you who they cite instead of you and measures each verified page again at 2 and 6 weeks.

None of this guarantees that Google cites you, because that also depends on your content and on what other sites say about you. What Google asks for to show up in AI Overviews is regular SEO, and we cover it in [how do I show up in Google's AI Overviews](https://usepeaje.com/blog/how-do-i-show-up-in-google-ai-overviews). For ChatGPT, Claude and Perplexity, see [how do I know if ChatGPT, Claude or Perplexity cite my business](https://usepeaje.com/blog/how-do-i-know-if-chatgpt-claude-or-perplexity-cite-my-business).

## How do I see how many visits AI Overviews bring me?

Google Analytics 4 has no separate channel for them. GA counts visits from AI Overviews and AI Mode under "Organic Search", together with the rest of Google, and its AI Assistant channel only groups the ones that come from assistants like ChatGPT, Gemini and Claude. We explain it step by step in [how do I see how much traffic ChatGPT sends me in Google Analytics](https://usepeaje.com/blog/how-do-i-see-how-much-traffic-chatgpt-sends-me-in-google-analytics).

The closest thing you have is Search Console: the Generative AI report's impressions by page, and that page's clicks in the Performance report, knowing those clicks also include the regular results.

## Sources

- [Google Search Central: Search generative AI performance reports in Search Console (June 3, 2026)](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)
- [Search Console Help: Generative AI performance report (Search)](https://support.google.com/webmasters/answer/16984139?hl=en)
- [Search Console Help: Search generative AI control](https://support.google.com/webmasters/answer/16908024?hl=en)
- [Search Console Help: what are impressions, position and clicks](https://support.google.com/webmasters/answer/7042828?hl=en)
- [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google Search Help: why your results differ from others](https://support.google.com/websearch/answer/12412910?hl=en)
- [Google Search Help: AI Overviews](https://support.google.com/websearch/answer/14901683?hl=en)
- [Google Analytics: default channel group](https://support.google.com/analytics/answer/9756891?hl=en)
- [Semrush: how to track AI Overviews](https://www.semrush.com/blog/semrush-ai-overview-research/)
- [Ahrefs: Brand Radar](https://ahrefs.com/brand-radar)
- [SE Ranking: AI Overviews Tracker](https://seranking.com/ai-overviews-tracker.html)
- [Peaje free radar](https://usepeaje.com/radar)
- [Peaje pricing](https://usepeaje.com/precios)
