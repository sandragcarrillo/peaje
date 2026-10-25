import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { Tenant, VoiceProfile } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import { leerSitio } from '../monitor/reporte.js'

/**
 * La voz del negocio: cómo escribe en su propio sitio. Un modelo barato la lee
 * una vez y deja un perfil corto (idioma, formalidad, a quién le habla, largo
 * de frase, palabras que usa y que evita, tres frases citadas tal cual). Los
 * borradores lo usan para que la página suene al negocio y no a un modelo.
 *
 * Se guarda en el tenant y se refresca cada 30 días como mucho. Si el dueño lo
 * edita, queda así: el refresco automático no lo pisa.
 */

const MODELO = process.env.VOICE_MODEL ?? 'claude-haiku-4-5'
export const REFRESCO_DIAS = 30

const PerfilSchema = z.object({
  language: z.string(),
  formality: z.string(),
  person: z.string(),
  sentenceLength: z.string(),
  uses: z.array(z.string()),
  avoids: z.array(z.string()),
  samples: z.array(z.string()),
})

let anthropic: Anthropic | null = null
/** Un pedido por negocio a la vez: tres borradores en paralelo no generan tres perfiles. */
const enCurso = new Map<string, Promise<VoiceProfile | null>>()

const normal = (s: string) => s.toLowerCase().replace(/[“”«»"]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()

const vigente = (t: Pick<Tenant, 'voiceProfile' | 'voiceProfileAt'>) =>
  !!t.voiceProfile && (!!t.voiceProfile.editedByOwner || (!!t.voiceProfileAt && Date.now() - new Date(t.voiceProfileAt).getTime() < REFRESCO_DIAS * 86_400_000))

/** El perfil guardado, sin llamar a nada. */
export async function leerPerfilDeVoz(tenant: Tenant): Promise<{ profile: VoiceProfile | null; at: string | null }> {
  const fresco = (await store.getTenantById(tenant.id)) ?? tenant
  return { profile: fresco.voiceProfile ?? null, at: fresco.voiceProfileAt ?? null }
}

/**
 * El perfil de voz del negocio. Devuelve el guardado si tiene menos de 30
 * días o lo editó el dueño; si no, lee el sitio y lo arma. Null si no hay
 * sitio legible o no hay clave de Anthropic: el borrador sale igual, sin voz.
 */
export async function perfilDeVoz(tenant: Tenant, opts: { forzar?: boolean; sitio?: string } = {}): Promise<VoiceProfile | null> {
  const fresco = (await store.getTenantById(tenant.id).catch(() => null)) ?? tenant
  // Vigente: menos de 30 días, o lo editó el dueño (ese solo se rehace con forzar).
  if (!opts.forzar && vigente(fresco)) return fresco.voiceProfile
  const previo = enCurso.get(tenant.id)
  if (previo) return previo
  const p = armarPerfil(fresco, opts.sitio).finally(() => enCurso.delete(tenant.id))
  enCurso.set(tenant.id, p)
  return p
}

async function armarPerfil(tenant: Tenant, sitioDado?: string): Promise<VoiceProfile | null> {
  if (!process.env.ANTHROPIC_API_KEY) return tenant.voiceProfile ?? null
  const dominio = dominioVerificable(tenant.originUrl)
  const sitio = sitioDado ?? (dominio ? await leerSitio(dominio).catch(() => '') : '')
  if (sitio.length < 200) return tenant.voiceProfile ?? null
  anthropic ??= new Anthropic()
  try {
    const res = await anthropic.messages.parse({
      model: MODELO,
      max_tokens: 1_500,
      system: [
        "You describe how a business writes on its own website, so new pages can be written in the same voice. Read the site text and return a compact profile. Describe; do not judge or improve.",
        '- language: the main language code of the site, e.g. "es" or "en".',
        '- formality: one or two words, e.g. "casual", "neutral", "formal", "technical".',
        '- person: how it addresses the reader and itself, in a few words, e.g. "tú, nosotros", "usted", "vos", "you, we".',
        '- sentenceLength: "short", "medium" or "long", plus a few words if useful.',
        '- uses: up to 8 words or short phrases the business repeats (product names, its own terms, recurring expressions).',
        '- avoids: up to 6 things it does not do, inferred from the text, e.g. "no exclamation marks", "no English terms", "no superlatives".',
        '- samples: exactly 3 short sentences (under 25 words each) copied word for word from the site text, the ones that best show the voice. Copy them exactly, never paraphrase or combine.',
        'Write the profile fields in the language of the site.',
      ].join('\n'),
      messages: [{ role: 'user', content: `Business: ${tenant.name}.\n\nSite text (each block starts with its URL):\n${sitio.slice(0, 10_000)}` }],
      output_config: { format: zodOutputFormat(PerfilSchema) },
    })
    const p = res.parsed_output
    if (!p) return tenant.voiceProfile ?? null
    // Las muestras valen solo si están en el sitio tal cual: nada de frases inventadas.
    const texto = normal(sitio)
    const samples = p.samples
      .map((s) => s.trim().replace(/^["“«]|["”»]$/g, ''))
      .filter((s) => s.length >= 8 && texto.includes(normal(s)))
      .slice(0, 3)
    const perfil: VoiceProfile = {
      language: p.language.trim().slice(0, 12),
      formality: p.formality.trim().slice(0, 60),
      person: p.person.trim().slice(0, 60),
      sentenceLength: p.sentenceLength.trim().slice(0, 60),
      uses: p.uses.map((x) => x.trim()).filter(Boolean).slice(0, 8),
      avoids: p.avoids.map((x) => x.trim()).filter(Boolean).slice(0, 6),
      samples,
    }
    await store.setTenantVoiceProfile(tenant.id, perfil)
    return perfil
  } catch (error) {
    console.warn('[voz] sin perfil', tenant.slug, error instanceof Error ? error.message : error)
    return tenant.voiceProfile ?? null
  }
}

/** Lo que el dueño puede cambiar del perfil (desde el chat o el dashboard). */
export type CambioDeVoz = Partial<Omit<VoiceProfile, 'editedByOwner'>>

/**
 * El dueño corrige su voz ("no usamos 'tú', usamos 'usted'"). Se mezcla con
 * el perfil actual y queda marcado como suyo. Las muestras que mande el dueño
 * se aceptan tal cual: son sus palabras.
 */
export async function guardarPerfilDeVoz(tenant: Tenant, cambio: CambioDeVoz): Promise<VoiceProfile> {
  const { profile } = await leerPerfilDeVoz(tenant)
  const lista = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : undefined)
  const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
  const nuevo: VoiceProfile = {
    language: texto(cambio.language, 12) ?? profile?.language ?? '',
    formality: texto(cambio.formality, 60) ?? profile?.formality ?? '',
    person: texto(cambio.person, 60) ?? profile?.person ?? '',
    sentenceLength: texto(cambio.sentenceLength, 60) ?? profile?.sentenceLength ?? '',
    uses: lista(cambio.uses, 8) ?? profile?.uses ?? [],
    avoids: lista(cambio.avoids, 6) ?? profile?.avoids ?? [],
    samples: lista(cambio.samples, 3) ?? profile?.samples ?? [],
    ...((texto(cambio.notes, 300) ?? profile?.notes) ? { notes: texto(cambio.notes, 300) ?? profile?.notes } : {}),
    editedByOwner: true,
  }
  await store.setTenantVoiceProfile(tenant.id, nuevo)
  return nuevo
}

/** El perfil como instrucción para el prompt de un borrador. Vacío si no hay perfil. */
export function textoDeVoz(p: VoiceProfile | null | undefined): string {
  if (!p) return ''
  const partes = [
    p.language ? `language ${p.language}` : '',
    p.formality ? `tone ${p.formality}` : '',
    p.person ? `addresses the reader as ${p.person}` : '',
    p.sentenceLength ? `${p.sentenceLength} sentences` : '',
  ].filter(Boolean)
  return [
    partes.join('; ') + '.',
    p.uses.length ? `Words and phrases they use: ${p.uses.join(', ')}.` : '',
    p.avoids.length ? `They avoid: ${p.avoids.join('; ')}.` : '',
    p.samples.length ? `Sentences from their site, for tone only (do not copy them): ${p.samples.map((s) => `"${s}"`).join(' ')}` : '',
    p.notes ? `Owner's note: ${p.notes}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}
