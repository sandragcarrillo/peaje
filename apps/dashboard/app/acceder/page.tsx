'use client'

import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useDict } from '@/lib/i18n/client'
import { entrarConPrivy } from './actions'
import { Etiqueta } from './etiqueta'

type Step = 'email' | 'code'

/** Al enviar el código, lo máximo que se espera a que Privy arranque antes de intentarlo igual. */
const ESPERA_PRIVY_MS = 5000
/** Tope para reusar una sesión de Privy: si no responde en este tiempo, vuelve el formulario. */
const ESPERA_RESTAURAR_MS = 8000

const pausa = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function Acceder() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [noRegistrado, setNoRegistrado] = useState(false)
  const [pending, setPending] = useState(false)
  // Arranca en false: el formulario se ve de entrada. Solo pasa a true
  // mientras se reusa una sesión que Privy confirmó.
  const [restaurando, setRestaurando] = useState(false)

  const d = useDict()
  const { ready, getAccessToken, authenticated, logout, error: errorPrivy } = usePrivy()
  const { sendCode, loginWithCode } = useLoginWithEmail()

  // Estado de Privy para los handlers async, que si no leen el de su render.
  const privy = useRef({ ready, authenticated, error: errorPrivy })
  useEffect(() => {
    privy.current = { ready, authenticated, error: errorPrivy }
  }, [ready, authenticated, errorPrivy])
  // Cada intento de reusar la sesión tiene su número: subirlo descarta el que
  // está en curso (se venció el tope o la persona ya pidió un código).
  const intento = useRef(0)
  const pidioCodigo = useRef(false)

  // Si Privy confirma una sesión válida, entra directo sin pedir código. Si
  // está rota o no tiene negocio, se limpia y queda el formulario.
  //
  // Antes la pantalla mostraba "Entrando…" hasta que Privy estuviera `ready`,
  // y Privy nunca llega a `ready` cuando falla su arranque: con un token viejo
  // guardado en el navegador, el refresh que hace al cargar puede responder
  // 403 invalid_origin (origen fuera de la lista de la app, como un puerto o
  // un preview distinto) o fallar por red, y el SDK solo absorbe el 401. Quien
  // volvía quedaba para siempre en "Entrando…" sin ver el formulario.
  useEffect(() => {
    if (!ready || !authenticated || pidioCodigo.current) return
    const este = ++intento.current
    const vigente = () => intento.current === este
    setRestaurando(true)
    const tope = setTimeout(() => {
      if (!vigente()) return
      intento.current++
      setRestaurando(false)
    }, ESPERA_RESTAURAR_MS)
    void (async () => {
      try {
        const accessToken = await getAccessToken()
        const r = accessToken ? await entrarConPrivy(accessToken) : null
        if (!vigente()) return
        if (r?.ok) {
          clearTimeout(tope)
          router.push(r.slug ? `/t/${r.slug}` : '/negocios')
          return
        }
      } catch (err) {
        console.warn('[acceder] no se pudo reusar la sesión de Privy:', err)
        if (!vigente()) return
      }
      clearTimeout(tope)
      intento.current++
      await logout().catch(() => {})
      setRestaurando(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated])

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNoRegistrado(false)
    if (!email.trim()) return setError(d.acceso.errorFaltaEmail)
    pidioCodigo.current = true
    intento.current++
    setRestaurando(false)
    setPending(true)
    try {
      // Quien escribe rápido puede enviar antes de que Privy termine de arrancar.
      const desde = Date.now()
      while (!privy.current.ready && !privy.current.error && Date.now() - desde < ESPERA_PRIVY_MS) await pausa(100)
      // Una sesión Privy vieja hace que loginWithCode intente VINCULAR el email
      // a ese usuario en vez de loguear ("User already has one email account
      // linked"). Y si Privy no pudo arrancar, sus tokens guardados son la causa
      // más probable: logout los borra del navegador aunque no haya red.
      if (privy.current.authenticated || privy.current.error) await logout().catch(() => {})
      await sendCode({ email })
      setStep('code')
    } catch {
      const privyCaido = !privy.current.ready || privy.current.error
      setError(privyCaido ? d.acceso.errorAccesoNoDisponible : d.acceso.errorEnvioCodigo)
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
        setError(d.acceso.errorSesionVieja)
        setStep('email')
      } else {
        setError(d.acceso.errorCodigoInvalidoPideOtro)
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
      setError(d.acceso.errorIngresoFallo)
    } finally {
      setPending(false)
    }
  }

  if (restaurando) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <p className="text-sm text-muted">{d.acceso.entrando}</p>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="w-full max-w-sm border border-border bg-panel p-8">
          <Etiqueta>Peaje</Etiqueta>
          <h1 className="mt-2 text-2xl font-semibold">{d.acceso.revisaTuEmail}</h1>
          <p className="mt-2 text-sm text-muted">
            {d.acceso.codigoEnviadoA} <span className="text-text">{email}</span>.
          </p>
          <p className="mt-2 text-sm text-muted">{d.acceso.codigoRevisaSpam}</p>
          <form onSubmit={verificar} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs text-muted">
                {d.acceso.campoCodigo}
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder={d.acceso.placeholderCodigo}
                className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
              />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {noRegistrado ? (
              <Link href="/nuevo" className="block text-sm text-accent hover:underline">
                {d.acceso.registrarEsteNegocio} →
              </Link>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primario"
            >
              {pending ? d.acceso.verificando : d.acceso.botonEntrar}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="w-full max-w-sm border border-border bg-panel p-8">
        <Etiqueta>Peaje</Etiqueta>
        <h1 className="mt-2 text-2xl font-semibold">{d.acceso.tituloEntrar}</h1>
        <p className="mt-2 text-sm text-muted">{d.acceso.subtituloEntrar}</p>
        <form onSubmit={enviarCodigo} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs text-muted">{d.acceso.campoEmail}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={d.acceso.placeholderEmail}
              className="mt-1.5 w-full rounded-lg border border-border bg-panel px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            disabled={pending}
            className="btn btn-primario"
          >
            {pending ? d.acceso.enviando : d.acceso.enviarCodigo}
          </button>
        </form>
      </div>
    </div>
  )
}
