# Paddle Billing: suscripción Pro con tarjeta

Desde el 24 oct 2026 Peaje Pro se vende con tarjeta por Paddle Billing. Paddle es el Merchant of Record: cobra, calcula y declara impuestos, emite la factura y atiende reembolsos. El cobro de Pro en USDC (402 de `/_billing` y pago con saldo) queda en el código detrás de `BILLING_CRYPTO_ENABLED`, apagado por defecto. Los pagos de agentes a las rutas de los negocios (402) no cambian.

## Cómo funciona

1. **Checkout** (`apps/dashboard/app/t/[slug]/agente/suscripcion.tsx`). En Mi agente, sección Plan, el dueño toca "Suscribirme a Founder" o "Suscribirme a Pro". Paddle.js abre el checkout overlay con el precio del plan, el correo del dueño y `customData: { tenantId, slug, plan }`. Founder solo aparece si el gateway dice que hay cupo (`founderDisponible`). Con una suscripción viva (active, past_due) no se ofrece otro checkout.
2. **Webhook** (`apps/gateway/src/billing/paddle.ts`, `POST /paddle/webhook`). Verifica `Paddle-Signature` (HMAC-SHA256 de `ts:cuerpo` con el secreto del destino, 5 s de tolerancia, acepta varios `h1` durante la rotación del secreto), descarta eventos repetidos por `event_id` (tabla `paddle_events`) y:
   - `transaction.completed`: registra el cobro en `billing_payments` (method `paddle`, referencia `txn_...`, `subscription_ref` `sub_...`) y pone `plan_until` en `billing_period.ends_at`. El plan sale del precio cobrado, no de `customData.plan`. Si llega un founder sin cupo, se honra (el cliente pagó) y queda en el log `[paddle] cobro founder sin cupo disponible`.
   - `subscription.*`: guarda en el negocio `paddle_customer_id`, `paddle_subscription_id`, `paddle_status` y `paddle_cancel_at` (cancelación programada). Cancelar en el portal deja la suscripción `active` con fin programado: Pro sigue hasta el fin del período. Cuando llega `subscription.canceled` (o `paused`), Pro termina en `canceled_at`.
   - `adjustment.created` / `adjustment.updated`: un reembolso completo **aprobado** del primer cobro de la suscripción, o un contracargo, termina el plan (pasa a gratis). Reembolsos parciales o de renovaciones quedan marcados en el ledger y el plan sigue.
   - Eventos de otros productos de la misma cuenta de Paddle (precios que no son `PADDLE_PRICE_FOUNDER` ni `PADDLE_PRICE_PRO`, o sin `tenantId`) se ignoran con 200.
3. **Gestionar suscripción**. El botón llama a la server action `abrirPortal` → `POST /_internal/:slug/billing/portal` en el gateway → `POST /customers/{ctm}/portal-sessions` en Paddle. El link es de un solo uso: se crea en cada clic. El cliente de Paddle sale del negocio, nunca del navegador.
4. **Link de pago por defecto** (`apps/dashboard/app/checkout`). `https://usepeaje.com/checkout` abre el checkout de `?_ptxn=` que Paddle manda en sus correos (actualizar tarjeta, reintentar un cobro). Paddle lo exige para aprobar el dominio.

## Variables de entorno

| Variable | Dónde | Sandbox | Producción |
|---|---|---|---|
| `PADDLE_WEBHOOK_SECRET` | gateway (Railway) | secreto del destino de notificaciones sandbox (`pdl_ntfset_...`) | secreto del destino live |
| `PADDLE_API_KEY` | gateway (Railway) | `pdl_sdbx_apikey_...` con permiso `customer_portal_session.write` | `pdl_live_apikey_...` con el mismo permiso |
| `PADDLE_ENV` | gateway (Railway) | `sandbox` | `production` (si falta, se deduce del prefijo de la clave) |
| `PADDLE_PRICE_FOUNDER` | gateway **y** dashboard | `pri_01m5rck0vjxwwgy1m9t4xe463j` | id del precio founder live |
| `PADDLE_PRICE_PRO` | gateway **y** dashboard | `pri_01m5rck0zrxc39khzcmtsw59ca` | id del precio pro live |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | dashboard (Vercel) | client-side token `test_...` | client-side token `live_...` |
| `NEXT_PUBLIC_PADDLE_ENV` | dashboard (Vercel) | `sandbox` | `production` |
| `PADDLE_WEBHOOK_TOLERANCE_S` | gateway, opcional | 5 por defecto (lo que recomienda Paddle) | igual |
| `BILLING_CRYPTO_ENABLED` | gateway, opcional | sin poner = apagado | sin poner = apagado. `1` vuelve a prender el 402 en USDC y el pago con saldo para Pro |

Las `NEXT_PUBLIC_*` se inlinean en el build: después de cambiarlas en Vercel hay que redeployar. Token, precios y ambiente tienen que ser del mismo ambiente: un `pri_` de sandbox no existe en live.

Sandbox (creado el 24 oct 2026 por API): producto Peaje Pro `pro_01m5rck0qv2rwhgx0rt8zzke65`, founder `pri_01m5rck0vjxwwgy1m9t4xe463j` (US$30/mes), pro `pri_01m5rck0zrxc39khzcmtsw59ca` (US$69/mes), sin prueba, cantidad 1. **Ojo:** es la misma cuenta sandbox de Puente (tiene Puente Pro y el destino de RevenueCat). Los eventos de Puente que lleguen al webhook de Peaje se ignoran por precio.

## Migración

`supabase/migrations/20261024600000_paddle.sql` (sin aplicar): columnas `paddle_*` en `tenants`, `'paddle'` en el check de `billing_payments.method`, `subscription_ref` y `refunded_at` en `billing_payments`, y la tabla `paddle_events`. Aplicarla antes de prender el webhook: sin ella el webhook responde 500 y Paddle reintenta (no se pierde nada mientras dure la ventana de reintentos, 3 días en live).

## Webhook

- URL: `https://api.usepeaje.com/paddle/webhook`
- Eventos a suscribir en el destino:
  - `transaction.completed`
  - `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.canceled`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`
  - `adjustment.created`, `adjustment.updated`
- Un destino por ambiente, cada uno con su secreto. El de sandbox va en el gateway mientras se prueba; el live, en producción.

## Pasos de San en Paddle live

1. Aprobación de la cuenta y del dominio `usepeaje.com` (Checkout > Website approval). Las páginas que pide la revisión ya están en el pie: `/precios`, `/terms`, `/privacy`, `/reembolsos`. Ninguna ofrece pagar Pro en cripto con `BILLING_CRYPTO_ENABLED` apagado.
2. Link de pago por defecto (Checkout > Checkout settings > Default payment link): `https://usepeaje.com/checkout`.
3. Catálogo: `PADDLE_API_KEY_LIVE=pdl_live_... npx tsx scripts/seed-paddle.mts --live` (clave con `product.write` y `price.write`; correr primero con `--dry`). O a mano: producto "Peaje Pro" (tax category SaaS) con dos precios mensuales en USD, US$30 y US$69, sin trial, cantidad mínima y máxima 1. Copiar los `pri_` a `PADDLE_PRICE_FOUNDER` y `PADDLE_PRICE_PRO` en Railway y Vercel.
4. Client-side token (Developer tools > Authentication) → `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` en Vercel, con `NEXT_PUBLIC_PADDLE_ENV=production`.
5. API key con `customer_portal_session.write` → `PADDLE_API_KEY` en Railway, con `PADDLE_ENV=production`.
6. Destino de notificaciones (Developer tools > Notifications): URL y eventos de arriba; el secreto → `PADDLE_WEBHOOK_SECRET` en Railway.
7. Si la cuenta live es la misma de Puente: Peaje necesita su propio destino (el de RevenueCat no sirve) y el dominio `usepeaje.com` aprobado aparte.

## Reembolsos (los hace San en Paddle)

Política: primer pago, reembolso completo dentro de 7 días (`DIAS_REEMBOLSO`); renovaciones no. En Paddle: Transactions > el cobro > Refund > Full. Cuando Paddle lo aprueba (en live puede quedar pendiente; en sandbox se aprueba solo cada diez minutos), llega `adjustment.updated` con `status: approved` y el plan termina. **Además cancela la suscripción** (inmediata) en Paddle: el reembolso no la cancela y, si no, se renueva el mes siguiente y vuelve a dar Pro porque se cobró.

## Probar en sandbox

1. Variables de sandbox en el gateway y el dashboard (tabla de arriba). Aplicar la migración en la base donde se prueba.
2. Destino de notificaciones sandbox apuntando al gateway (en local, un túnel: `hookdeck listen 8787` o `ngrok http 8787`, y la URL `/paddle/webhook`).
3. En Mi agente, "Suscribirme a Pro". Tarjetas de prueba de Paddle (solo sandbox, cualquier vencimiento futuro, cualquier CVC):
   - `4242 4242 4242 4242`: válida sin 3DS
   - `4000 0038 0000 0446`: válida con 3DS
   - `4000 0000 0000 0002`: rechazada
   - `4000 0027 6000 3184`: primer cobro bien, renovaciones rechazadas (prueba `past_due`)
4. Verificar: en el log del gateway `[paddle] plan activado`, el negocio pasa a Pro, el pago aparece en "Pagos" con método tarjeta y aparece "Gestionar suscripción".
5. "Gestionar suscripción" abre el portal; cancelar ahí deja "Cancelaste la suscripción: conservas Pro hasta…".
6. Simulador (Developer tools > Simulations) para `subscription.canceled`, `subscription.past_due` y reembolsos sin esperar al calendario. Los payloads del simulador no traen el `tenantId` de Peaje: editar `custom_data` o usar el `sub_` de una suscripción real del negocio.
7. Tests sin Paddle: `pnpm --filter @peaje/gateway test` (firma, idempotencia, founder/pro, cancelación al fin del período, reembolso del primer pago, contra el store en memoria).

## Qué no se probó todavía

- Un checkout real en sandbox de punta a punta (no hay client token de Peaje todavía) ni el webhook con eventos firmados por Paddle (la firma se probó con el algoritmo de la doc y un HMAC calculado con openssl).
- La llamada real a `portal-sessions`.
- Cómo se ve el overlay sobre el dashboard en modo oscuro.
