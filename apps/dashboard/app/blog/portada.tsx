import { Logo, marcaDe, type Marca } from '@/components/logos'

/**
 * La portada de un artículo, como las de x.ai/news: un degradado vivo con una
 * mancha de luz difusa, la textura de puntos de la marca y un texto corto en
 * grande (`portada_titulo` en el .md, no el título entero). Sin imágenes: cada
 * artículo trae su número de portada (1 a 4) o sale uno fijo de su slug.
 * Con `portada_logos`, una fila de logos de integraciones va debajo del texto.
 */
const PALETAS: Record<number, { base: string; mancha: string; luz: string; borde: string }> = {
  // Verde de Peaje con brillo turquesa.
  1: { base: '#04171a', mancha: '#1f7280', luz: '#a2dae2', borde: '#0c3a40' },
  // Lila de la marca sobre violeta profundo.
  2: { base: '#0c0a17', mancha: '#5b4bd6', luz: '#b8aff0', borde: '#2a2163' },
  // Arena cálida, el crema de la marca encendido.
  3: { base: '#1d140c', mancha: '#b5733a', luz: '#f3dcb8', borde: '#4a3018' },
  // Noche con un hilo turquesa.
  4: { base: '#070707', mancha: '#24403f', luz: '#a2dae2', borde: '#161616' },
}

export function Portada({
  texto,
  n,
  icono = null,
  logos = [],
  grande = false,
}: {
  texto: string
  n: number
  icono?: 'check' | null
  logos?: string[]
  grande?: boolean
}) {
  const p = PALETAS[n] ?? PALETAS[1]!
  const marcas = logos.map(marcaDe).filter((m): m is Marca => m !== null)
  return (
    <div
      aria-hidden
      className={`relative flex aspect-[1.9] items-center justify-center overflow-hidden border ${grande ? 'rounded-2xl p-10' : 'rounded-xl p-6'}`}
      style={{
        borderColor: p.borde,
        background: [
          `radial-gradient(60% 75% at 72% 22%, ${p.luz}e6 0%, ${p.luz}00 60%)`,
          `radial-gradient(70% 90% at 30% 85%, ${p.mancha} 0%, ${p.mancha}00 65%)`,
          `radial-gradient(45% 60% at 95% 95%, ${p.mancha}cc 0%, ${p.mancha}00 70%)`,
          p.base,
        ].join(', '),
      }}
    >
      <span className="portada-puntos absolute inset-0" />
      <div className={`relative flex flex-col items-center text-white ${grande ? 'gap-6' : 'gap-3'}`}>
        <span
          className={`portada-titulo text-center font-medium tracking-tight ${
            grande ? 'text-4xl leading-tight sm:text-5xl lg:text-6xl' : 'text-xl leading-snug lg:text-2xl'
          }`}
        >
          {icono ? (
            // El ícono va pegado a la última palabra ("ChatGPT ✓"), y los dos no se separan al partir la línea.
            <>
              {texto.slice(0, texto.lastIndexOf(' ') + 1)}
              <span className="whitespace-nowrap">
                {texto.slice(texto.lastIndexOf(' ') + 1)}
                <Check />
              </span>
            </>
          ) : (
            texto
          )}
        </span>
        {marcas.length > 0 ? (
          <span className={`flex flex-wrap justify-center ${grande ? 'gap-4' : 'gap-2.5'}`}>
            {marcas.map((m) => (
              <Logo key={m} marca={m} className={grande ? 'h-8 w-8' : 'h-5 w-5'} />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Un check en círculo, del tamaño del texto. */
function Check() {
  return (
    <svg className="ml-[0.25em] inline-block h-[0.8em] w-[0.8em] align-[-0.08em]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="m7 12.5 3.2 3.2L17 9" stroke="#0b0b0a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
