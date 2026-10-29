/**
 * Qué herramienta se conectó al MCP del dueño, por el nombre con que se
 * presenta: clientInfo.name en el `initialize` (Claude Code manda
 * "claude-code", Codex "codex-mcp-client", Cursor "cursor-…") o client_name en
 * el registro OAuth ("Claude", "ChatGPT"). Se reconoce por pedazos del nombre
 * para no depender de la versión exacta.
 *
 * El orden importa: Cursor va antes que Copilot porque su nombre también trae
 * "vscode", y Codex antes que ChatGPT porque puede venir como "OpenAI Codex".
 * v0 solo por nombre entero o con guion: "v0" suelto aparece en versiones de
 * cualquier cliente ("client-v0.3").
 */
const MARCAS: [marca: string, pedazos: string[]][] = [
  ['claude', ['claude']],
  ['cursor', ['cursor']],
  ['codex', ['codex']],
  ['chatgpt', ['chatgpt', 'openai']],
  ['lovable', ['lovable']],
  ['windsurf', ['windsurf', 'codeium']],
  ['copilot', ['copilot', 'vscode', 'visual studio code']],
  ['v0', ['vercel', 'v0-', 'v0 ']],
  ['replit', ['replit']],
]

export function marcaDeCliente(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n === 'v0') return 'v0'
  return MARCAS.find(([, pedazos]) => pedazos.some((p) => n.includes(p)))?.[0] ?? 'otra'
}
