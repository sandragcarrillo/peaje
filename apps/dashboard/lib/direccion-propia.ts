import { getAddress, isAddress } from 'viem'

/**
 * Validación de "usar mi propia dirección" para cobrar. Sin dependencias de
 * servidor: lo externo (RPC, base, Privy) entra por `deps`, así se prueba con
 * el store en memoria (test/direccion-propia.test.ts).
 */

export type MotivoRechazo =
  /** No es una address EVM (0x + 40 hex). */
  | 'formato'
  /** Tiene mayúsculas y minúsculas pero el checksum EIP-55 no coincide: casi siempre un typo. */
  | 'checksum'
  /** Es la treasury de Peaje. */
  | 'treasury'
  /** Tiene código en alguna de las redes: es un contrato, no una cuenta que firme. */
  | 'contrato'
  /** Es la wallet de un agente comprador de Peaje. */
  | 'agente'
  /** Es una wallet de Privy de esta app que no es la del dueño. */
  | 'ajena'
  /** No se pudo leer alguna red: mejor no guardar sin verificar. */
  | 'sin-verificar'

export type ResultadoDireccion = { ok: true; address: `0x${string}` } | { ok: false; motivo: MotivoRechazo }

export type DepsDireccion = {
  /** Treasury de Peaje (TREASURY_ADDRESS), si se conoce. */
  treasury: string | null
  /** Redes donde mirar el código; una entrada por cadena. */
  redes: string[]
  /** eth_getCode en esa red: '0x' o undefined si no hay código. Lanza si el RPC falla. */
  codigoEn: (red: string, address: `0x${string}`) => Promise<string | undefined>
  /** true si la address es (o fue) la wallet de un agente de Peaje. */
  esWalletDeAgente: (address: `0x${string}`) => Promise<boolean>
  /** El id de Privy si la address es una wallet de esta app, o null. */
  idWalletDeLaApp: (address: `0x${string}`) => Promise<string | null>
  /** Wallet del dueño en Privy: volver a ella siempre se permite. */
  walletDelDueno: { id: string | null; address: string | null }
}

// EIP-7702: una cuenta normal que delegó código empieza con 0xef0100. Sigue
// siendo una EOA que firma, así que no cuenta como contrato.
const DELEGACION_7702 = /^0xef0100/i

export async function validarDireccionPropia(raw: string, deps: DepsDireccion): Promise<ResultadoDireccion> {
  const texto = raw.trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(texto)) return { ok: false, motivo: 'formato' }
  // Igual que viem en modo estricto: todo en minúsculas no trae checksum y se
  // acepta; con mayúsculas mezcladas el checksum EIP-55 tiene que cerrar.
  if (!isAddress(texto, { strict: true })) return { ok: false, motivo: 'checksum' }
  const address = getAddress(texto)
  const lower = address.toLowerCase()

  const { walletDelDueno } = deps
  if (walletDelDueno.address && walletDelDueno.address.toLowerCase() === lower) return { ok: true, address }

  if (deps.treasury && deps.treasury.toLowerCase() === lower) return { ok: false, motivo: 'treasury' }
  if (await deps.esWalletDeAgente(address)) return { ok: false, motivo: 'agente' }

  const id = await deps.idWalletDeLaApp(address)
  if (id && id !== walletDelDueno.id) return { ok: false, motivo: 'ajena' }

  const codigos = await Promise.allSettled(deps.redes.map((red) => deps.codigoEn(red, address)))
  for (const c of codigos) {
    if (c.status === 'rejected') return { ok: false, motivo: 'sin-verificar' }
    const code = c.value
    if (code && code !== '0x' && !DELEGACION_7702.test(code)) return { ok: false, motivo: 'contrato' }
  }
  return { ok: true, address }
}
