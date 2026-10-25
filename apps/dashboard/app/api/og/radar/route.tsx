import { ImageResponse } from 'next/og'
import { dominioDeRadar } from '@/app/radar/dominio'
import { leer } from '@/app/radar/datos'
import { cachedScore, gradeDe } from '@/lib/ora'

/**
 * Imagen para compartir el radar: `/api/og/radar?d=<dominio>` (y `&lang=en`
 * para la versión en inglés; por defecto español). Abre con la pregunta que
 * le importa al dueño ("¿Qué tan listo está X para los agentes de IA?") y la
 * contesta en una frase; los puntajes van debajo, más chicos. Sin puntaje,
 * la misma pregunta sobre "tu sitio".
 *
 * Satori: cada texto interpolado va como UN template literal (`{`${a} ${b}`}`);
 * texto suelto más una variable son dos nodos y la imagen sale en 500.
 */

const COLOR = {
  crema: '#fdf9f0',
  tinta: '#1c1b19',
  gris: '#494740',
  linea: '#cbc6bd',
  verde: '#1f7280',
}

const TEXTO = {
  es: {
    pregunta: (d: string) => `¿Qué tan listo está ${d} para los agentes de IA?`,
    preguntaGenerica: '¿Qué tan listo está tu sitio para los agentes de IA?',
    respuesta: (x: number, y: number) => `Los agentes entienden ${x} de las ${y} cosas que buscan.`,
    puntajes: (hoy: number, g: string, est: number, ge: string) => `Hoy ${hoy} de 100 (${g}). Con Peaje, hasta ~${est} (${ge}).`,
    puntajeAlto: (hoy: number, g: string) => `Hoy ${hoy} de 100 (${g}). Ya pasa todo lo que Peaje cubre.`,
    generico: 'Mídelo gratis en medio minuto: qué encuentra un agente, qué le falta y por dónde empezar.',
    cta: 'Mide el tuyo gratis en usepeaje.com/radar',
  },
  en: {
    pregunta: (d: string) => `How ready is ${d} for AI agents?`,
    preguntaGenerica: 'How ready is your site for AI agents?',
    respuesta: (x: number, y: number) => `AI agents understand ${x} of the ${y} things they look for.`,
    puntajes: (hoy: number, g: string, est: number, ge: string) => `Today ${hoy} out of 100 (${g}). With Peaje, up to ~${est} (${ge}).`,
    puntajeAlto: (hoy: number, g: string) => `Today ${hoy} out of 100 (${g}). It already passes everything Peaje covers.`,
    generico: 'Check it free in half a minute: what an agent finds, what it is missing and where to start.',
    cta: 'Check yours free at usepeaje.com/radar',
  },
}

const TAMANO = { width: 1200, height: 630 }
const CACHE = { 'cache-control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' }

/** La barrera de Peaje (app/icon.svg) en chico, para la esquina. */
const MARCA = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none"><rect width="96" height="96" rx="22" fill="#17161a"/><line x1="26" y1="80" x2="52" y2="80" stroke="#a2dae2" stroke-width="10" stroke-linecap="round"/><line x1="39" y1="80" x2="39" y2="54" stroke="#a2dae2" stroke-width="10" stroke-linecap="round"/><line x1="39" y1="54" x2="70" y2="13" stroke="#a2dae2" stroke-width="11" stroke-linecap="round"/><line x1="45" y1="35.5" x2="53.5" y2="42" stroke="#17161a" stroke-width="4.5"/><line x1="52.5" y1="25.5" x2="61" y2="32" stroke="#17161a" stroke-width="4.5"/><line x1="60" y1="15.5" x2="68.5" y2="22" stroke="#17161a" stroke-width="4.5"/></svg>',
)}`

/** La misma barrera, sin el cuadro oscuro: va de fondo, grande y casi transparente. */
const FONDO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 4 72 86" fill="none"><line x1="26" y1="80" x2="52" y2="80" stroke="#1f7280" stroke-width="10" stroke-linecap="round"/><line x1="39" y1="80" x2="39" y2="54" stroke="#1f7280" stroke-width="10" stroke-linecap="round"/><line x1="39" y1="54" x2="70" y2="13" stroke="#1f7280" stroke-width="11" stroke-linecap="round"/><line x1="45" y1="35.5" x2="53.5" y2="42" stroke="#fdf9f0" stroke-width="4.5"/><line x1="52.5" y1="25.5" x2="61" y2="32" stroke="#fdf9f0" stroke-width="4.5"/><line x1="60" y1="15.5" x2="68.5" y2="22" stroke="#fdf9f0" stroke-width="4.5"/></svg>',
)}`

function Tarjeta({ pregunta, respuesta, detalle, cta }: { pregunta: string; respuesta: string; detalle: string; cta: string }) {
  const largo = pregunta.length
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: COLOR.crema, position: 'relative' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FONDO} width={430} height={514} alt="" style={{ position: 'absolute', right: 20, bottom: -30, opacity: 0.1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARCA} width={52} height={52} alt="" />
        <div style={{ display: 'flex', fontSize: 30, color: COLOR.tinta }}>{'Peaje Radar'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'flex', fontSize: largo > 60 ? 58 : 68, lineHeight: 1.1, color: COLOR.tinta, maxWidth: 1050 }}>{pregunta}</div>
        <div style={{ display: 'flex', fontSize: 40, lineHeight: 1.25, color: COLOR.verde, maxWidth: 1050 }}>{respuesta}</div>
        <div style={{ display: 'flex', fontSize: 30, color: COLOR.gris, maxWidth: 1050 }}>{detalle}</div>
      </div>
      <div style={{ display: 'flex', borderTop: `2px solid ${COLOR.linea}`, paddingTop: 22, fontSize: 28, color: COLOR.verde }}>{cta}</div>
    </div>
  )
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const t = TEXTO[params.get('lang') === 'en' ? 'en' : 'es']
  const dominio = dominioDeRadar(params.get('d') ?? undefined)
  const score = dominio ? await cachedScore(dominio).catch(() => null) : null

  if (!dominio || !score) {
    const pregunta = dominio ? t.pregunta(dominio) : t.preguntaGenerica
    return new ImageResponse(<Tarjeta pregunta={pregunta} respuesta={t.generico} detalle="" cta={t.cta} />, { ...TAMANO, headers: CACHE })
  }

  const l = leer(score)
  const nombre = score.domain || dominio
  const sube = l.estimado > l.actual
  const detalle = sube ? t.puntajes(l.actual, gradeDe(l.actual), l.estimado, gradeDe(l.estimado)) : t.puntajeAlto(l.actual, gradeDe(l.actual))
  return new ImageResponse(<Tarjeta pregunta={t.pregunta(nombre)} respuesta={t.respuesta(l.bien.length, l.total)} detalle={detalle} cta={t.cta} />, {
    ...TAMANO,
    headers: CACHE,
  })
}
