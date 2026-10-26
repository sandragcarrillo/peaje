import 'server-only'
import { emailDe, walletEmbebidaDe, type WalletPrivy } from '@peaje/db'
import { PrivyClient } from '@privy-io/node'
import { createViemAccount, type PrivyViemAccount } from '@privy-io/node/viem'

let cached: PrivyClient | undefined

/**
 * Cliente de la app de Privy configurada (PRIVY_APP_ID / PRIVY_APP_SECRET).
 * Nada apunta a una app fija: el cambio de app es solo de variables.
 */
function client(): PrivyClient {
  if (!cached) {
    const appId = process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID
    const appSecret = process.env.PRIVY_APP_SECRET
    if (!appId || !appSecret) throw new Error('Faltan PRIVY_APP_ID / PRIVY_APP_SECRET')
    cached = new PrivyClient({ appId, appSecret })
  }
  return cached
}

/**
 * Verifica el access token que entrega el SDK del cliente tras el login por
 * email (OTP). Lanza si el token es inválido o expiró.
 */
export async function verifyPrivyAccessToken(accessToken: string): Promise<string> {
  const claims = await client().utils().auth().verifyAccessToken(accessToken)
  return claims.user_id
}

export type UsuarioPrivy = { email: string | null; wallet: WalletPrivy | null }

/** Email (verificado: entra por OTP) y wallet embebida del usuario, en una sola llamada. */
export async function usuarioPrivy(privyUserId: string): Promise<UsuarioPrivy> {
  const user = await client().users()._get(privyUserId)
  return { email: emailDe(user.linked_accounts), wallet: walletEmbebidaDe(user.linked_accounts) }
}

/** Email verificado del usuario de Privy, o null si no tiene uno linkeado. */
export async function getPrivyUserEmail(privyUserId: string): Promise<string | null> {
  return (await usuarioPrivy(privyUserId)).email
}

/**
 * La wallet del usuario (owner = su DID): la crea si no tiene. Es no
 * custodial: Peaje no puede firmar con ella por su cuenta, Privy exige la
 * sesión del usuario. `createOnLogin` del SDK no corre con loginWithCode
 * (login headless), por eso se crea acá, server-side, después de verificar
 * el token. docs.privy.io/recipes/pregenerate-wallets
 */
export async function asegurarWalletDueno(
  privyUserId: string,
  conocida?: WalletPrivy | null,
): Promise<WalletPrivy> {
  if (conocida) return conocida
  const actual = (await usuarioPrivy(privyUserId)).wallet
  if (actual) return actual
  const user = await client().users().pregenerateWallets(privyUserId, { wallets: [{ chain_type: 'ethereum' }] })
  const creada = walletEmbebidaDe(user.linked_accounts)
  if (!creada) throw new Error('Privy no devolvió la wallet del usuario')
  return creada
}

/**
 * El id de Privy si esa address es una wallet de esta app (de cualquier
 * usuario o de la app), o null. Sirve para rechazar direcciones ajenas en
 * "usar mi propia dirección": nunca para decidir con qué wallet firmar.
 */
export async function idWalletDeLaApp(address: string): Promise<string | null> {
  try {
    const wallet = await client().wallets().getWalletByAddress({ address })
    return wallet?.id ?? null
  } catch {
    return null
  }
}

/**
 * Cuenta viem que firma con una wallet de Privy controlada por la app
 * (server-side). Solo sirve para las custodiadas de antes de la migración:
 * con la wallet del dueño Privy rechaza la firma sin su sesión.
 */
export function merchantViemAccount(walletId: string, address: `0x${string}`): PrivyViemAccount {
  return createViemAccount(client(), { walletId, address })
}
