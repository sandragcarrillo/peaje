'use client'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Lo mínimo del árbol de markdown (mdast) que recorre el plugin. */
type Nodo = { type: string; value?: string; children?: Nodo[]; data?: Record<string, unknown> }

const TODO = /\[TODO:\s*[^\]]+\]/g

/**
 * Plugin de remark: cada "[TODO: ...]" del borrador sale como <mark>, para
 * que el dueño vea de un vistazo qué datos faltan. El texto queda igual.
 */
function remarkPendientes() {
  const marcar = (nodo: Nodo) => {
    if (!nodo.children) return
    const hijos: Nodo[] = []
    for (const h of nodo.children) {
      if (h.type !== 'text' || !h.value?.includes('[TODO:')) {
        marcar(h)
        hijos.push(h)
        continue
      }
      let i = 0
      for (const m of h.value.matchAll(TODO)) {
        const desde = m.index ?? 0
        if (desde > i) hijos.push({ type: 'text', value: h.value.slice(i, desde) })
        hijos.push({ type: 'pendiente', data: { hName: 'mark' }, children: [{ type: 'text', value: m[0] }] })
        i = desde + m[0].length
      }
      if (i < h.value.length) hijos.push({ type: 'text', value: h.value.slice(i) })
    }
    nodo.children = hijos
  }
  return (arbol: Nodo) => marcar(arbol)
}

/** Instrucciones o borrador como se leen: markdown con tablas. `pendientes`: resalta los [TODO] (solo en el borrador). */
export function TextoMarkdown({ texto, chico, pendientes = true }: { texto: string; chico?: boolean; pendientes?: boolean }) {
  return (
    <div
      className={`${chico ? 'text-[13px]' : 'text-sm'} leading-relaxed break-words [&_a]:text-accent [&_a]:underline [&_blockquote]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_code]:font-mono [&_code]:text-xs [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-border [&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-2 [&_pre]:mt-2 [&_pre]:overflow-x-auto [&_pre]:bg-panel-2 [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5`}
    >
      <div className="overflow-x-auto">
        <Markdown
          remarkPlugins={pendientes ? [remarkGfm, remarkPendientes] : [remarkGfm]}
          components={{
            table: (props) => <table className="mt-3 w-full border-collapse text-left" {...props} />,
            th: (props) => <th className="border border-border px-2 py-1 font-medium" {...props} />,
            td: (props) => <td className="border border-border px-2 py-1 align-top" {...props} />,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            mark: ({ children }) => (
              <mark className="rounded-sm bg-lila/30 px-0.5 font-medium text-text ring-1 ring-lila/70">{children}</mark>
            ),
          }}
        >
          {texto}
        </Markdown>
      </div>
    </div>
  )
}
