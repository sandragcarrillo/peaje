# Migración a la app de Privy propia

Octubre 2026. Peaje pasa de la app de Privy creada por la cuenta de un cofundador a una app nueva a nombre de San, y la wallet de cada negocio pasa a ser del dueño (no custodial). Solo testnet.

## Qué cambia

| Antes | Después |
|---|---|
| Login por email en la app vieja; el negocio queda atado al DID viejo. | Login en la app nueva. Al entrar, si el DID nuevo no tiene negocios, se buscan los del mismo email verificado y se pasan a él (el DID viejo queda en `privy_user_id_legacy`). |
| Wallet del negocio creada y controlada por la app (Peaje firma retiros y envíos). | Wallet de Privy cuyo owner es el usuario (`owner_wallet`). Peaje no puede firmar con ella: solo la muestra y cobra en ella. Una por persona, compartida por sus negocios. |
| "Cambiar wallet de retiro" sin validar más que el formato. | "Usar mi propia dirección": checksum EIP-55, no la treasury, no un contrato en Arbitrum, Robinhood, Tempo ni Arc, no una wallet de agente ni de otra cuenta de Peaje. Se puede volver a la wallet de Peaje. |
| Enviar fondos desde la wallet del negocio (firma de Peaje). | Oculto para la wallet del dueño, con nota de que llega con la próxima actualización. Los negocios sin migrar lo conservan. |
| Wallets de agentes compradores en la app vieja. | Se recrean en la app nueva, siguen siendo de la app (la custodia está pendiente con el abogado). |
| Sesión firmada con `INTERNAL_API_SECRET`, sin vencimiento firmado. | Sesión firmada con `SESSION_SECRET`, formato `v3` con emisión y vencimiento (30 días) dentro de lo firmado. Todas las sesiones viejas dejan de valer: todos vuelven a entrar. |

Por qué la wallet se crea en el servidor: `createOnLogin` del SDK de React no corre con `loginWithCode` (el login headless que usa Peaje), según docs.privy.io/basics/react/advanced/automatic-wallet-creation. El dashboard la crea con `users().pregenerateWallets` justo después de verificar el token, y el script de migración la crea en el mismo batch import.

## Variables

| Variable | Dónde | Valor |
|---|---|---|
| `PRIVY_VIEJA_APP_ID`, `PRIVY_VIEJA_APP_SECRET` | `.env` local (solo para los scripts) | Los valores actuales de `PRIVY_APP_ID` / `PRIVY_APP_SECRET` |
| `PRIVY_NUEVA_APP_ID`, `PRIVY_NUEVA_APP_SECRET` | `.env` local (ya están) | App nueva |
| `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID` | Vercel (dashboard) | App nueva |
| `PRIVY_APP_ID`, `PRIVY_APP_SECRET` | Railway (gateway) | App nueva |
| `SESSION_SECRET` | Vercel y `.env` local | `openssl rand -base64 48`. Sin ella el dashboard firma con `INTERNAL_API_SECRET` y avisa en el log. |
| `TREASURY_ADDRESS` | Vercel (opcional) | La de la treasury. Sin ella, "usar mi propia dirección" no rechaza la treasury (el resto de las reglas sigue). |

## Corte, en orden

| # | Quién | Paso |
|---|---|---|
| 1 | San | En `.env` local: agregar `PRIVY_VIEJA_APP_ID` y `PRIVY_VIEJA_APP_SECRET` (copiar los `PRIVY_APP_*` actuales) y `SESSION_SECRET`. |
| 2 | San | En el dashboard de Privy de la app nueva: login por email activo; recomendado apagar el login con wallet (hoy está prendido y Peaje no lo usa); dominios permitidos: usepeaje.com y localhost:3100 si se restringen. |
| 3 | San | Aplicar la migración `supabase/migrations/20261025000000_privy_app_propia.sql` en Supabase. Solo agrega columnas e índices: el código en producción la ignora. |
| 4 | San | Plan en seco: `pnpm exec tsx --env-file=.env scripts/privy-migracion.mts`. No escribe nada. Revisar que salgan 5 negocios a migrar, 4 usuarios a importar, 1 agente, y clima-andino como excluido. |
| 5 | San | Cargar en Vercel y Railway las variables de la app nueva y `SESSION_SECRET` (tabla de arriba). Vercel no redeploya solo; Railway sí al aplicar el cambio. Con el código de hoy, el gateway con la app nueva no puede firmar con las wallets de agentes ni con las custodiadas hasta el paso 6. |
| 6 | San | `pnpm exec tsx --env-file=.env scripts/privy-migracion.mts --apply`. Importa usuarios con su wallet, pasa los negocios a los DID nuevos, asigna la wallet del dueño, recrea la wallet del agente. Volver a correrlo sin `--apply`: todo tiene que salir como "listo". |
| 7 | San | Commit y push de este cambio; redeploy del dashboard (Vercel) y del gateway (Railway). Hacer 6 y 7 seguidos: entre uno y otro, el dashboard viejo con la app vieja no encuentra los negocios. |
| 8 | San | Barrido en seco: `pnpm exec tsx --env-file=.env scripts/privy-barrer.mts`. Muestra qué movería de cada wallet vieja a la nueva. Necesita `TREASURY_PRIVATE_KEY` (paga el gas relayado). |
| 9 | San | `pnpm exec tsx --env-file=.env scripts/privy-barrer.mts --apply --huerfanas-a=treasury`. Sin `--huerfanas-a`, las wallets viejas que nada referencia (agentes borrados, pruebas) solo se listan. |
| 10 | San | Entrar como cada usuario y seguir el checklist de abajo. |
| 11 | San | A los 30 días: borrar `PRIVY_VIEJA_*` del `.env`. Hasta entonces no tocar la app vieja (ni usuarios ni wallets). |

Importante: no desplegar este código con la app vieja todavía configurada. Al entrar alguien, el dashboard le crearía la wallet del dueño en la app vieja. Lo mismo en local: `pnpm dev` con el `.env` de hoy (Supabase de producción y `PRIVY_APP_*` de la app vieja) y un login escribiría en producción. Hasta el corte, probar en local con `PRIVY_APP_*` apuntando a la app nueva y sin `SUPABASE_*` (store en memoria).

## Volver atrás

1. Restaurar en Vercel y Railway los valores viejos de `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID`.
2. Revertir el commit y redeployar (las sesiones `v3` dejan de valer: todos vuelven a entrar).
3. En Supabase, devolver DIDs, wallets y agentes a lo de la app vieja:

```sql
update tenants
   set privy_user_id = privy_user_id_legacy, privy_user_id_legacy = null
 where privy_user_id_legacy is not null;

update tenants
   set custodial_wallet = custodial_wallet_legacy,
       custodial_wallet_id = custodial_wallet_id_legacy,
       payout_wallet = case when lower(payout_wallet) = lower(owner_wallet) then custodial_wallet_legacy else payout_wallet end,
       owner_wallet = null, owner_wallet_id = null,
       custodial_wallet_legacy = null, custodial_wallet_id_legacy = null
 where custodial_wallet_id_legacy is not null;

update agents
   set wallet_address = wallet_address_legacy, privy_wallet_id = privy_wallet_id_legacy,
       wallet_address_legacy = null, privy_wallet_id_legacy = null
 where wallet_address_legacy is not null;
```

Si el barrido ya corrió, esos centavos de testnet quedan en las wallets nuevas: las del dueño no las puede mover Peaje. La app vieja se deja intacta 30 días justamente para poder volver.

## Checklist por negocio

Antes de empezar, esta consulta tiene que mostrar los 5 migrados con `privy_user_id_legacy` lleno, `owner_wallet = payout_wallet` y `custodial_wallet` vacío, y clima-andino igual que antes:

```sql
select slug, left(privy_user_id, 16) dueno, left(privy_user_id_legacy, 16) dueno_viejo,
       payout_wallet, owner_wallet, custodial_wallet, custodial_wallet_legacy
  from tenants order by slug;
select a.name, t.slug, a.wallet_address, a.wallet_address_legacy
  from agents a join tenants t on t.id = a.tenant_id;
```

| Negocio | Dueño (email) | Verificar |
|---|---|---|
| sandra-portafolio | sa…@gmail.com | Entra con OTP y llega al selector (tiene dos negocios). `/wallet`: misma address que peaje, saldos tras el barrido (≈0.088 USDC y 0.0196 USDG en Arbitrum, ≈0.25 pathUSD en Tempo, ≈0.045 USDC en Arc). `/t/sandra-portafolio/retirar`: "Dónde recibes los pagos" con la wallet nueva. El agente "Your agent" corre con su wallet nueva (≈0.26 USDC en Arc tras el barrido). Un pago de prueba llega a la address nueva. |
| peaje | sa…@gmail.com | Mismo usuario y misma wallet que sandra-portafolio. El sitio de Peaje sigue cobrando (radar) y el pago llega a la wallet nueva. |
| invitara | in…@gmail.com | Entra, ve su wallet nueva. Probar "Usar mi propia dirección" con una address inválida (error) y volver a la wallet de Peaje. |
| test | oc…@gmail.com | Entra, ve su wallet nueva, el panel carga sin errores. |
| puente | sa…@mail.grokbot.com | Entra, ve su wallet nueva. |
| clima-andino | sin usuario de Privy | No cambia nada: misma `payout_wallet` externa, sin `owner_wallet`, sus pagos siguen llegando a esa address. |

Además, en general:

- `/acceder` con un email nuevo sin negocio: muestra "sin negocio" y el link a registrar.
- `/nuevo` con un email nuevo: el negocio nace con `owner_wallet = payout_wallet` y sin custodiada.
- Una cookie de sesión de antes del corte no deja entrar (pide email).
- En los logs del dashboard no aparece `falta SESSION_SECRET`.

## Lo que queda para la próxima

- En Arbitrum, Robinhood y Arc los pagos todavía caen en PeajeSettlement a nombre de la wallet de cobro. Para un negocio migrado Peaje no puede firmar el retiro (lo firma el dueño) y el panel muestra 0 disponible en esas redes. El reparto directo 98/2 del próximo hito lo elimina; hasta entonces es saldo de testnet que queda en el contrato a nombre del dueño.
- Reembolsos desde el contrato y fondeo de agentes desde el saldo del negocio en esas redes fallan con un error claro para los migrados (no hay custodia).
- Enviar desde la wallet del dueño: falta la firma del lado del usuario con el SDK de React.
- "Usar mi propia dirección" no pide firmar un mensaje para probar control: el login es solo por email y conectar una wallet externa es otro flujo.
- La identidad ERC-8004 del agente sigue vinculada a su wallet vieja; re-vincular necesita una tx en Base Sepolia.
- Custodia de las wallets de agentes: pendiente con el abogado.
