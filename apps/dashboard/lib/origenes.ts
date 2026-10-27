import { accesoPro, type RadarLead, type Tenant } from '@peaje/db'

/**
 * Datos de /admin/origenes: por origen de primer contacto (lib/origen.ts),
 * cuántos dejaron su correo en el radar, cuántos dieron de alta un negocio y
 * cuántas de esas altas tienen Pro pagado hoy (founder o pro vigente según
 * accesoPro; la prueba no cuenta). Los días son de Bogotá.
 */

export const ZONA_PANEL = 'America/Bogota'
export const VENTANAS = [7, 30] as const
export type Ventana = (typeof VENTANAS)[number]

const DIA_MS = 86_400_000

export type Cuenta = { leads: number; altas: number; pro: number }
/** `origen` null = sin origen. */
export type FilaOrigen = Cuenta & { origen: string | null }
export type FilaDia = Cuenta & { dia: string }
export type Origenes = { filas: FilaOrigen[]; totales: Cuenta; porDia: FilaDia[] }

const fechaZona = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_PANEL, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "2026-10-26": el día de Bogotá de ese instante. */
export function diaDe(fecha: string | Date): string {
  return fechaZona.format(typeof fecha === 'string' ? new Date(fecha) : fecha)
}

/** Los `dias` días de Bogotá que terminan hoy, el más reciente primero. */
export function diasDeVentana(dias: number, ahora = new Date()): string[] {
  const vistos = new Set<string>()
  for (let i = 0; vistos.size < dias && i < dias + 2; i++) vistos.add(diaDe(new Date(ahora.getTime() - i * DIA_MS)))
  return [...vistos]
}

/** Desde cuándo pedirle al store: un día de más, así el día más viejo entra entero; armarOrigenes recorta. */
export function desdeParaVentana(dias: number, ahora = new Date()): string {
  return new Date(ahora.getTime() - (dias + 1) * DIA_MS).toISOString()
}

/** Pro pagado hoy: founder o pro vigente. La prueba no es una suscripción. */
export function tienePro(t: Pick<Tenant, 'plan' | 'planUntil' | 'trialUntil'>, ahora = new Date()): boolean {
  const acceso = accesoPro(t, ahora)
  return acceso.activo && acceso.plan !== 'trial'
}

const cero = (): Cuenta => ({ leads: 0, altas: 0, pro: 0 })

export function armarOrigenes(entrada: {
  leads: Pick<RadarLead, 'acquisitionSource' | 'createdAt'>[]
  tenants: Pick<Tenant, 'acquisitionSource' | 'createdAt' | 'plan' | 'planUntil' | 'trialUntil'>[]
  dias: number
  ahora?: Date
}): Origenes {
  const ahora = entrada.ahora ?? new Date()
  const dias = diasDeVentana(entrada.dias, ahora)
  const enVentana = new Set(dias)
  const porOrigen = new Map<string | null, Cuenta>()
  const porDia = new Map<string, Cuenta>(dias.map((d) => [d, cero()]))
  const totales = cero()

  const sumar = (origen: string | null, creado: string, campo: keyof Cuenta) => {
    const dia = diaDe(creado)
    if (!enVentana.has(dia)) return
    const fila = porOrigen.get(origen) ?? cero()
    fila[campo]++
    porOrigen.set(origen, fila)
    porDia.get(dia)![campo]++
    totales[campo]++
  }

  for (const l of entrada.leads) sumar(l.acquisitionSource, l.createdAt, 'leads')
  for (const t of entrada.tenants) {
    sumar(t.acquisitionSource, t.createdAt, 'altas')
    if (tienePro(t, ahora)) sumar(t.acquisitionSource, t.createdAt, 'pro')
  }

  const filas = [...porOrigen.entries()]
    .map(([origen, c]) => ({ origen, ...c }))
    // Más Pro, más altas, más leads; "sin origen" al final entre iguales; después por nombre.
    .sort(
      (a, b) =>
        b.pro - a.pro ||
        b.altas - a.altas ||
        b.leads - a.leads ||
        Number(a.origen === null) - Number(b.origen === null) ||
        (a.origen ?? '').localeCompare(b.origen ?? ''),
    )

  return { filas, totales, porDia: dias.map((dia) => ({ dia, ...porDia.get(dia)! })) }
}
