/**
 * Cuánto trabajo le cuesta al dueño cada chequeo de Ora. El radar ordena los
 * arreglos por esto primero y por puntos después: lo fácil y que suma va
 * arriba, lo que depende de otros (Google, Wikipedia, OpenAI) va al final.
 *
 * - facil: un archivo, unas líneas o una página en tu propio sitio. Sale en
 *   una tarde, y casi todo lo que arregla el kit de Peaje está acá.
 * - medio: un cambio en el servidor, en el hosting o en tu servicio. Pide a
 *   alguien que programe, pero no depende de nadie de afuera.
 * - dificil: depende de terceros (buscadores, directorios, editores,
 *   aprobaciones) o de construir algo nuevo. No sale en una tarde.
 *
 * Clave: el `id` del check de Ora (mismos ids que `chequeos.ts`). Un id que
 * no está acá cuenta como medio. Sin imports: lo usan server y client.
 */

export type Esfuerzo = 'facil' | 'medio' | 'dificil'

const ESFUERZO: Record<string, Esfuerzo> = {
  // ── Discovery ──────────────────────────────────────────────────────────
  'agent-plugins-repo': 'medio', // un archivo en tu GitHub, pero antes hay que tener herramientas para agentes
  'agent-rules-repo': 'medio', // reglas en un repositorio público, que muchos negocios no tienen
  'agentic-search-specific': 'dificil', // depende de lo que indexan los buscadores
  'agentic-search-usecase': 'dificil', // que las IA te recomienden se gana con tiempo y menciones de otros
  'ai-catalog-published': 'facil', // un archivo en tu dominio
  'ard-catalog': 'facil', // un archivo en tu dominio; lo arma el kit
  'ard-entries-valid': 'facil', // completar ese mismo archivo
  'ard-trust-manifest': 'medio', // pide pruebas de identidad o certificaciones que hay que conseguir
  'brand-search-accuracy': 'dificil', // depende de Google y de cuánto se habla de tu marca
  'chatgpt-app-listed': 'dificil', // hay que construir una app y que OpenAI la apruebe
  'mcp-registry-listed': 'medio', // inscribirte en directorios de otros, con una conexión ya publicada
  'noindex-directives': 'facil', // quitar una etiqueta de tu página
  'npm-sdk-package': 'dificil', // construir y mantener una librería
  'registry-branding': 'medio', // completar fichas en directorios de otros
  'robots-ai-policy-quality': 'facil', // unas líneas en robots.txt
  'wikipedia-presence': 'dificil', // Wikipedia pide fuentes independientes y lo deciden sus editores

  // ── Accessibility ──────────────────────────────────────────────────────
  'a2a-agent-card': 'facil', // un archivo en tu dominio; lo arma el kit
  'agent-crawler-reachability': 'medio', // suele ser una regla del hosting o del firewall
  'agent-discovery-file': 'facil', // un archivo de texto; lo arma el kit
  'agent-instruction': 'facil', // unas líneas en tu guía para agentes; lo arma el kit
  'agent-mode-view': 'medio', // una vista nueva de tu sitio
  'agent-skills-index-v2': 'medio', // pide tener habilidades para agentes escritas
  'agent-ua-markdown': 'medio', // lógica en el servidor
  'api-catalog-rfc9727': 'facil', // un archivo en tu dominio; lo arma el kit
  'bot-detection': 'medio', // un ajuste en tu proveedor de protección
  'code-fence-validity': 'facil', // corregir bloques en tus textos
  'content-no-js': 'dificil', // puede pedir rehacer cómo se arma tu sitio
  'developer-portal': 'dificil', // construir un portal con registro y claves
  'docs-auth-gate': 'medio', // sacar contenido de detrás del inicio de sesión
  'json-ld': 'facil', // un bloque de datos en tu página; lo arma el kit
  'json-ld-entity-linking': 'facil', // enlaces dentro de ese mismo bloque
  'link-headers-discovery': 'medio', // configuración del servidor o del hosting
  'llms-txt-exists': 'facil', // un archivo de texto; lo arma el kit
  'llms-txt-formatting': 'facil', // ordenar ese mismo archivo
  'llms-txt-links-resolve': 'facil', // corregir enlaces en ese archivo
  'markdown-frontmatter': 'facil', // un encabezado corto en cada documento
  'markdown-link-alternate': 'medio', // pide tener la versión en texto de cada página
  'markdown-negotiation': 'medio', // lógica en el servidor
  'markdown-negotiation-vary': 'medio', // lógica en el servidor
  'markdown-url-fallback': 'medio', // una versión en texto de cada página
  'mcp-well-known-discovery': 'facil', // un archivo en tu dominio; lo arma el kit
  'metadata-completeness': 'facil', // etiquetas en el encabezado de cada página
  'modular-llms-txt': 'medio', // escribir una guía por cada sección
  'nlweb-schema-feeds': 'medio', // pide armar un listado de tu catálogo como datos
  'openapi-spec': 'facil', // un archivo que describe tu servicio; el kit lo enlaza
  'org-schema-completeness': 'facil', // tus datos de contacto en el bloque de datos
  'page-token-budget': 'medio', // acortar o dividir páginas largas
  'pricing-info': 'facil', // tus precios en un archivo de texto; lo arma el kit
  'pricing-md': 'facil', // ese mismo archivo
  'public-api-docs': 'facil', // un enlace en tu página principal
  'redirect-hygiene': 'medio', // revisar redirecciones del servidor
  'robots-agent-user-policy': 'facil', // unas líneas en robots.txt
  'schema-type-breadth': 'medio', // pide tener preguntas frecuentes, reseñas o servicios que marcar
  sitemap: 'facil', // la mayoría de las plataformas lo genera con un ajuste
  'sitemap-lastmod': 'facil', // fechas en ese mismo archivo
  'skills-sh-listed': 'medio', // publicar en un directorio de otros
  'skills-sh-quality': 'dificil', // depende de que la gente instale tus habilidades
  'trust-anchors': 'facil', // páginas de quiénes somos, contacto y privacidad

  // ── Usability ──────────────────────────────────────────────────────────
  'a2ui-support': 'dificil', // construir pantallas que se vean dentro del chat
  'agent-auth-discovery-metadata': 'medio', // pide un sistema de acceso para agentes
  'agent-auth-endpoints-reachable': 'medio', // pide un sistema de acceso para agentes
  'agent-auth-www-authenticate': 'medio', // un cambio en las respuestas de error del servidor
  'agent-friendly-404': 'medio', // la página de error responde distinto a los agentes
  'api-error-model': 'medio', // cambios en tu servicio
  'api-schema-analysis': 'medio', // cambios en tu servicio
  'api-versioning-policy': 'medio', // una política y avisos en tu servicio
  'async-job-pattern': 'medio', // cambios en tu servicio
  'auth-md-exists': 'facil', // una guía de texto; la arma el kit
  'auth-md-structure': 'facil', // ordenar esa misma guía
  'auth-md-walkthrough-simulation': 'medio', // el registro de verdad tiene que funcionar de punta a punta
  'ax-accessible-names': 'facil', // nombres en botones y enlaces
  'ax-document-structure': 'medio', // reordenar títulos y secciones de tus páginas
  'ax-form-labeling': 'facil', // etiquetas en tus formularios
  'ax-native-controls': 'medio', // cambiar controles hechos a mano por los del navegador
  'ax-tree-injection-safe': 'medio', // revisar textos ocultos en tus páginas
  'batch-endpoints': 'medio', // cambios en tu servicio
  'cli-tool': 'dificil', // construir y mantener una herramienta
  'function-calling-compat': 'medio', // cambios en tu servicio
  'graphql-async-job-pattern': 'medio', // cambios en tu servicio
  'graphql-batch-mutations': 'medio', // cambios en tu servicio
  'graphql-error-type-definition': 'medio', // cambios en tu servicio
  'graphql-pagination-pattern': 'medio', // cambios en tu servicio
  'graphql-schema-completeness': 'medio', // describir tu servicio a fondo
  'graphql-versioning-policy': 'medio', // una política y avisos en tu servicio
  'idempotency-key-support': 'medio', // cambios en tu servicio
  'json-error-responses': 'medio', // cambios en tu servicio
  'mcp-app-registry': 'dificil', // construir pantallas para ChatGPT o Claude
  'mcp-apps-ui-quality': 'dificil', // depende de tener esas pantallas
  'mcp-auth-mechanism': 'medio', // acceso en tu conexión para agentes
  'mcp-error-handling': 'medio', // cambios en tu conexión para agentes
  'mcp-multi-surface-coverage': 'dificil', // construir una segunda conexión para agentes
  'mcp-oauth-metadata': 'medio', // acceso en tu conexión para agentes
  'mcp-param-schemas': 'facil', // lo pone el gateway de Peaje
  'mcp-pkce-s256': 'medio', // acceso en tu conexión para agentes
  'mcp-resource-listing': 'facil', // lo pone el gateway de Peaje
  'mcp-resource-quality': 'medio', // escribir buen contenido para tu conexión
  'mcp-server': 'dificil', // construir una conexión para agentes
  'mcp-server-card': 'facil', // lo pone el gateway de Peaje
  'mcp-server-identity': 'facil', // lo pone el gateway de Peaje
  'mcp-tool-annotations': 'facil', // lo pone el gateway de Peaje
  'mcp-tool-descriptions': 'facil', // lo pone el gateway de Peaje
  'mcp-tool-listing': 'medio', // cambios en tu conexión para agentes
  'mcp-tool-naming': 'medio', // cambios en tu conexión para agentes
  'mcp-transport-modern': 'facil', // lo pone el gateway de Peaje
  'mcp-view-csp': 'dificil', // depende de tener pantallas para ChatGPT o Claude
  'mcp-view-domain': 'dificil', // depende de tener pantallas para ChatGPT o Claude
  'nlweb-ask': 'dificil', // construir un buscador que responde preguntas
  'nlweb-streaming': 'dificil', // depende de ese buscador
  'oauth-protected-resource': 'medio', // pide un sistema de acceso
  'oauth-support': 'dificil', // construir un sistema de acceso con permisos
  'onboarding-friction': 'medio', // simplificar tu registro
  'pagination-shape': 'medio', // cambios en tu servicio
  'pap-auth-config': 'medio', // un estándar nuevo de acceso
  'pap-cross-protocol': 'medio', // un estándar nuevo de acceso
  'pap-discovery': 'medio', // un estándar nuevo de acceso
  'pap-endpoint-enforcement': 'medio', // un estándar nuevo de acceso
  'pap-interfaces': 'medio', // un estándar nuevo de acceso
  'pap-issuer-binding': 'medio', // un estándar nuevo de acceso
  'public-api': 'dificil', // construir un servicio para que se conecten
  'rate-limit-headers': 'medio', // cambios en tu servicio
  'response-schema-coverage': 'medio', // describir tu servicio a fondo
  'rest-sdk-packages': 'dificil', // construir y mantener librerías en varios lenguajes
  'sandbox-environment': 'dificil', // construir un modo de prueba aparte
  'scoped-permissions': 'dificil', // construir permisos por tipo de acceso
  'web-bot-auth-directory': 'medio', // claves y un archivo en el servidor
  webmcp: 'medio', // código en tus páginas; pide a alguien que programe

  // ── Payments ───────────────────────────────────────────────────────────
  'acp-delegate-payment': 'dificil', // depende de procesadores y aprobaciones de otros
  'acp-support': 'dificil', // depende de OpenAI y de tu procesador de pagos
  'ap2-support': 'dificil', // depende de Google y de tu procesador de pagos
  'mpp-support': 'facil', // lo pone el gateway de Peaje
  'ucp-support': 'medio', // un archivo más tu proceso de compra conectado
  'x402-support': 'facil', // lo pone el gateway de Peaje
}

/** Todos los ids con esfuerzo propio (para pruebas y para revisar huecos). */
export const ESFUERZOS_CONOCIDOS: string[] = Object.keys(ESFUERZO)

/** El esfuerzo de un chequeo; medio si Ora manda un id que no conocemos. */
export function esfuerzoDe(id: string): Esfuerzo {
  return Object.prototype.hasOwnProperty.call(ESFUERZO, id) ? ESFUERZO[id]! : 'medio'
}

/** Para ordenar: lo fácil primero. */
export const RANGO_ESFUERZO: Record<Esfuerzo, number> = { facil: 0, medio: 1, dificil: 2 }
