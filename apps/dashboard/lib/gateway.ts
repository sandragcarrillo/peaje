import 'server-only'
import type { Withdrawal } from '@peaje/db'

const base = process.env.GATEWAY_INTERNAL_URL ?? 'http://localhost:8787'
const secret = process.env.INTERNAL_API_SECRET ?? ''

type WithdrawalResponse = {
  withdrawal: Withdrawal
  explorerUrl: string | null
  error?: string
}

/** Llama la API interna del gateway (la única pieza con la clave de la treasury). */
async function internal<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}/_internal${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
      ...init?.headers,
    },
    cache: 'no-store',
  })
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Gateway respondió ${res.status}`)
  return data
}

export function requestWithdrawal(
  slug: string,
  body: { amount?: string; toWallet?: string; network?: string },
) {
  return internal<WithdrawalResponse>(`/${slug}/withdraw`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getWithdrawal(slug: string, id: string) {
  return internal<WithdrawalResponse>(`/${slug}/withdrawals/${id}`)
}
