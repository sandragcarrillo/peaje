'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useRef, useState } from 'react'
import { COOKIE_SALIO } from './salida'

const tocoSalir = () => typeof document !== 'undefined' && document.cookie.split('; ').includes(`${COOKIE_SALIO}=1`)

/**
 * Salir borra la sesión de Peaje, pero la de Privy vive en el navegador y
 * Privy solo carga en /acceder y /nuevo. Sin esto, /acceder la reusaba y
 * volvía a entrar con la cuenta de la que la persona acababa de salir, y
 * /nuevo creaba el negocio en esa cuenta. Tras Salir se cierra también la de
 * Privy; mientras tanto devuelve true y la página no debe reusarla.
 */
export function useSalidaPrivy(): boolean {
  const { ready, authenticated, logout } = usePrivy()
  const [pendiente, setPendiente] = useState(tocoSalir)
  const cerrando = useRef(false)

  useEffect(() => {
    if (!pendiente || !ready) return
    // Se suelta recién cuando Privy ya no tiene sesión: si se soltara al resolver
    // logout(), /acceder podría ver un render con la sesión vieja y reusarla. La
    // marca también se borra recién ahí: si la pestaña se cierra antes, la
    // próxima visita lo reintenta.
    if (!authenticated) {
      document.cookie = `${COOKIE_SALIO}=; path=/; max-age=0`
      setPendiente(false)
      return
    }
    if (cerrando.current) return
    cerrando.current = true
    void logout()
      .catch(() => {})
      .finally(() => {
        cerrando.current = false
      })
  }, [pendiente, ready, authenticated, logout])

  return pendiente
}
