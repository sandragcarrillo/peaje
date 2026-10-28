'use client'

import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth'
import { track } from '@vercel/analytics'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { useDict } from '@/lib/i18n/client'
import { useSalidaPrivy } from '@/lib/privy-salida'
import { Etiqueta } from '../acceder/etiqueta'
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
  const [originUrl, setOriginUrl] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [resultado, setResultado] = useState<AltaResultado | null>(null)
  const [irAPlan, setIrAPlan] = useState(false)
  const router = useRouter()

  // El radar manda acá con el dominio ya medido: se precarga el campo. Al
  // terminar el alta se ve el puntaje del sitio; con `plan=1` (botón "Tu
  // agente lo arregla contigo"), a la sección del plan, donde está el checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const url = params.get('url')
    if (url) setOriginUrl((actual) => actual || url)
    if (params.get('plan') === '1') setIrAPlan(true)
  }, [])

  useEffect(() => {
    if (!resultado?.ok) return
    // Evento de Vercel Web Analytics: el negocio quedó creado (sin el dominio ni el correo).
    track('signup_completed')
    router.replace(irAPlan ? `/t/${resultado.slug}/agente#plan` : `/t/${resultado.slug}`)
  }, [resultado, irAPlan, router])

  const d = useDict()
  const { getAccessToken, authenticated, logout, error: errorPrivy } = usePrivy()
  const { sendCode, loginWithCode } = useLoginWithEmail()
  // Recién tocó Salir: la sesión de Privy que quedó es de la cuenta vieja y no se usa para crear el negocio.
  const saliendo = useSalidaPrivy()
  const conSesion = authenticated && !saliendo

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const url = normalizarUrl(originUrl)
    if (!url) return setError(d.acceso.errorUrlInvalida)
    setOriginUrl(url)
    setPending(true)
    try {
      // Con sesión Privy válida no se manda código nuevo: el segundo negocio
      // se crea directo sobre la misma cuenta.
      if (conSesion) {
        const accessToken = await getAccessToken().catch(() => null)
        if (accessToken) {
          const formData = new FormData()
          formData.set('originUrl', url)
          formData.set('privyAccessToken', accessToken)
          const r = await registrarNegocio(null, formData)
          if (r.ok) {
            setResultado(r)
            return
          }
          setError(r.error)
          return
        }
        // Token irrecuperable = sesión zombie: limpiar y caer al OTP.
        await logout().catch(() => {})
      }
      if (!email.trim()) return setError(d.acceso.errorFaltaEmail)
      // Si Privy no pudo arrancar, la causa más probable son tokens viejos
      // guardados en el navegador: logout los borra antes de pedir el código.
      if (errorPrivy || authenticated) await logout().catch(() => {})
      await sendCode({ email })
      setStep('code')
    } catch {
      setError(d.acceso.errorEnvioCodigo)
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
        setError(d.acceso.errorSesionVieja)
        setStep('form')
      } else {
        setError(d.acceso.errorCodigoInvalido)
      }
    } finally {
      setPending(false)
    }
  }

  if (resultado?.ok) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <p className="text-sm text-muted">{irAPlan ? d.acceso.irAlPlan : d.acceso.irAlPuntaje}</p>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="w-full max-w-sm border border-border bg-panel p-6 sm:p-8">
          <Etiqueta>Peaje</Etiqueta>
          <h1 className="mt-2 text-2xl font-semibold">{d.acceso.revisaTuEmail}</h1>
          <p className="mt-2 text-sm text-muted">
            {d.acceso.codigoEnviadoA} <span className="break-all text-text">{email}</span>.
          </p>
          <p className="mt-2 text-sm text-muted">{d.acceso.codigoRevisaSpam}</p>
          <form onSubmit={verificarYCrear} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs text-muted">
                {d.acceso.campoCodigo}
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder={d.acceso.placeholderCodigo}
                className="mt-1.5 w-full border border-border bg-bg px-3 py-2 font-mono text-base outline-none focus:border-text sm:text-sm"
              />
            </label>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primario"
            >
              {pending ? d.acceso.verificando : d.acceso.verificarYCrear}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="w-full max-w-4xl border border-border bg-panel p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">{d.acceso.tituloRegistrar}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">{d.acceso.subtituloRegistrar}</p>

        <form onSubmit={enviarCodigo} className="mt-8 space-y-6">
          <div className={`grid grid-cols-1 gap-6 ${conSesion ? '' : 'md:grid-cols-2'}`}>
          <label className="block">
            <span className="font-mono text-xs text-muted">
              {d.acceso.campoUrl} <span className="text-accent">*</span>
            </span>
            <input
              value={originUrl}
              onChange={(e) => setOriginUrl(e.target.value)}
              required
              placeholder={d.acceso.placeholderUrl}
              className="mt-1.5 w-full border border-border bg-bg px-3 py-2 font-mono text-base outline-none focus:border-text sm:text-sm"
            />
            <span className="mt-1.5 block text-xs text-muted">{d.acceso.ayudaUrl}</span>
          </label>

          <label className="block" hidden={conSesion}>
            <span className="font-mono text-xs text-muted">
              {d.acceso.campoTuEmail} <span className="text-accent">*</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!conSesion}
              placeholder={d.acceso.placeholderEmail}
              className="mt-1.5 w-full border border-border bg-bg px-3 py-2 text-base outline-none focus:border-text sm:text-sm"
            />
            <span className="mt-1.5 block text-xs text-muted">{d.acceso.ayudaEmail}</span>
          </label>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-col justify-between gap-4 border-t border-border pt-5 sm:flex-row sm:items-center">
            <p className="max-w-lg text-xs text-muted">
              {conSesion ? d.acceso.notaSesion : d.acceso.registrarNota}
            </p>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primario shrink-0"
            >
              {pending
                ? conSesion
                  ? d.acceso.creando
                  : d.acceso.enviandoCodigo
                : conSesion
                  ? d.acceso.crearDirecto
                  : d.acceso.enviarCodigo}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
