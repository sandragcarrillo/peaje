import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** El texto del artículo: una columna, párrafos de 16/28 y subtítulos medianos, como x.ai/news. */
const COMPONENTES: Components = {
  h2: ({ children }) => <h2 className="mt-14 mb-4 text-2xl font-medium tracking-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-10 mb-3 text-xl font-medium tracking-tight">{children}</h3>,
  p: ({ children }) => <p className="mb-5 leading-7">{children}</p>,
  ul: ({ children }) => <ul className="mb-5 list-disc space-y-2 pl-6 leading-7">{children}</ul>,
  ol: ({ children }) => <ol className="mb-5 list-decimal space-y-2 pl-6 leading-7">{children}</ol>,
  a: ({ href, children }) => {
    const externo = /^https?:\/\//.test(href ?? '') && !/^https:\/\/(www\.)?usepeaje\.com/.test(href ?? '')
    return (
      <a href={href} className="underline decoration-border underline-offset-4 hover:decoration-text" {...(externo ? { rel: 'noopener' } : {})}>
        {children}
      </a>
    )
  },
  blockquote: ({ children }) => <blockquote className="mb-5 border-l-2 border-accent pl-4 text-muted">{children}</blockquote>,
  table: ({ children }) => (
    <div className="mb-6 overflow-x-auto">
      <table className="w-full border-collapse border border-border text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border bg-panel px-3 py-2 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-border px-3 py-2 align-top">{children}</td>,
  hr: () => <hr className="my-10 border-border" />,
  code: ({ children }) => <code className="bg-panel px-1 font-mono text-[0.9em]">{children}</code>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
}

export function Cuerpo({ markdown }: { markdown: string }) {
  return (
    <div className="text-base">
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTES}>
        {markdown}
      </Markdown>
    </div>
  )
}
