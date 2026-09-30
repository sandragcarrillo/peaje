export * from './types'
export { MemoryStore } from './memory'
export { SupabaseStore } from './supabase'
// ---- M9 ----
export * from './planes'

import { MemoryStore } from './memory'
import { SupabaseStore } from './supabase'
import type { Store } from './types'

let cached: Store | undefined

/**
 * Devuelve el store según el entorno: Supabase si hay credenciales,
 * memoria si no. Misma interfaz en los dos casos.
 */
export function getStore(): Store {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    cached = new SupabaseStore(url, key)
    console.log('[db] usando Supabase')
  } else {
    cached = new MemoryStore()
    console.warn('[db] sin credenciales de Supabase: usando store en memoria')
  }
  return cached
}
