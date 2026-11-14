---
title: "¿Cuánta autoridad les dan los bancos a los agentes de IA?"
description: Por qué JPMorgan, Citi, Bank of America, Schwab y Wells Fargo limitaron a los agentes de IA externos, cómo Lead Bank, Cross River e Increase les dieron plata propia y qué significa para los sitios a los que les pagan los agentes.
date: 2026-11-13
slug: cuanta-autoridad-les-dan-los-bancos-a-los-agentes-de-ia
lang: es
categoria: Noticia
portada: 4
portada_titulo: Bancos y agentes de IA
traduccion: how-much-authority-are-banks-giving-ai-agents
---

# ¿Cuánta autoridad les dan los bancos a los agentes de IA?

En menos de un mes, los bancos de Estados Unidos se dividieron por una pregunta: cuando el agente de IA de un cliente llega a su cuenta, ¿cuánto puede hacer? Los bancos más grandes dijeron que un agente externo no puede mover plata desde adentro de la cuenta del cliente, y un grupo de bancos más chicos le dio al agente una cuenta o una tarjeta propia, con límites que pone el banco.

Actualizado: noviembre de 2026

Entre el 13 y el 16 de octubre de 2026, JPMorgan, Bank of America, Citi y Charles Schwab dijeron que limitan a los agentes externos, según [PYMNTS](https://www.pymnts.com/?p=4326961). El CEO de Schwab contó que cada semana bloquean entre una decena y una veintena de agentes no autorizados, entre ellos Muse, el de Meta.

## ¿Qué decidieron los bancos grandes?

Cada uno lo dijo a su manera, y los cuatro impiden que un agente externo mueva por su cuenta la plata del cliente:

| Banco | Qué dijo | Qué puede hacer todavía un agente |
| --- | --- | --- |
| JPMorgan | Los agentes no pueden enviar plata ni pagar cuentas (Jamie Dimon, llamada de resultados del 13 de octubre) | Ver saldos, si el cliente autoriza un conector como Plaid |
| Bank of America | Limita el acceso de los agentes a los depósitos y exige que una persona apruebe la plata que sale de una cuenta (Brian Moynihan, 14 de octubre) | El banco dice que está armando reglas para cómo los agentes pueden usar las cuentas |
| Citi | Los agentes de terceros no pueden entrar a la cuenta de un cliente | Proveedores de banca abierta autorizados pueden leer los datos de la cuenta, solo lectura |
| Charles Schwab | Bloquea a los agentes no autorizados y quiere que sus clientes usen su propio asistente, Charley, en lugar de darle su clave a otro | Va a crear servidores MCP para que el modelo que elija el cliente consulte saldos e investigue con las reglas de Schwab |

Wells Fargo fue un paso más allá con su contrato. Desde el 24 de noviembre, el cliente sigue siendo responsable de lo que haga su agente de IA, aunque le haya dicho que pare, salvo que pueda probar que le quitó el acceso, según [American Banker](https://www.americanbanker.com/news/wells-fargo-wants-customers-to-prove-theyve-revoked-ai-agents) del 2 de noviembre.

## ¿Cómo les dieron plata propia los bancos más chicos?

Los bancos que dijeron que sí no les abrieron a los agentes la cuenta del cliente. Le dieron a cada agente, o a cada tarea, una cuenta o una tarjeta aparte, así que lo máximo que un agente puede gastar es lo que se puso ahí.

| Banco | Qué recibe el agente | Dónde está el límite |
| --- | --- | --- |
| [Lead Bank](https://www.lead.bank/blog/moving-money-with-agents) | Un número de cuenta propio para cada tarea, que solo le paga a contrapartes aprobadas | Límites diarios y mensuales del programa y el saldo, que el banco revisa en tiempo real; el número de cuenta se cancela cuando termina la tarea |
| [Cross River](https://www.crossriver.com/newsroom/cross-river-expands-stripe-issuing-partnership-to-help-power-agentic-commerce) | Por la wallet de agentes de Link, de Stripe, una tarjeta virtual de un solo uso para cada compra | La tarjeta sirve para una sola transacción, y el agente nunca ve los datos de pago del cliente |
| [Increase](https://www.thespl.it/p/why-stripes-1st-employee-just-bought) | Su fundador, Darragh Buckley, cuenta que sus agentes tienen su propia cuenta bancaria | El saldo: los agentes gastan lo que hay en la cuenta y le piden más |

Las fintech también se están moviendo. El 5 de noviembre, [American Banker](https://www.americanbanker.com/payments/news/chime-puts-out-the-welcome-mat-for-external-ai-agents) contó que Chime se prepara para que sus clientes conecten su propio agente, además de Jade, su asistente interno.

Los tres bancos tienen algo en común: todos llegan a Stripe. Cross River impulsa la emisión de tarjetas de Stripe para agentes, Lead Bank [emite la tarjeta prepago de Link](https://stripe.com/legal/consumer/cardholder-agreements), e Increase la fundó en 2020 Buckley, el primer empleado de Stripe, que después compró un banco chico del estado de Washington y lo llamó Increase Bank. Por ahora, la capa que les da plata a los agentes en Estados Unidos se está armando sobre todo alrededor de una empresa y de los bancos que trabajan con ella.

## ¿En qué coinciden los dos bandos?

Leídos uno al lado del otro, los dos bandos van hacia la misma regla: un agente solo puede tocar plata con una autoridad que tiene límite, se puede quitar y deja rastro.

- **Con límite:** un presupuesto, una lista de contrapartes o una tarjeta de un solo uso acota lo que puede salir mal, y lo hace cumplir el banco, fuera del prompt del agente.
- **Revocable:** la cuenta o la tarjeta se puede cerrar cuando termina la tarea, sin cambiar la clave del cliente.
- **Con rastro:** cada pago sale de una credencial atada a un solo agente, así que el registro muestra qué agente hizo qué.

Los bancos grandes siguen dejando que un agente lea saldos con permiso del cliente. Lo que frenaron es que un agente entre a la cuenta con las credenciales del cliente y mueva plata desde ahí, y los bancos más chicos sacaron primero la alternativa.

## ¿Qué significa para los sitios a los que les pagan los agentes?

Un agente con presupuesto propio es el tipo de comprador que puede [pagarle a un sitio por cada pedido](https://usepeaje.com/blog/como-le-paga-un-agente-de-ia-a-mi-sitio-y-donde-recibo-el-pago). Con una clave compartida eso nunca sería seguro, y con una tarjeta no sale barato: el [cobro mínimo](https://docs.stripe.com/currencies) de Stripe en dólares es de US$0,50, más de lo que vale la mayoría de los pedidos sueltos. Una cuenta con [stablecoins como USDC](https://usepeaje.com/blog/por-que-los-agentes-de-ia-pagan-con-stablecoins-como-usdc) puede pagar unos centavos por pedido.

Ese es el lado para el que construimos Peaje. Antes de pagarle a un sitio, un agente tiene que encontrarlo y leerlo, y Peaje prepara el sitio para las dos cosas. Si el negocio prende los cobros, una ruta con precio en su propio dominio responde `402 Payment Required` con una oferta en [x402](https://usepeaje.com/blog/que-es-x402-y-como-funciona-el-pago-de-un-agente-de-ia-con-http-402) y en [MPP](https://usepeaje.com/blog/que-es-mpp-el-protocolo-de-pagos-de-stripe-y-tempo-para-agentes-de-ia). El agente paga en USDC en Arbitrum o en pathUSD en Tempo y recibe lo que pidió.

- El 98% de cada pago llega a la wallet del negocio en la misma transacción, y [Peaje se queda con el 2%](https://usepeaje.com/blog/cuanto-se-queda-peaje-de-cada-pago-de-un-agente-de-ia). Peaje no guarda saldos.
- En Arbitrum, si el sitio del negocio falla, el agente no paga, porque Peaje le pide la respuesta al sitio antes de cobrar.
- En Tempo el agente ya pagó, así que si el sitio falla Peaje le devuelve el pago de su propia cuenta, con topes.

Todavía es temprano. Los pagos de agentes en la web abierta siguen siendo chicos, y hoy lo que más decide si un agente usa un sitio es [si lo puede encontrar y leer](https://usepeaje.com/blog/hay-una-herramienta-gratis-para-ver-si-la-ia-lee-mi-web). Por eso Peaje empieza por ahí y deja los cobros como una decisión de cada negocio. Puedes ver qué encuentra un agente en tu sitio con el [radar gratis](https://usepeaje.com/radar): solo pide tu email y tu dominio, y tarda menos de un minuto.

## Fuentes

- [PYMNTS: los bancos grandes no dejan que los agentes de IA externos muevan plata](https://www.pymnts.com/?p=4326961), 19 de octubre de 2026
- [American Banker: Wells Fargo quiere que sus clientes prueben que revocaron a sus agentes de IA](https://www.americanbanker.com/news/wells-fargo-wants-customers-to-prove-theyve-revoked-ai-agents), 2 de noviembre de 2026
- [Lead Bank: mover plata con agentes](https://www.lead.bank/blog/moving-money-with-agents), 29 de septiembre de 2026
- [Cross River amplía su alianza con Stripe Issuing para el comercio con agentes](https://www.crossriver.com/newsroom/cross-river-expands-stripe-issuing-partnership-to-help-power-agentic-commerce), 1 de julio de 2026
- [The Split: por qué el primer empleado de Stripe compró un banco](https://www.thespl.it/p/why-stripes-1st-employee-just-bought), entrevista con Darragh Buckley, 15 de octubre de 2026
- [American Banker: Chime les abre la puerta a los agentes de IA externos](https://www.americanbanker.com/payments/news/chime-puts-out-the-welcome-mat-for-external-ai-agents), 5 de noviembre de 2026
- [Stripe: contratos de tarjetahabiente (tarjeta prepago de Link, Lead Bank)](https://stripe.com/legal/consumer/cardholder-agreements)
- [Stripe: montos mínimos de cobro por moneda](https://docs.stripe.com/currencies)
- [Radar gratis de Peaje](https://usepeaje.com/radar)
