---
title: "How do I show up in Microsoft Copilot answers?"
description: What Bing says a page needs to get cited in Copilot, which tags can take you out without you noticing, how to see your citations in the AI Performance report and what Peaje does and does not do.
date: 2026-11-13
slug: how-do-i-show-up-in-microsoft-copilot-answers
lang: en
categoria: Guide
portada: 2
portada_titulo: Show up in Copilot
traduccion: como-aparezco-en-las-respuestas-de-copilot-de-microsoft
---

# How do I show up in Microsoft Copilot answers?

Copilot picks what to cite on top of the same crawling, indexing and ranking as Bing search, according to Bing's webmaster guidelines, so the first step is making sure Bingbot can read your site and your pages are in Bing's index. After that, what matters is that each page covers one clear topic, with the important part at the top, and that you tell Bing through IndexNow every time something changes. You can see your citations in the AI Performance report in Bing Webmaster Tools.

Updated: November 2026

The AI Performance report has been in public preview since February 10, 2026 and measures four things: total citations, the average number of your pages cited per day, a sample of the queries the AI ran before citing you and the citations for each URL, according to [Bing's announcement](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview).

## Where does Copilot get the pages it cites?

It takes them from Bing's index. The [webmaster guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a) say Bing and Copilot search experiences rely on the same crawling, indexing and ranking foundation as traditional search, and that what helps SEO also helps a page become eligible to be used in answers (what Bing calls grounding) and to be cited. If you do not follow the guidelines, Bing warns that you can lose visibility in search, become less eligible for those answers or be removed from the index.

The same guidelines make clear that GEO (generative engine optimization) does not guarantee citations, just as SEO does not guarantee a ranking. Which bot each AI search engine uses and how Copilot compares with the others is in [how do I show up in AI search results](https://usepeaje.com/blog/how-do-i-show-up-in-ai-search-results), and how to add your site to Bing Webmaster Tools and how IndexNow works is in [how long does Bing take to index my website](https://usepeaje.com/blog/how-long-does-bing-take-to-index-my-website-so-chatgpt-can-find-me).

## What does Bing ask for so a page gets cited in Copilot?

Bing's guidelines are long, and these are the points that matter most for showing up in an answer:

| What Bing asks for | Why, according to its guidelines |
| --- | --- |
| Let Bingbot in through robots.txt and do not hide content behind JavaScript | What Bing cannot read or render may stay out of the index and out of answers |
| Notify IndexNow when you add, change or delete a URL | It helps keep Copilot from citing old versions or URLs that no longer exist |
| A sitemap with only canonical URLs and their change date (`lastmod`) | It tells Bing which pages matter and when they changed |
| One topic per page, with the important part at the top and no long introductions | Pages focused on one topic are more likely to be used for an answer |
| Explicit facts and definitions that make sense without another page | Bing favors content that can be verified on its own |
| The same names for your company, products and locations across the whole site | It improves citation accuracy |
| Structured data that matches what the page shows | It can help, although Bing says it does not guarantee visibility |

The guidelines also name what hurts you: copied content with nothing of your own added, text written to force citations, content generated at scale without review, and text meant to manipulate Bing or Copilot models, which can lower your visibility or remove you from search.

In the AI Performance announcement, Bing adds advice for the pages you already have: use tables, headings and FAQ sections, back up your claims with data and sources, keep content up to date and, if you run a local business, register it in Bing Places for Business with your address, hours and contact details kept current.

## Which tags can take you out of Copilot without you noticing?

Some tags people add for other reasons change what Copilot can do with your page. According to Bing's guidelines:

- **`noindex`:** the page does not show up in Bing search, in Copilot or in grounding results.
- **`noarchive`:** keeps the content from being used in Copilot answers.
- **`nocache`:** Copilot can only use the URL, the title and the snippet, and citations come out thinner.
- **`nosnippet` and `data-nosnippet`:** Bing shows no snippet and the citation in Copilot may come out worse.

This is going to change. On October 30, 2026 Bing [announced new preferences](https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/) that take effect on February 1, 2027. The one for use in answers is set page by page, with `<meta name="Bingbot" content="ai-grounding:disallow">` or with the header `X-Robots-Tag: Bingbot: ai-grounding:disallow`, and the training one goes in robots.txt under the user-agent `__usage_ai-training`. If you set nothing, both stay allowed, and neither one changes your eligibility in regular Bing results. After March 1, 2027, Bing stops reading `noarchive` and `nocache` as AI preferences, so if you use them today to hold Copilot back, the announcement explains how to record a temporary preference in Bing Webmaster Tools starting December 15, 2026.

If what you want is to show up, check that none of these tags are on the pages you want Copilot to cite, because sometimes a plugin or the site template adds them.

## How do I see whether Copilot cites me?

In the AI Performance report in Bing Webmaster Tools, which counts citations in Copilot, in AI-generated summaries in Bing and in some partner integrations. What it shows:

- **Total citations:** how many times your content appeared as a source in an answer. It does not say where in the answer it appeared.
- **Average cited pages:** how many different pages from your site get cited per day.
- **Grounding queries:** a sample of the phrases the AI used to retrieve the content it then cited.
- **Citations per page:** how many times each URL gets cited, plus a timeline to see how it changes.

Bing recommends using it to see which pages get cited, which ones show up often and which ones are indexed but rarely cited, since those are the first ones to improve. Its guidelines also warn that a page can appear in Copilot without anyone clicking, so a drop in clicks does not always mean you lost visibility.

## What does Peaje do for Copilot and what does it not do?

Peaje does not measure your citations in Copilot. It measures only ChatGPT and Claude, and for Copilot the place to look is Bing's AI Performance report. What it does:

- **The kit's robots.txt:** lets Bingbot in by name, along with Googlebot, OAI-SearchBot, PerplexityBot, Claude-SearchBot and Applebot.
- **Access check:** when Peaje generates your tasks, it visits your home page with Bingbot's user-agent and reads your robots.txt, and if either one blocks it, you get a task to fix it.
- **IndexNow when your prices change:** when you create, edit or delete a priced route or link, Peaje tells IndexNow that your `/developers` and your `/pricing.md` changed. The key lives at the root of your domain, at `/peaje-indexnow.txt`, and the notice only goes out if the key answers there, which happens when you have the kit's proxy installed.

What it does not do: it does not notify IndexNow about the rest of your pages, it does not register your site in Bing Webmaster Tools and it does not set grounding preferences on your pages. And it cannot promise that Copilot will cite you, because Bing does not promise that either. To start, the [free radar](https://usepeaje.com/radar) tells you in less than a minute what an agent can read on your site and whether ChatGPT and Claude already cite you.

## Sources

- [Bing: webmaster guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
- [Bing: AI Performance in Bing Webmaster Tools (February 10, 2026)](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)
- [Bing: preferences for training and grounding (October 30, 2026)](https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/)
- [Peaje free radar](https://usepeaje.com/radar)
