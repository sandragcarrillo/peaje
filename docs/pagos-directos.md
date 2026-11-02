# Pagos directos: el gateway sobre PeajeSettlementV3

Octubre 2026. Cada pago llega a la wallet de cobro del negocio en la misma transacción, en todas las redes: Tempo con el split nativo de mppx y Arbitrum (USDC y USDG), Robinhood y Arc con PeajeSettlementV3 (98% al negocio, 2% más el costo de red al fee recipient del contrato). Peaje no guarda saldos de negocios y no hay retiros. Contrato y modelo de seguridad: `docs/contrato-v3.md`. Wallet del dueño: `docs/privy-migracion.md`.

## Qué cambió en el producto

| Antes | Ahora |
|---|---|
| Arbitrum, Robinhood y Arc liquidaban en v2: el neto quedaba en `claimable` y el dueño retiraba. | v3 reparte en `settle`: el neto llega a `payoutWallet` en la misma tx. |
| Sin wallet de cobro, Tempo cobraba a la treasury (custodial) y v3 caía al relayer. | Sin wallet de cobro no hay ninguna oferta: la ruta responde 503 `no-payout-address` con el link para ponerla. |
| Circle Nanopayments (gateway-arbitrum, gateway-arc) en el 402. | Apagado (`CIRCLE_NANOPAYMENTS_ENABLED`): junta los pagos en la treasury y obliga a retirar. |
| La treasury firmaba `settle`. | `RELAYER_PRIVATE_KEY`, una EOA aparte con solo gas. La treasury sigue firmando lo suyo (relayar el barrido de un agente). El fee recipient lo fija el contrato. |
| Origen caído = reembolso desde el contrato o la treasury. | En v3 se liquida después del origen (abajo). En Tempo la treasury le devuelve al agente lo que pagó, con topes. Con el origen caído varias veces seguidas el negocio deja de ofrecer el 402 un rato. |
| Dashboard: Retirar, saldo disponible, enviar desde la wallet, fondear agentes desde el saldo, pagar el plan con saldo. | Ingresos (`/t/<slug>/ingresos`): cada pago con su tx, el neto y la dirección a la que llegó. `/retirar` redirige ahí. Los agentes se fondean mandando fondos a su dirección. |

## Liquidar después del origen (regla de reembolsos)

Con pagos directos Peaje no puede devolver plata que ya está en la wallet del negocio. En los rieles de contrato el pago se envía solo si el origen respondió bien:

1. mppx verifica la credencial (firma, monto, destino, vencimiento) y llama al settle del gateway.
2. `liquidacion-v3.ts` lee `authorizationState` y el saldo del pagador, y simula `settle` con `eth_call` desde el relayer (firma, tope de costo de red, merchant válido, pausa).
3. Se llama al origen (o a la URL del link). Si falla o responde 5xx, la tx no se envía: el agente recibe la respuesta del origen con `x-peaje-payment: not-charged` (o un 502 propio si el origen no respondió) y la autorización vence sin usarse.
4. Con el origen bien, se envía la tx, se espera el receipt y la respuesta sale sellada con el `Payment-Receipt`.

Va igual por HTTP (`cobrar.ts`) y MCP (`mcp.ts`). Lo que no cubre:

- Tempo: el agente paga al verificar la credencial (mppx lo hace en un paso), antes del origen. Ver "Reembolsos de Tempo" abajo.
- Si la tx falla después de que el origen respondió (revert raro), el agente no paga y no recibe el contenido (502 `settlement-failed-not-charged`), pero el origen ya procesó el pedido.

## Reembolsos de Tempo

Si un pago de Tempo ya pasó (el neto llegó a la wallet del negocio por el split) y el origen falla (5xx o sin respuesta), la treasury le devuelve al agente lo que pagó entero (neto + 2%), en pathUSD, y el pago queda con `refundTx` en el ledger (header `Payment-Refund` en la respuesta). El negocio se queda con su neto: lo paga Peaje (`reembolsos.ts`).

| Tope | Variable | Por defecto |
|---|---|---|
| Por pago (más que eso no se devuelve) | `TEMPO_REFUND_MAX_USD` | 1.00 |
| Por negocio por día (UTC) | `TEMPO_REFUND_DAILY_USD` | 5.00 |
| Global por día (UTC) | `TEMPO_REFUND_GLOBAL_DAILY_USD` | 20.00 |

Un tope que bloquea queda en el log como `[refund] TOPE …` con el pago y lo ya devuelto en el día; ese pago se resuelve a mano. Los reembolsos van en fila (uno a la vez) para que dos fallos simultáneos no pasen juntos un tope. Lo devuelto en el día se cuenta por la fecha del pago (el reembolso sale segundos después). En la vista de ingresos esos pagos salen como "reembolsado" y, como el ledger los saca del total, el total recibido queda por debajo de lo que de verdad llegó a la wallet del negocio.

## Corte por origen caído

Si el origen de un negocio falla (5xx o sin respuesta) N veces en M minutos, el gateway deja de ofrecer el 402 para ese negocio, en todos los rieles, durante un enfriamiento: responde 503 `origin-paused` con `retry-after` y no cobra nada (`cortacircuito.ts`). Cuenta los fallos de HTTP y de MCP. Al cortarse avisa al dueño una vez por enfriamiento por Telegram (si lo conectó) y por correo (si el gateway tiene `RESEND_API_KEY` y `AGENTS_FROM_EMAIL`). Al terminar el enfriamiento la cuenta vuelve a cero.

| Variable | Por defecto |
|---|---|
| `ORIGIN_BREAKER_FAILURES` | 3 |
| `ORIGIN_BREAKER_WINDOW_MINUTES` | 10 |
| `ORIGIN_BREAKER_COOLDOWN_MINUTES` | 15 |

El estado vive en la memoria del proceso del gateway: un reinicio lo borra.

## Pagos adelantados (front-run)

Si alguien manda la autorización del agente directo al token antes que el relayer, los fondos quedan en el contrato sin repartir. El gateway lo prueba con tres chequeos: la autorización está usada en el token, el saldo del contrato cubre el monto y no hay ningún `PaymentSettled` de ese nonce en las últimas dos horas (la credencial vence en minutos). Con la prueba:

- guarda una fila en `settlement_strays` (única por contrato, token, pagador y nonce), lo anota en el log como `PAGO ADELANTADO` y no barre nada;
- si esta llamada creó la fila, llama al origen una vez y devuelve su respuesta con `x-peaje-payment: pending-split` (sin `Payment-Receipt`: no hubo tx de Peaje). Si el origen falla en ese intento no hay otro;
- un segundo intento con la misma autorización no se sirve: 409 `authorization-front-run`.

Sin la prueba (ya hay `PaymentSettled`, el contrato no la cubre o no se pudieron leer los eventos), no se registra ni se sirve: 409 `authorization-used` con `x-peaje-payment: not-verified`. Si la tabla de adelantos no existe todavía (migración sin aplicar), tampoco se sirve: sin la fila no hay forma de garantizar una sola vez.

El pago adelantado no entra al ledger del negocio hasta que se reparte: queda en `settlement_strays`.

- `GET /_internal/strays` (Bearer `INTERNAL_API_SECRET`): pendientes, cada uno con `settleStrayArgs` listos para el Safe: `settleStray(token, merchant, from, value, nonce, networkFee)`. `?status=settled` o `?status=all` para ver los demás.
- Antes de firmar, el Safe confirma que ese nonce no tiene un `PaymentSettled` (ver "Límite" en `docs/contrato-v3.md`).
- `POST /_internal/strays/<id>/settled {"tx": "0x…"}` marca la fila como repartida.

## Variables de entorno

Gateway (Railway):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_RED` | `testnet` (o sin poner) o `mainnet`, para todos los rieles a la vez. Mismo nombre en Vercel. Un valor distinto hace que el gateway no arranque. Reemplaza a `TEMPO_NETWORK`, que queda como respaldo. |
| `PEAJE_FEE_RECIPIENT` | Destino del 2% del split de Tempo. Obligatorio en mainnet y distinto de la treasury: la dirección fría, una EOA (un Safe de Arbitrum no existe en Tempo). En testnet, la treasury si falta. |
| `RELAYER_PRIVATE_KEY` | Llave de la EOA relayer (nueva, no la treasury; el gateway se niega a arrancar si es la misma). Solo gas nativo: ETH en Arbitrum Sepolia y Robinhood Testnet, USDC en Arc Testnet. |
| `PEAJE_SETTLEMENT_V3_ARBITRUM_SEPOLIA` | v3 en Arbitrum Sepolia. Sirve a los rieles USDC y USDG (mismo contrato). |
| `PEAJE_SETTLEMENT_V3_ROBINHOOD_TESTNET` | v3 en Robinhood Chain Testnet (USDG). |
| `PEAJE_SETTLEMENT_V3_ARC_TESTNET` | v3 en Arc Testnet (USDC). |
| `PEAJE_SETTLEMENT_V3_ARBITRUM_ONE` | v3 en Arbitrum One, para USDC y USDG. Solo con `NEXT_PUBLIC_RED=mainnet`; en mainnet Robinhood y Arc no ofrecen nada. |
| `ARBITRUM_ONE_RPC_URL`, `TEMPO_RPC_URL` | RPC propios en mainnet (opcionales; el público de Arbitrum One limita pedidos). `ARBITRUM_ONE_RPC_URL` también en Vercel, para leer saldos. |
| `CIRCLE_NANOPAYMENTS_ENABLED` | Sin poner (apagado). `true` vuelve a ofrecer Circle, solo en testnet. |
| `ARBITRUM_SEPOLIA_RPC_URL`, `ROBINHOOD_TESTNET_RPC_URL`, `ARC_RPC_URL` | Opcionales; conviene un proveedor con más rate limit (el chequeo de adelantos usa `getLogs` en tramos de 10.000 bloques). |
| `TEMPO_REFUND_MAX_USD`, `TEMPO_REFUND_DAILY_USD`, `TEMPO_REFUND_GLOBAL_DAILY_USD` | Topes de reembolso de Tempo (1, 5 y 20 por defecto). La treasury necesita pathUSD en Tempo para pagarlos. |
| `ORIGIN_BREAKER_FAILURES`, `ORIGIN_BREAKER_WINDOW_MINUTES`, `ORIGIN_BREAKER_COOLDOWN_MINUTES` | Corte por origen caído (3 en 10 minutos, 15 de enfriamiento por defecto). |

Sin dirección v3 (o con `off`) esa red no aparece en el 402: no hay vuelta a v2. Con dirección, cada token sale en el 402 y en los documentos solo si el contrato lo acepta (`isAcceptedToken`, leído cada minuto): sumar o sacar un stablecoin es una transacción del Safe, sin tocar el env. Sin `RELAYER_PRIVATE_KEY` ninguna red de contrato aparece. `/health` muestra qué rieles están prendidos y `GET /_internal/treasury/balance` la address del relayer y el fee recipient de cada contrato (leído on-chain).

Dashboard (Vercel): `NEXT_PUBLIC_RED` igual que en Railway (cadenas, tokens, explorers y saldos del panel) y `ARBITRUM_ONE_RPC_URL` opcional. `PEAJE_SUBGRAPH_URL` opcional, cuando el subgraph de v3 esté publicado.

Prueba de mainnet sin plata: `FORK_ARBITRUM_ONE_RPC=<rpc de Arbitrum One> pnpm --filter @peaje/gateway exec tsx --test test/mainnet-fork.test.ts` levanta anvil sobre una copia de Arbitrum One, despliega v3 con el USDC y el USDG reales y paga uno de cada uno por el gateway en modo mainnet. Las cuentas del mnemónico de prueba de Foundry tienen una delegación EIP-7702 en Arbitrum One y el USDC de Circle (v2.2, ERC-1271) rechaza su firma: el pagador del test es una wallet nueva. Un agente real con cuenta EIP-7702 paga USDC solo si su delegado valida firmas por ERC-1271.

El ABI vive en `apps/gateway/src/abi/settlement-v3.ts`, copiado del artefacto: `cd contracts && forge build && pnpm --filter @peaje/gateway abi:v3`.

## Base de datos

Migración `supabase/migrations/20261025100000_pagos_directos.sql` (solo agrega):

- `payments.payout_address`: a qué dirección llegó el neto. Null en pagos viejos ("antes del pago directo" en la vista).
- `settlement_strays`: pagos adelantados para el Safe.

`withdrawals`, `crear_retiro` y las vistas de saldo quedan como historial; el gateway ya no escribe retiros. Aplicarla antes del deploy. Si se olvida, los pagos se graban sin la dirección y los adelantos quedan solo en el log (con todos los datos de `settleStray`), con un aviso en cada caso.

## Corte, en orden (junto con el de Privy)

| # | Paso |
|---|---|
| 1 | Deploy de v3 en arbitrum-sepolia, robinhood-testnet y arc-testnet con la wallet de San como owner (`ALLOW_EOA_OWNER=true` en Arbitrum Sepolia, o un Safe), un relayer nuevo por red (o el mismo en las tres) y un fee recipient frío. Comandos en `docs/contrato-v3.md`. Verificar `isRelayer(relayer)`, `feeRecipient()` y `maxNetworkFee(token)` con `cast call`. |
| 2 | Fondear el relayer con gas nativo en cada red. |
| 3 | Aplicar en Supabase `20261025000000_privy_app_propia.sql` (si falta) y `20261025100000_pagos_directos.sql`. |
| 4 | Revisar saldos viejos antes de cambiar nada: `select t.slug, b.network, b.available from tenant_network_balances b join tenants t on t.id = b.tenant_id where b.available > 0;` y el plan en seco de `scripts/privy-barrer.mts` (avisa si hay `claimable` en v2). Anotar lo que haya: después del corte no hay botón de retiro. |
| 5 | Railway: `RELAYER_PRIVATE_KEY`, `PEAJE_SETTLEMENT_V3_*`, y las variables de la app de Privy nueva. Vercel: las de Privy y `SESSION_SECRET` (`docs/privy-migracion.md`). |
| 6 | `scripts/privy-migracion.mts --apply` y en seguida el paso 7 (la migración de Privy pide que vayan juntos). |
| 7 | Commit, push y deploy del gateway (Railway) y del dashboard (Vercel). En el log del gateway: `PeajeSettlementV3: arbitrum, arbitrum-usdg, robinhood, arc · relayer 0x…`. |
| 8 | Barrido de Privy: `scripts/privy-barrer.mts` en seco y después `--apply`. |
| 9 | Saldos viejos del paso 4: lo que esté en la treasury (Tempo custodial, Arc antes del contrato, Circle) se manda a mano desde la treasury a la `payout_wallet` de cada negocio; lo que esté en `claimable` de v2 lo retira la cuenta dueña con `withdraw` (para las custodiadas viejas, firma la app de Privy vieja). No hay script con `--apply` para esto. |
| 10 | Prueba por riel en staging: un pago por token a una wallet de negocio (el neto aparece en Ingresos con su tx), una ruta con el origen en 5xx (no se cobra), un negocio sin dirección de cobro (503), un adelanto a mano (se sirve una vez con `pending-split`) y su `settleStray` desde el owner, un pago de Tempo con el origen caído (reembolso con `Payment-Refund`) y tres fallos seguidos del origen (503 `origin-paused` y aviso al dueño). Antes, fondear la treasury con pathUSD en Tempo para los reembolsos. |
| 11 | Subgraph: poner en `subgraph/subgraph.yaml` la dirección de v3 en Arbitrum Sepolia y su bloque, `npx graph codegen && npx graph build && npx graph deploy`, y `PEAJE_SUBGRAPH_URL` en Vercel. |

## Subgraph

`subgraph/` indexa v3: ABI nuevo (`abis/PeajeSettlementV3.json`), `PaymentSettled` con el neto del evento, `StraySettled` marca el pago repartido por el Safe, sin `Withdrawn`. La dirección y el `startBlock` quedan en cero hasta el deploy. El subgraph viejo de v2 sigue publicado con su historial.

## Archivos

Gateway: `liquidacion-v3.ts` (simulación, origen, envío, adelantos), `settlement.ts` (rieles, relayer, registro del adelanto), `cobrar.ts` y `cobro.ts` (ruta HTTP, sin dirección, no cobrado), `contexto.ts` (`prepararOrigen`), `methods.ts` (ofertas), `interno.ts` (ingresos, adelantos, treasury), `costoRed.ts` (170k de gas), `reembolsos.ts` (reembolsos de Tempo con topes), `cortacircuito.ts` (corte por origen caído). Dashboard: `app/t/[slug]/ingresos`, `lib/ingresos.ts`. Tests: `apps/gateway/test/pagos-directos.test.ts` (anvil con el contrato: ofertas, pago, origen caído, adelanto servido una vez, autorización usada sin prueba, corte), `apps/gateway/test/reembolsos-tempo.test.ts` (topes), `apps/dashboard/test/ingresos.test.ts`.
