# Revisión de producto (1 oct 2026)

Tres investigaciones en paralelo: mercado y comprador de AEO, pagos con tarjeta para agentes y Paddle, y auditoría interna de promesas vs. código. Fuentes en los informes originales (sesión del 1 oct); aquí el resumen y la recomendación.

## Veredicto

Peaje son dos medios productos con una billetera compartida que solo existe en testnet.

- **402 para agentes:** técnicamente excelente, comercialmente vacío. Todo el comercio agéntico medido en x402 (TRM Labs) corre a US$5.000 a 11.000 al mes para el protocolo entero; el 2% de todo eso son menos de US$250. Comercio x402 mediano: US$0,06 en 30 días; 80% gana menos de US$1. Esta semana Cloudflare (Monetization Gateway, sin código) y Stripe (MPP con tarjetas, cae en el saldo de Stripe) sacaron las versiones sin código y en fiat de lo que Peaje vende. Estructural, no se arregla con onboarding.
- **AEO Pro:** el mercado existe (Profound US$180 M, Peec US$15 M ARR, cargos con título) pero Peaje está apuntado mal: único competidor que exige instalar npm y proxy; solo se paga en USDC; US$29 con US$15 a 24 de costo de API (margen 17 a 35%, Founder negativo); medición de una muestra semanal que es ruido por un mes; Perplexity cuenta `search_results` como citas. Cloudflare y Bing regalan los chequeos. RadarKit (US$29/79, agente de contenido, MCP para Claude Code y Cursor) ya hace lo más parecido.
- **Lo que sí es raro y bueno:** tareas que ejecuta el coding agent del dueño por MCP, verificación en vivo contra criterios, remedición a 2 y 6 semanas con veredicto en español; chequeo de acceso por bot (entrenan vs. responden); la prueba estricta de 402 en el dominio con atribución dueño/Peaje; el gateway multi-riel y el contrato.

## Promesas que hoy son falsas o engañosas
- "Sin tocar tu código": el CLI reescribe `next.config`, inserta `PeajeHead`, cada tarea pide `npx` y deploy.
- "Retira cuando quieras": plata de testnet, sin aviso.
- "Comprador misterioso busca como agentes reales": busca con el matcher de Peaje en el directorio de Peaje.
- "Que te recomienden": Peaje cubre condiciones necesarias (acceso, fechas, estructura) y ninguna suficiente (menciones de terceros, 84% de las citas; Bing).

## Tarjetas y Paddle
- **Agentes pagando por request con tarjeta: no existe.** Stripe tiene mínimo US$0,50 por cargo; a US$0,05 la comisión es 600%. Visa, Mastercard AP4M, PayPal, AP2: compras de productos o pilotos. Lo que todos hacen: saldo prepagado cargado con tarjeta y gastado por request (OpenRouter, Nevermined, Skyfire).
- **MPP ya tiene método `stripe` (SPT) y `mppx@0.8.19` ya lo exporta.** Medio día de código para ofrecer tarjeta en el 402 para montos >= US$0,50. Bloqueo: Stripe no acepta vendedores en Colombia; haría falta entidad en EE. UU. (Atlas).
- **Paddle para Pro: sí.** Colombia aceptada, impuestos resueltos, 5% + US$0,50 (6,7% sobre US$29), payout en USD. Riesgo: revisión de dominio ve un producto de pagos/cripto; presentar Pro como SaaS. Alternativa: Polar (4% + US$0,40). Integración: suscripción Paddle + webhook a `activar(tenant, 'pro', …, 'paddle', id)` en `billing/router.ts`, 1 a 2 días.
- **Paddle para que agentes paguen a negocios: no.** AUP prohíbe facilitación de pagos, marketplaces y saldo almacenado; no tiene payouts a terceros.
- **Saldo cargado con tarjeta para agentes:** solo Stripe Connect (entidad en EE. UU.; payouts cross-border a Colombia desde marzo 2026), o enchufar Nevermined/Skyfire.
- IVA: software vendido al exterior es exportación de servicios exenta (Art. 481); contador igual.

## Economía (Python, no de cabeza)
| Escenario | Costo API/mes | Margen sobre US$29 |
|---|---|---|
| Como está (20 preguntas semanales, gpt-5.5, Opus, chat) | US$24,17 | 17% |
| Founder US$19 | US$22 | negativo |
| 10 preguntas, quincenal, modelo barato | US$11,06 | 62% |
Cada registro cuesta ~US$11 de prueba gratis. El 2% necesita 145.000 requests pagados al mes por negocio para igualar una suscripción.

## Versión enfocada que recomiendan las tres
Un producto: **el agente de AEO para sitios construidos con coding agents** (Claude Code, Cursor, Lovable, v0), en español, por Telegram.
- Mantener: medición (honesta sobre varianza, quincenal o mensual), plan por objetivo, borradores completos, tareas por MCP y CLI, verificación en vivo, remedición 2/6 semanas, acceso de bots e indexación en Bing, monitor diario, Telegram, "quién aparece en tu lugar".
- Sacar del titular: 402, rieles, contrato, 2%, retiros, comprador en Bazaar/ERC-8004, UCP/ACP/AP2, Ora como titular, llms.txt/JSON-LD como valor. Guardar el código. Si un cliente quiere vender a agentes, generar el handler de Stripe MPP como una tarea.
- Kit: de "instala Peaje" a "arreglos que Peaje propone y tu coding agent aplica". Sin proxy ni secreto en el camino por defecto.
- Precio: US$49 a 79 con tarjeta (Paddle), un plan para agencias LATAM (5 a 10 sitios, informe en español con su marca). Founder US$19 se va.

## Antes de construir: 10 conversaciones
4 founders dev con sitio vivo, 3 agencias LATAM de SEO/marketing, 3 registrados en Peaje. Preguntas clave: "¿cuándo revisaste si ChatGPT te menciona y qué hiciste?", "si te dejo la página como tarea en Claude Code, ¿la corres esta semana?", "¿pagarías US$49 por 10 preguntas medidas, una página escrita por semana, la tarea en tu coding agent y un veredicto en 6 semanas?", "¿tarjeta o USDC?", "¿instalarías un npm y un proxy para esto?", "¿algún agente ha pedido algo a tu sitio que cobrarías?". Regla: si 4 de 7 no-agencias confirman las dos del medio, se construye la versión enfocada; si 3+ describen pedidos reales de agentes, el 402 queda como add-on; si ninguna, Peaje es una feature de un producto para agencias.

## Hackathons
Arbitrum (3 oct) y Colosseum (12 oct) se entregan igual con el 402: es lo que funciona y está probado con pagos reales en testnet. La decisión de producto es para después del 4.
