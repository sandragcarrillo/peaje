'use client'

import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { entrarConPrivy } from './actions'

type Step = 'email' | 'code'

export default function Acceder() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [noRegistrado, setNoRegistrado] = useState(false)
  const [pending, setPending] = useState(false)
  const [restaurando, setRestaurando] = useState(true)

  const { ready, getAccessToken, authenticated, logout } = usePrivy()
  const { sendCode, loginWithCode } = useLoginWithEmail()

  // Si ya hay sesión de Privy válida, entra directo sin pedir código.
  // Si la sesión está rota o no tiene negocio, se limpia y cae al OTP.
  useEffect(() => {
    if (!ready) return
    if (!authenticated) {
      setRestaurando(false)
      return
    }
    void (async () => {
      try {
        const accessToken = await getAccessToken()
        if (accessToken) {
          const r = await entrarConPrivy(accessToken)
          if (r.ok) {
            router.push(r.slug ? `/t/${r.slug}` : '/negocios')
            return
          }
        }
      } catch (err) {
        console.warn('[acceder] no se pudo reusar la sesión de Privy:', err)
      }
      await logout().catch(() => {})
      setRestaurando(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated])

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNoRegistrado(false)
    if (!email.trim()) return setError('Falta tu email.')
    setPending(true)
    try {
      // Una sesión Privy vieja (p.ej. restaurada de otra visita) hace que
      // loginWithCode intente VINCULAR el email a ese usuario en vez de
      // loguear ("User already has one email account linked"). Se limpia antes.
      if (authenticated) await logout().catch(() => {})
      await sendCode({ email })
      setStep('code')
    } catch {
      setError('No pudimos enviar el código. Revisa el email.')
    } finally {
      setPending(false)
    }
  }

  async function verificar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNoRegistrado(false)
    setPending(true)

    // El código se valida solo acá: cualquier fallo posterior NO es del código.
    try {
      await loginWithCode({ code })
    } catch (err) {
      // El detalle real de Privy queda en la consola del browser para debug.
      console.error('[acceder] loginWithCode falló:', err)
      if (err instanceof Error && err.message.includes('already has one email')) {
        // Sesión zombie detectada tarde: limpiar y pedir código de nuevo.
        await logout().catch(() => {})
        setError('Había una sesión vieja de Privy. La limpiamos: pide un código nuevo.')
        setStep('email')
      } else {
        setError('Código inválido o vencido. Pide uno nuevo e intenta de nuevo.')
      }
      setPending(false)
      return
    }

    try {
      const accessToken = await getAccessToken()
      if (!accessToken) throw new Error('Privy no devolvió el access token')
      const r = await entrarConPrivy(accessToken)
      if (!r.ok) {
        setNoRegistrado(true)
        setError(r.error)
        return
      }
      router.push(r.slug ? `/t/${r.slug}` : '/negocios')
    } catch (err) {
      console.error('[acceder]', err)
      setError('El código era válido pero falló el ingreso. Intenta de nuevo.')
    } finally {
      setPending(false)
    }
  }

  if (restaurando) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <p className="text-sm text-muted">Entrando…</p>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-medium">Revisa tu email</h1>
          <p className="mt-2 text-sm text-muted">
            Te mandamos un código a <span className="text-text">{email}</span>.
          </p>
          <form onSubmit={verificar} className="mt-6 space-y-4">
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
            {noRegistrado ? (
              <Link href="/nuevo" className="block text-sm text-accent hover:underline">
                Registrar este negocio →
              </Link>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50"
            >
              {pending ? 'Verificando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium">Entrar</h1>
        <p className="mt-2 text-sm text-muted">Con tu email. No hay usuarios ni contraseñas.</p>
        <form onSubmit={enviarCodigo} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs tracking-wide text-muted uppercase">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@tunegocio.com"
              className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50"
          >
            {pending ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>
      </div>
    </div>
  )
}
