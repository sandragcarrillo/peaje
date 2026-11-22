import { ASISTENTES_MEDIDOS, MOTORES_MEDIDOS } from '@peaje/shared/asistentes'
import type { Estado } from './piezas'

/**
 * El negocio de ejemplo del home: qué contestó cada asistente a cada una de
 * las tres preguntas (hero y paso 1 del ciclo) y cómo cambió en tres
 * mediciones (paso 4). Son datos de muestra, rotulados "Ejemplo" en la página.
 * Los asistentes salen de ASISTENTES_MEDIDOS; uno nuevo sin fila acá sale como
 * "no apareces".
 */

const RESPUESTAS: Record<string, Estado[]> = {
  chatgpt: ['no', 'no', 'no'],
  claude: ['nombra', 'cita', 'no'],
}

/** Por pregunta (las dos primeras) y por asistente: primera medición, a las 2 y a las 6 semanas. */
const HISTORIAL: Record<string, Estado[]>[] = [
  { chatgpt: ['no', 'no', 'nombra'], claude: ['nombra', 'cita', 'cita'] },
  { chatgpt: ['no', 'no', 'no'], claude: ['cita', 'cita', 'nombra'] },
]

export const ASISTENTES = MOTORES_MEDIDOS.map((id, i) => ({
  id,
  nombre: ASISTENTES_MEDIDOS[i]!,
  respuestas: RESPUESTAS[id] ?? (['no', 'no', 'no'] as Estado[]),
}))

export const historialDe = (pregunta: number, id: string): Estado[] => HISTORIAL[pregunta]?.[id] ?? ['no', 'no', 'no']

export const citadas = (r: Estado[]) => r.filter((e) => e === 'cita').length
