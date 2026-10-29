/**
 * Prueba de dominio para el registro oficial de MCP
 * (registry.modelcontextprotocol.io): con esto Peaje publica como
 * com.usepeaje/*. Es solo la llave pública; la privada vive fuera del repo,
 * en la máquina de quien publica (~/.config/peaje/mcp-registry-ed25519.pem).
 * El registro la pide con GET y espera un 200 directo, sin redirect.
 */
export const dynamic = 'force-static'

export function GET() {
  return new Response('v=MCPv1; k=ed25519; p=O3/dFl3221G6K+VFQrWGEOmUCoXB8QanA55RwWrW9ZY=', { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
