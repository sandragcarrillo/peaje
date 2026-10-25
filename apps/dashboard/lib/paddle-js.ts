'use client'

import { initializePaddle, type Paddle, type PaddleEventData } from '@paddle/paddle-js'

/**
 * Paddle.js una sola vez por pestaña: initializePaddle se niega a correr dos
 * veces. Los eventos del checkout van al oyente que esté montado (el plan en
 * "Mi agente" o la página /checkout).
 */
let promesa: Promise<Paddle | undefined> | null = null
let oyente: ((ev: PaddleEventData) => void) | null = null

export function escucharPaddle(fn: ((ev: PaddleEventData) => void) | null) {
  oyente = fn
}

export function cargarPaddle(token: string, environment: 'sandbox' | 'production'): Promise<Paddle | undefined> {
  if (!promesa) {
    promesa = initializePaddle({ token, environment, eventCallback: (ev) => oyente?.(ev) }).catch((e) => {
      promesa = null
      throw e
    })
  }
  return promesa
}

/** El tema del dashboard (clase `dark` en <html>) para que el overlay no desentone. */
export const temaActual = (): 'light' | 'dark' => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
