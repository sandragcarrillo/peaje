# Revisión de seguridad: plata y blockchain (30 sep 2026)

Resumen del informe. Hallazgo 1 verificado a mano en el código.

## Hallazgos
1. **CRÍTICO. Cualquier usuario registrado puede vaciar cualquier wallet custodiada por Privy** (wallet de cobro de otro negocio, wallet de agente de otro). `guardarWallet` (`apps/dashboard/app/t/[slug]/actions.ts:58-66`) acepta cualquier 0x; `enviarFondos` (`:109-141`) firma desde `tenant.payoutWallet` resolviendo la wallet por address (`lib/privy.ts:52-59` `findMerchantWalletId`, sin chequear dueño). Igual en el gateway: `agents/wallet.ts:41-48` `privyAccountByAddress`, `settlement.ts:163-205` (retiro firma como payoutWallet), `saldos.ts:20-22` (disponible = claimable(payoutWallet)), `agents/router.ts:184-206`. La address de la víctima es pública (recipient en el 402 de Tempo, eventos PaymentSettled). Fix: guardar el `wallet_id` de Privy del negocio y del agente al crearlos y firmar solo con ese id; rechazar como payoutWallet una address custodiada que no sea del negocio; saldos y retiros desde la wallet custodiada guardada, no desde el payoutWallet editable.
2. **ALTO (confirmado). Saltarse el cobro cambiando mayúsculas o codificando el path.** Express: `/API/premium` responde 200 gratis; Hono: `/api/%70remium`. `packages/shared/src/kit/proxy-runtime.ts:64-76,145-160`, gateway `index.ts:581-586` + `router.ts:25-54`. Fix: normalizar (decodificar por segmento, colapsar barras, comparar sin mayúsculas) en gateway y runtime; enviar el secreto de origen solo en requests cobradas (mejor HMAC por request con método, path y timestamp).
3. **ALTO (confirmado). SSRF sin login y fuga del secreto de origen**: `GET /<slug>//attacker.example/x` hace que `new URL(path, originUrl)` (`proxy.ts:24`) apunte a attacker.example con `x-peaje-origin`. Con ese valor, acceso gratis permanente a las rutas del negocio; también lectura de `127.0.0.1` y `*.railway.internal`. Fix: rechazar paths con `//` o `\`, construir `originUrl + path` y exigir mismo origin.
4. **ALTO. Carrera en retiros, fondeo de agentes y pago con saldo** (rieles custodiales: tempo, gateway-arbitrum, gateway-arc): N requests simultáneas leen el mismo disponible y la tesorería paga N veces. `withdrawals.ts:62-83`, `agents/router.ts:190-206`, `billing/router.ts:181-204` (lock en memoria). Fix: débito atómico en Postgres (RPC con `FOR UPDATE` o advisory lock que inserta solo si alcanza).
5. MEDIO. Replay de credencial Tempo tras reinicio o con varias réplicas (`methods.ts:23-27` store en memoria); `recordPayment` (`supabase.ts:789-812`) sobrescribe tenant y monto en conflicto. Fix: store persistente, insert do-nothing, tenant y ruta en el challenge.
6. MEDIO. SSRF a URLs del negocio sin bloqueo de IPs privadas (`index.ts:304`, `mcp.ts:181,194`, `wellknown.ts:36`, `agents/entrega.ts:49`, `tareas/verificar.ts:25`, `leerSitemap`). Fix: resolver DNS y bloquear loopback, privadas, link-local e `*.internal`, en cada redirect.
7. BAJO-MEDIO. Timeout de settle (`settlement.ts:137`): puede cobrar sin servir ni registrar. Idempotencia por (from, nonce) y conciliación.
8. BAJO. `payment-signature` se reenvía al origin (`proxy.ts:5-11`). Quitar `payment-*` y `x-payment*`.
9. BAJO. Contrato: `transferWithAuthorization` permite griefing (usar `receiveWithAuthorization`); permits simultáneos del mismo dueño.
10. Endurecer: comparación de `INTERNAL_API_SECRET` no constante y reusado como llave de sesión; rate limit por `X-Forwarded-For` izquierdo; `BILLING_TEST_PRICE_USD` depende de `NODE_ENV` (Railway no lo define); `checkout_sessions/:id` ignora slug; rutas POST detrás del host reenviado siempre 402 (`index.ts:74`, spread de Request).

## Sólido
Binding de mppx (monto, moneda, recipient, chainId, splits); x402 `accepted` exacto; nonces EIP-3009; split de Tempo; contrato (nonReentrant, relayer-only, fee con tope, withdrawWithSignature); MCP del dueño; códigos de Telegram; rutas `/_internal`; refunds.

## Tests
forge 70/70 con invariantes; shared 27, next 11, cli 21, proxy 22. Gateway y dashboard sin tests.

## Estado (30 sep 2026)
- 1 corregido: `tenants.custodial_wallet` y `custodial_wallet_id` (migración 20261006000000, aplicada). Dashboard y gateway firman solo con el id guardado; `guardarWallet` rechaza wallets custodiadas ajenas; saldos de contrato se leen de la custodiada. Relleno de negocios existentes: `apps/gateway/scripts/backfill-custodia.mts` (acepta solo wallets creadas en el alta del negocio y no compartidas).
- 2 corregido: `segmentosCanonicos` en `@peaje/shared`, usado por el runtime y por `matchRoute` del gateway. Repros de Express y Hono ahora 402.
- 3 corregido: `proxy.ts` pega el path al origin como texto y exige mismo origin.
- 4 corregido: función `crear_retiro` (bloquea el negocio, relee disponible, inserta). Probado en la base: 5 retiros simultáneos de 0,5 con saldo 1,0, pasan 2.
- 5 parcial: `recordPayment` ya no pisa tenant ni monto. Falta store persistente de mppx para Tempo y atar challenge a tenant y ruta.
- 8 corregido: no se reenvían headers `payment-*` ni `x-payment*` al origin.
- Pendientes: 5 (resto), 6, 7, 9, 10.
