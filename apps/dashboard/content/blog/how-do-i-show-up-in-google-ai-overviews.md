---
title: "How to show up in Google AI Overviews (and check that you do)"
description: How to get in Google AI Overviews and AI Mode in 2026, according to Google itself, five steps to start this week, how to check if you appear and how to take your site out.
date: 2026-11-03
updated: 2026-11-22
slug: how-do-i-show-up-in-google-ai-overviews
lang: en
categoria: Guide
portada: 1
portada_titulo: Your site in AI Overviews
traduccion: como-aparezco-en-los-ai-overviews-de-google
---

# How to show up in Google AI Overviews (and check that you do)

To show up in Google AI Overviews, your page has to be indexed and eligible to appear in Google with a snippet. Google says there are no additional requirements: no special file, no special markup. After that, Google picks the pages that best answer the question, so what moves you is the usual SEO work, a site Googlebot can crawl and pages that answer one concrete question in text.

Updated: November 22, 2026

This comes from [Google's guide for site owners on AI features](https://developers.google.com/search/docs/appearance/ai-features), which covers AI Overviews and AI Mode. The same guide warns that meeting the requirements does not guarantee Google will crawl, index or show your page.

## What does Google check to show your page in AI Overviews?

The same best practices it asks for regular search. Google lists these:

- Crawling is allowed in your robots.txt and also by your CDN or your hosting. Bot protection that is too strict can keep Googlebot out without you noticing.
- Your pages can be found through internal links.
- The page experience is good.
- The important content is in text, and not only inside images or a video.
- Images and videos support the text where they help.
- Your structured data matches what the page shows, for example a product's price.
- Your Merchant Center and Business Profile information is up to date, if you have them.

Google also explains that AI Overviews and AI Mode may split a question into several related searches across subtopics (it calls this "query fan-out"). That is why a page that answers one question well has more chances than a page that repeats a keyword many times.

## How to get in Google AI Overviews: five steps to start

1. **Check that your pages are indexed.** Open URL Inspection in Search Console with your five most important pages. If a page is not indexed, it cannot show up.
2. **Let Googlebot in.** Review your robots.txt, your CDN and your firewall. If you use Cloudflare or a similar service, check that it does not challenge Googlebot ([which bots to let in](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in)).
3. **Answer the question in the first paragraph.** Write the question the way a customer types it, as a heading, and answer it right below in two or three sentences. Then add the detail.
4. **Pick questions where an AI Overview shows up.** Google only shows one when its systems think it adds something to the regular results, so many searches never get one. Search your questions and keep the ones that do.
5. **Keep your data consistent.** Prices, hours and addresses should match across your page, your structured data, Merchant Center and your Business Profile.

## Do llms.txt or JSON-LD help with Google?

For AI Overviews you do not need them, because Google says so explicitly. They help with the other assistants and agents: llms.txt gives ChatGPT, Claude or a shopping agent a guide to your site, and JSON-LD with your business card helps them understand who you are without guessing. If your only goal is Google, put SEO first. If you also want the others to cite you, see [how do I add llms.txt and JSON-LD](https://usepeaje.com/blog/how-do-i-add-llms-txt-and-json-ld-so-ai-understands-my-site).

## How do I show up in ChatGPT, Claude and other AI search results?

Each assistant reads your site with its own bot, so being in Google AI Overviews does not put you in ChatGPT or Claude. ChatGPT search uses OAI-SearchBot and Claude uses Claude-SearchBot, and both have to be allowed in your robots.txt. What each one asks for is in [how do I show up in AI search results](https://usepeaje.com/blog/how-do-i-show-up-in-ai-search-results), and the [free radar](https://usepeaje.com/radar) shows you in under a minute what ChatGPT and Claude answer about your business today.

## How do I check if I show up in AI Overviews?

There are three ways, and they answer different things:

| Where | What it tells you | What it does not tell you |
| --- | --- | --- |
| Search Console, generative AI report | How many times your pages appeared in AI Overviews and AI Mode, by page, country, device and date | Which searches, and which part came from each feature |
| Search Console, Performance report (Web) | Clicks, impressions, queries and position | Which of those came from AI Overviews, because they are added to the rest |
| Searching by hand in a private window | Whether your site is among the links of that AI Overview, today and from where you are | What other people see, because results change by place, device and language |

Google rolled out the generative AI report to every site on August 31, 2026, according to [Google Search Central](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports). To keep track without checking every day, save a short list of questions, search them the same way every week or two and write down who the summary cites when it is not you. The step by step is in [how to check if your site appears in AI Overviews](https://usepeaje.com/blog/how-do-i-check-if-my-site-appears-in-googles-ai-overviews).

## Which tools track appearances in AI Overviews?

SEO tools that follow keywords already check whether a search shows an AI Overview and whether your site is cited in it. According to their own sites, Semrush does it in Position Tracking, Ahrefs in Brand Radar and SE Ranking in its AI Overviews Tracker. Their numbers come from the searches each tool runs, in the countries and devices you pick, so they do not have to match Search Console. We leave out their prices because they change.

## An example: this page, read from Search Console

This page got rewritten because of Search Console. Peaje's agent reads its owner's Search Console in read-only mode, and over 28 days read in November 2026 it saw that this guide had been shown 122 times at an average position of 68, with searches like "how to show up in google ai overviews" (26 impressions) and "how to get in google ai overviews" (24). Google already matched the page to those searches, but it sat behind pages that answered them better. The agent left the task to answer them in the first paragraph, and this version is the result.

Peaje does not count your appearances in AI Overviews. It measures ChatGPT and Claude. What it does for Google is help Googlebot read you: its free kit allows Googlebot by name in your robots.txt, puts the data that identifies your business on your home page and checks that Googlebot can read it. With Pro, your agent connects to your Search Console, finds the pages Google shows and nobody opens, and leaves you the task to fix each one. Pro costs US$30 a month as the founder price for the first 50 businesses, and US$69 after that ([pricing](https://usepeaje.com/precios)).

## Can I keep Google from using my pages in its AI answers?

Yes, with the same controls that already exist for results:

| Control | What it does |
| --- | --- |
| `nosnippet` | Shows no snippet from that page, AI features included |
| `data-nosnippet` | Keeps only part of the page out of snippets |
| `max-snippet` | Limits how many characters it can show |
| `noindex` | Removes the page from Google entirely |

Blocking Google-Extended in your robots.txt does not take you out of AI Overviews. Google-Extended controls whether your content is used to train and ground other Google AI systems, and Search is controlled through Googlebot.

To take your whole site out at once, Search Console has a control under Settings, "Search generative AI", available to every site since August 31, 2026. It is set to include by default. If you choose to exclude your site, it stops appearing in AI Overviews, AI Mode and the generative AI features in Discover within one or two days, and Google says this does not change how you appear in the rest of Search.

## Frequently asked questions

### Do I need to be first on Google to show up in an AI Overview?

Google does not ask for a position. It asks for the page to be indexed and eligible to show with a snippet. In practice it picks the pages that answer the question best, and those tend to already do well in regular search.

### Is there a special schema or file for AI Overviews?

No. Google says you do not need new machine-readable files, AI text files or special schema.org markup. Structured data helps when it matches what the page shows.

### Does blocking Google-Extended take me out of AI Overviews?

No. To limit what Google shows in Search you use `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex` or the Search generative AI control in Search Console.

### Does Peaje measure AI Overviews?

Not today. Peaje measures whether ChatGPT and Claude cite you. For AI Overviews, the source is your Search Console, and Peaje's agent reads it if you connect it.

## Sources

- [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google Search Central: snippet controls](https://developers.google.com/search/docs/appearance/snippet)
- [Google: common crawlers, Google-Extended included](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers)
- [Google Search Central: generative AI performance reports](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)
- [Search Console Help: Search generative AI control](https://support.google.com/webmasters/answer/16908024)
- [Semrush: how to track AI Overviews](https://www.semrush.com/blog/semrush-ai-overview-research/)
- [Ahrefs: Brand Radar](https://ahrefs.com/brand-radar)
- [SE Ranking: AI Overviews Tracker](https://seranking.com/ai-overviews-tracker.html)
- [Peaje free radar](https://usepeaje.com/radar)
- [Peaje pricing](https://usepeaje.com/precios)
