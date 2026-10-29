import { marcaDeCliente } from '@peaje/shared/herramientas'
import { siClaude, siCursor, siGithubcopilot, siReplit, siTelegram, siV0, siWindsurf } from 'simple-icons'

/**
 * Logos de las integraciones. Los que están en simple-icons (CC0) van con su
 * trazo y su color; los negros toman el color del texto para verse en los dos
 * temas. Codex, ChatGPT (OpenAI) y Lovable no están en simple-icons (las marcas pidieron sacarlos):
 * salen de @lobehub/icons-static-svg 1.101.0 (MIT, LobeHub), copiados acá.
 * Slack no está en ninguno de los dos: va con su inicial hasta tener el archivo
 * de su kit de marca.
 */
export type Marca = 'telegram' | 'slack' | 'claude' | 'cursor' | 'codex' | 'chatgpt' | 'lovable' | 'windsurf' | 'copilot' | 'v0' | 'replit'

const ICONOS = {
  telegram: siTelegram,
  claude: siClaude,
  cursor: siCursor,
  windsurf: siWindsurf,
  copilot: siGithubcopilot,
  v0: siV0,
  replit: siReplit,
} as const

/** El interior del SVG (24×24) tal cual viene del set de LobeHub. Codex toma el color del texto. */
const LOBEHUB = {
  codex: { titulo: 'Codex', svg: "<path clip-rule=\"evenodd\" d=\"M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z\"></path>" },
  chatgpt: { titulo: 'ChatGPT', svg: "<path d=\"M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z\"></path>" },
  lovable: { titulo: 'Lovable', svg: "<path clip-rule=\"evenodd\" d=\"M7.082 0c3.91 0 7.081 3.179 7.081 7.1v2.7h2.357c3.91 0 7.082 3.178 7.082 7.1 0 3.923-3.17 7.1-7.082 7.1H0V7.1C0 3.18 3.17 0 7.082 0z\" fill=\"url(#peaje-logo-lovable)\" fill-rule=\"evenodd\"></path><defs><radialGradient cx=\"0\" cy=\"0\" gradientTransform=\"matrix(-1 22.49999 -30.45394 -1.3535 14 3)\" gradientUnits=\"userSpaceOnUse\" id=\"peaje-logo-lovable\" r=\"1\"><stop offset=\".25\" stop-color=\"#FE7B02\"></stop><stop offset=\".433\" stop-color=\"#FE4230\"></stop><stop offset=\".548\" stop-color=\"#FE529A\"></stop><stop offset=\".654\" stop-color=\"#DD67EE\"></stop><stop offset=\".95\" stop-color=\"#4B73FF\"></stop></radialGradient></defs>" },
} as const

const INICIALES: Record<Exclude<Marca, keyof typeof ICONOS | keyof typeof LOBEHUB>, { letra: string; color: string }> = {
  slack: { letra: 'S', color: '#4A154B' },
}

const MARCAS: Marca[] = ['telegram', 'slack', 'claude', 'cursor', 'codex', 'chatgpt', 'lovable', 'windsurf', 'copilot', 'v0', 'replit']

/** El logo para el nombre con que se presentó una herramienta ("Claude", "claude-code"…), o null. */
export function marcaDe(nombre: string): Marca | null {
  const m = marcaDeCliente(nombre)
  return (MARCAS as string[]).includes(m) ? (m as Marca) : null
}

export function Logo({ marca, className = 'h-6 w-6' }: { marca: Marca; className?: string }) {
  if (marca in ICONOS) {
    const icono = ICONOS[marca as keyof typeof ICONOS]
    const negro = icono.hex === '000000' || icono.hex === '0B100F'
    return (
      <svg role="img" aria-label={icono.title} viewBox="0 0 24 24" className={className}>
        <path d={icono.path} fill={negro ? 'currentColor' : `#${icono.hex}`} />
      </svg>
    )
  }
  if (marca in LOBEHUB) {
    const { titulo, svg } = LOBEHUB[marca as keyof typeof LOBEHUB]
    return (
      <svg
        role="img"
        aria-label={titulo}
        viewBox="0 0 24 24"
        fill="currentColor"
        fillRule="evenodd"
        className={className}
        // Contenido fijo de este archivo, no del usuario.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    )
  }
  const { letra, color } = INICIALES[marca as keyof typeof INICIALES]
  return (
    <span aria-hidden className={`inline-flex items-center justify-center rounded-md font-mono text-xs font-bold text-white ${className}`} style={{ background: color }}>
      {letra}
    </span>
  )
}
