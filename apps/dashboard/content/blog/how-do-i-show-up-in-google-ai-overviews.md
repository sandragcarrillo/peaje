---
title: "How do I show up in Google's AI Overviews?"
description: What Google asks for so your site shows up in AI Overviews and AI Mode, how to limit what it shows from your pages, how to measure it and what you do not need.
date: 2026-11-03
slug: how-do-i-show-up-in-google-ai-overviews
lang: en
categoria: Guide
portada: 1
portada_titulo: Your site in AI Overviews
traduccion: como-aparezco-en-los-ai-overviews-de-google
---

# How do I show up in Google's AI Overviews?

With the same SEO as always. Google says that to appear in AI Overviews and AI Mode your page has to be indexed and eligible to show with a snippet in the results, and that there are no additional requirements. What decides whether you get used is the usual: Google can crawl your site, your important content is in text and it answers well what people search for.

Updated: November 2026

According to [Google's guide for site owners](https://developers.google.com/search/docs/appearance/ai-features), you do not need to create new AI files or add special structured data to appear in these features.

## What does Google check?

The same best practices it asks for regular search. From its list, these are the ones that fail most often:

- **Crawling is allowed** in your robots.txt and also by your CDN or your hosting. Bot protection that is too strict can keep Googlebot out without you noticing.
- **Your pages can be found through internal links**, so Google reaches them from other parts of your site.
- **The important content is in text**, and not only inside images or a video.
- **Your structured data matches what the page shows**, for example a product's price.

Google also says AI Overviews and AI Mode may split a question into several related searches (it calls this "query fan-out"). That is why a page that answers one concrete question well serves it better than one that repeats a keyword.

## Do llms.txt or JSON-LD help with Google?

For AI Overviews you do not need them, because Google says so explicitly. They help with the other assistants and agents: llms.txt gives ChatGPT, Claude or a shopping agent a guide to your site, and JSON-LD with your business card helps them understand who you are without guessing. If your only goal is Google, put SEO first, and if you also want the others to cite you, see [how do I add llms.txt and JSON-LD](https://usepeaje.com/blog/how-do-i-add-llms-txt-and-json-ld-so-ai-understands-my-site).

## Can I keep Google from using my pages in its AI answers?

Yes, with the same controls that already exist for results:

| Control | What it does |
| --- | --- |
| `nosnippet` | Shows no snippet from that page, AI features included |
| `data-nosnippet` | Keeps only part of the page out of snippets |
| `max-snippet` | Limits how many characters it can show |
| `noindex` | Removes the page from Google entirely |

Blocking Google-Extended in your robots.txt does not take you out of AI Overviews. Google-Extended controls whether your content is used to train and ground other Google AI systems, and Search is controlled through Googlebot.

If you want to take your whole site out at once, since August 31, 2026 Search Console has a control for that under Settings, "Search generative AI". It is set to include by default, and if you choose to exclude your site it stops appearing in AI Overviews, AI Mode and the generative AI features in Discover.

## How do I know if I show up and how much traffic it brings?

In Search Console, clicks and impressions from AI Overviews and AI Mode are counted in the Performance report, under the "Web" search type, together with everything else. Since August 31, 2026, every site also has a separate generative AI report that shows impressions in those features by page, country, device and date. The step by step, and which tools track it, is in [how to check if your site appears in AI Overviews](https://usepeaje.com/blog/how-do-i-check-if-my-site-appears-in-googles-ai-overviews). Peaje does not count your appearances in AI Overviews, and it works on them another way: its kit allows Googlebot by name, puts the data that identifies your business on your home page and checks that Googlebot can read it.

## Where do I start?

1. Open URL Inspection in Search Console with your most important pages and check that they are indexed.
2. Check that your robots.txt and your CDN let in Googlebot and the other assistants' bots ([which ones they are](https://usepeaje.com/blog/which-ai-bots-visit-my-website-and-how-do-i-let-them-in)).
3. Run your site through [Peaje's free radar](https://usepeaje.com/radar) to see what the other agents understand about your site and whether ChatGPT and Claude cite you.

We explain the difference between what Google asks for and what the other assistants ask for in [what is GEO and how is it different from SEO](https://usepeaje.com/blog/what-is-geo-and-how-is-it-different-from-seo).

## Sources

- [Google Search Central: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google Search Central: snippet controls](https://developers.google.com/search/docs/appearance/snippet)
- [Google: common crawlers, Google-Extended included](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers)
- [Google Search Central: generative AI performance reports](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)
- [Search Console Help: Search generative AI control](https://support.google.com/webmasters/answer/16908024)
- [Peaje free radar](https://usepeaje.com/radar)
