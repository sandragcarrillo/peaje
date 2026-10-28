'use client'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useDict } from '@/lib/i18n/client'
import { buscarTareasAhora } from './actions'

/** Busca oportunidades nuevas (la misma búsqueda de Mi agente) y relee la página. */
export function BuscarOportunidades({ slug }: { slug: string }) {
  const { agenteReportes: t } = useDict()
  const router = useRouter()
  const [msj, setMsj] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={pending}
        className="btn btn-primario whitespace-normal"
        onClick={() =>
          start(async () => {
            setMsj(null)
            try {
              const r = await buscarTareasAhora(slug)
              setMsj('error' in r ? (r.error === 'not-enough-credits' ? r.message : t.opBuscarEspera(r.retryInSeconds)) : t.opBuscarResultado(r.creadas, r.actualizadas))
              router.refresh()
            } catch (e) {
              setMsj(e instanceof Error ? e.message : String(e))
            }
          })
        }
      >
        {pending ? t.opBuscando : t.opBuscar}
      </button>
      <span className="text-xs text-muted">{msj ?? t.opBuscarNota}</span>
    </div>
  )
}

export function CopiarTexto({ texto }: { texto: string }) {
  const { agenteReportes: t } = useDict()
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      className="btn btn-primario btn-chico"
      onClick={() => {
        void navigator.clipboard.writeText(texto)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1500)
      }}
    >
      {copiado ? t.taCopiado : t.taCopiar}
    </button>
  )
}

/** El borrador de la página como se va a ver: markdown con tablas. */
export function PaginaMarkdown({ texto }: { texto: string }) {
  return (
    <div className="text-sm leading-relaxed break-words [&_a]:text-accent [&_a]:underline [&_code]:font-mono [&_code]:text-xs [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-2 [&_strong]:font-semibold [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      <div className="overflow-x-auto">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: (props) => <table className="mt-3 w-full border-collapse text-left" {...props} />,
            th: (props) => <th className="border border-border px-2 py-1 font-medium" {...props} />,
            td: (props) => <td className="border border-border px-2 py-1 align-top" {...props} />,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {texto}
        </Markdown>
      </div>
    </div>
  )
}
