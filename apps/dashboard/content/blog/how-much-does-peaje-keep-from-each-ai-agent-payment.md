---
title: "How much does Peaje keep from each AI agent payment?"
description: Peaje's exact fee on AI agent payments, how much reaches you with examples, who pays the network cost, which currencies are used and why it is separate from the Pro subscription.
date: 2026-11-05
slug: how-much-does-peaje-keep-from-each-ai-agent-payment
lang: en
categoria: Guide
portada: 2
portada_titulo: Peaje's 2%
traduccion: cuanto-se-queda-peaje-de-cada-pago-de-un-agente-de-ia
---

# How much does Peaje keep from each AI agent payment?

Peaje keeps 2% of each payment an AI agent makes to you, and 98% reaches your business wallet in the same transaction. There is no monthly fee for charging and no minimum amount, and if you charge nothing, you pay no fee. Putting a price on your routes and links is free on every plan.

Updated: November 2026

**Fee: 2% per payment.** It is on the [pricing page](https://usepeaje.com/precios), and on Arbitrum it is fixed in the code of the [contract that splits each payment](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020), which is public and verified.

## How much reaches me from each payment?

| Route price | Peaje's fee (2%) | You receive |
| --- | --- | --- |
| US$0.01 | US$0.0002 | US$0.0098 |
| US$0.05 | US$0.001 | US$0.049 |
| US$0.25 | US$0.005 | US$0.245 |
| US$1 | US$0.02 | US$0.98 |
| US$10 | US$0.20 | US$9.80 |

On Arbitrum, when 2% does not come out to an exact figure, the contract rounds in your favor. Prices accept up to 6 decimals.

## Who pays the network cost?

The agent, on top of the price, so it does not come out of your 98%:

- **USDC on Arbitrum.** The agent adds the network cost to the price, which today is around one cent and never goes over US$0.02. Peaje uses that to pay the transaction's gas.
- **pathUSD on Tempo.** The agent pays the gas in its own transaction, which carries two transfers: yours and Peaje's 2%.

## Does Peaje hold my money at any point?

No, the payment is split in the same transaction in which the agent pays, and the Arbitrum contract holds no balances. The money lands in the wallet Peaje created for your business when you registered, which is yours, only works with your session and Peaje cannot move on its own. Since there is no balance at Peaje, there is nothing to withdraw either. In Revenue you see each payment with the date, the route, the network, what reached you and a link to the transaction.

## Is the 2% separate from the Pro subscription?

Yes, they are two separate charges. Pro costs US$30 a month for the first 50 businesses and US$69 after that, and you pay it by card through Paddle, which calculates your country's taxes. Agent payments do not go through Paddle or your subscription: they go straight to your wallet, minus 2%, whether you are on the free plan or Pro.

## When do I start paying the fee?

When an agent pays you for the first time. Payments start turned off, and while they are off, agents use your priced routes and links for free and there is nothing to take a fee from. You turn them on in Revenue with "Turn on payments" and turn them off from the same place. How to create a priced route is in [how does an AI agent pay my website](https://usepeaje.com/blog/how-does-an-ai-agent-pay-my-website-and-where-does-the-money-go), and what is worth charging for, in [which API routes should I charge for](https://usepeaje.com/blog/which-api-routes-should-i-charge-for-and-which-should-i-leave-free).

## Sources

- [Peaje pricing](https://usepeaje.com/precios)
- [Peaje's contract on Arbiscan](https://arbiscan.io/address/0x2339369b423902281bf5c81d53ad1b59fd452020)
- [Peaje: how it works and FAQ](https://usepeaje.com/)
