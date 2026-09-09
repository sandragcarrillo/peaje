'use client'

import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'
import { type FormEvent, useState } from 'react'
import { gatewayUrl } from '@/lib/config'
import { registrarNegocio, type AltaResultado } from './actions'

type Step = 'form' | 'code'

/** Acepta "tunegocio.com" o "https://tunegocio.com"; devuelve la URL normalizada o null. */
function normalizarUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  const conEsquema = value.includes('://') ? value : `https://${value}`
  try {
    const url = new URL(conEsquema)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (!url.hostname.includes('.')) return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export default function NuevoNegocio() {
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [originUrl, setOriginUrl] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [resultado, setResultado] = useState<AltaResultado | null>(null)

  const { getAccessToken, authenticated, logout } = usePrivy()
  const { sendCode, loginWithCode } = useLoginWithEmail()

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Falta el nombre del negocio.')
    const url = normalizarUrl(originUrl)
    if (!url) return setError('Esa URL no parece valida. Ejemplo: https://tunegocio.com')
    setOriginUrl(url)
    if (!email.trim()) return setError('Falta tu email.')
    setPending(true)
    try {
      // Sesión Privy vieja → loginWithCode intentaría vincular en vez de
      // loguear. Se limpia antes (mismo fix que en /acceder).
      if (authenticated) await logout().catch(() => {})
      await sendCode({ email })
      setStep('code')
    } catch {
      setError('No pudimos enviar el código. Revisa el email.')
    } finally {
      setPending(false)
    }
  }

  async function verificarYCrear(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await loginWithCode({ code })
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('sin token')
      const formData = new FormData()
      formData.set('name', name)
      formData.set('originUrl', normalizarUrl(originUrl) ?? originUrl)
      formData.set('privyAccessToken', accessToken)
      const r = await registrarNegocio(null, formData)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setResultado(r)
    } catch (err) {
      console.error('[nuevo] loginWithCode falló:', err)
      if (err instanceof Error && err.message.includes('already has one email')) {
        await logout().catch(() => {})
        setError('Había una sesión vieja de Privy. La limpiamos: pide un código nuevo.')
        setStep('form')
      } else {
        setError('Código inválido o vencido. Intenta de nuevo.')
      }
    } finally {
      setPending(false)
    }
  }

  if (resultado?.ok) return <Listo slug={resultado.slug} payoutWallet={resultado.payoutWallet} />

  if (step === 'code') {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-medium">Revisa tu email</h1>
          <p className="mt-2 text-sm text-muted">
            Te mandamos un código a <span className="text-text">{email}</span>.
          </p>
          <form onSubmit={verificarYCrear} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs tracking-wide text-muted uppercase">Código</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="123456"
                className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
              />
            </label>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50"
            >
              {pending ? 'Verificando…' : 'Verificar y crear gateway'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium">Registra tu negocio</h1>
        <p className="mt-2 text-sm text-muted">
          Con tu email creamos tu wallet de cobro automáticamente. Nada de API keys para copiar.
        </p>

        <form onSubmit={enviarCodigo} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-xs tracking-wide text-muted uppercase">Nombre del negocio</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Clima Andino"
              className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="text-xs tracking-wide text-muted uppercase">URL de tu sitio web</span>
            <input
              value={originUrl}
              onChange={(e) => setOriginUrl(e.target.value)}
              required
              placeholder="https://tunegocio.com"
              className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
            <span className="mt-1.5 block text-xs text-muted">
              Tu web de siempre. Peaje le pone el cobro delante, no la cambia.
            </span>
          </label>

          <label className="block">
            <span className="text-xs tracking-wide text-muted uppercase">Tu email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@tunegocio.com"
              className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <span className="mt-1.5 block text-xs text-muted">
              Ahí te mandamos el código para entrar. También es donde cae tu identidad de cobro.
            </span>
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50"
          >
            {pending ? 'Enviando código…' : 'Enviar código'}
          </button>
        </form>
      </div>
    </div>
  )
}

function acortarWallet(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-6)}`
}

function Listo({ slug, payoutWallet }: { slug: string; payoutWallet: string }) {
  const base = `${gatewayUrl}/${slug}`
  const [copiado, setCopiado] = useState(false)

  async function copiarWallet() {
    await navigator.clipboard.writeText(payoutWallet)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-medium">Listo. Tu gateway está arriba.</h1>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
            <p className="text-xs tracking-wide text-accent uppercase">Tu saldo</p>
            <p className="mt-3 text-3xl font-medium tabular-nums">$0.00</p>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-muted">
                Cuenta: <span className="font-mono">{acortarWallet(payoutWallet)}</span>
              </span>
              <button
                type="button"
                onClick={copiarWallet}
                className="text-xs text-accent hover:underline"
              >
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <p className="mt-3 text-xs text-muted">Acá vas a recibir los pagos de los agentes.</p>
          </div>

          <div className="rounded-lg border border-border bg-panel p-5">
            <p className="text-xs tracking-wide text-muted uppercase">Endpoint</p>
            <code className="mt-3 block break-all font-mono text-sm text-text">
              {base}/&lt;tu-ruta&gt;
            </code>
            <p className="mt-3 text-xs text-muted">Los agentes consumen tu website por aquí.</p>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          Todavía no tienes rutas. Comienza el onboarding para crearlas.
        </p>

        <Link
          href={`/t/${slug}/score`}
          className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black"
        >
          Empezar: mira tu score →
        </Link>
      </div>
    </div>
  )
}
