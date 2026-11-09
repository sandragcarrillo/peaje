---
title: "What is ERC-8004 and what is the AI agent registry for?"
description: What ERC-8004 is, who proposed it, how its identity, reputation and validation registries work, and what it offers a business that wants AI agents to find it and pay it.
date: 2026-11-07
slug: what-is-erc-8004-and-what-is-the-ai-agent-registry-for
lang: en
categoria: Guide
portada: 1
portada_titulo: What is ERC-8004
traduccion: que-es-erc-8004-y-para-que-sirve-el-registro-de-agentes-de-ia
---

# What is ERC-8004 and what is the AI agent registry for?

ERC-8004 is a proposed Ethereum standard that gives AI agents a public identity on the blockchain, with a history of reviews and checks that anyone can read. It is called "Trustless Agents", it was created on August 13, 2025 and it is still a draft. It works through three registries: one for identity, one for reputation and one for validation.

Updated: November 2026

According to the [official contracts repository](https://github.com/erc-8004/erc-8004-contracts), the identity and reputation registries are already deployed on 25 main networks, including Ethereum, Base, Arbitrum and Polygon, at the same address on all of them. The validation registry has no published address yet, because that part of the specification is still under discussion.

## Who proposed ERC-8004?

The proposal is published at [eips.ethereum.org](https://eips.ethereum.org/EIPS/eip-8004) and lists four authors: Marco De Rossi (with a MetaMask handle), Davide Crapis (with an ethereum.org email), Jordan Ellis (with a Google email) and Erik Reppel (with a Coinbase email). It is a Standards Track proposal in the ERC category, and the public discussion lives on the Ethereum Magicians forum. Being a draft means it can still change.

It starts from a gap the proposal itself describes: protocols like MCP and A2A say how to talk to an agent, but not how to find one or how to decide whether to trust it when you have never dealt with it.

## What does each of the three registries do?

| Registry | What it stores | Who writes to it |
| --- | --- | --- |
| Identity | A number per agent (an ERC-721 token) that points to a file with its name, description and services | The agent's owner |
| Reputation | Reviews with a numeric value and optional tags | Any client, except the agent's owner or whoever manages it |
| Validation | Requests to verify a piece of work and the validator's answer, from 0 to 100 | The owner requests and the validator answers |

The registration file is a JSON document that can list several services at once: a website, an MCP server, an A2A agent card, an ENS name, an email address. It also says whether the agent accepts x402 payments (`x402Support`) and whether it is active (`active`). The wallet where the agent receives payments goes in a reserved field, `agentWallet`, and changing it requires a signature from the new wallet. If the agent changes owners, that wallet is cleared and the new owner has to set it again.

## Does ERC-8004 handle payments?

No, the proposal says payments are outside its scope. What it does is record where to pay you (`agentWallet`) and whether you accept x402, and it shows how x402 payment proofs can add context to reviews. The payment itself goes through a payment protocol like x402 or MPP, which we compare in [x402 vs MPP](https://usepeaje.com/blog/x402-vs-mpp-which-payment-protocol-for-ai-agents-should-i-use).

## What does it do for my business?

If you sell something agents consume, like an API, data or a tool, registering puts you on a public list that buying agents can walk through and filter by what each service does, whether it accepts payments and what reviews it has. Your clients leave the reviews, and since the owner cannot review itself, they say more than a testimonials page. Before you register, keep three things in mind:

- **Only agents that check the registry will find you there.** The rest keep finding you through your site and through files like llms.txt, openapi.json or your [agent card](https://usepeaje.com/blog/what-is-an-agent-card-and-what-is-it-for-on-my-site), which we cover in [how AI agents find my API](https://usepeaje.com/blog/how-do-ai-agents-find-my-api).
- **Reputation can be inflated.** The proposal acknowledges that someone can create fake agents to push up another agent's score, so a high average says little unless you look at who left each review.
- **Registering is a transaction.** You pay gas on the network you choose and the identity belongs to a wallet, which you have to protect like any other.

## Does Peaje use ERC-8004?

Peaje reads it, but it does not register your business on it. The mystery shopper in the Pro plan, a test buying agent that looks for your business the way real agents would, searches three sources: the Peaje directory, the x402 Bazaar and the ERC-8004 registry, which it reads on Ethereum, Base and Polygon (plus one test network) through Agent0's indexes on The Graph. Then it records whether it found you, in what position and who it picked instead.

Peaje does not create your identity on the registry or publish your registration file, and the kit does not serve `/.well-known/agent-registration.json`. If you want to be listed, you register with your own wallet, and your file can point to what the kit already puts on your domain: the agent card at `/.well-known/agent-card.json`, the MCP server at `/mcp` and your priced routes, which answer 402 with x402 and MPP offers once you turn payments on.

If you do not know yet what an agent sees when it reaches your site, the [free radar](https://usepeaje.com/radar) tells you in less than a minute.

## Sources

- [ERC-8004: Trustless Agents, at eips.ethereum.org](https://eips.ethereum.org/EIPS/eip-8004)
- [Official ERC-8004 contracts on GitHub](https://github.com/erc-8004/erc-8004-contracts)
- [ERC-8004 discussion on Ethereum Magicians](https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098)
- [Peaje pricing](https://usepeaje.com/precios)
