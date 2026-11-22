/**
 * Textos cortos de las páginas legales y del pie del sitio. La prosa larga de
 * cada documento vive en componentes por idioma (app/terms, app/privacy,
 * app/reembolsos), como en Puente.
 */
export const legal = {
  es: {
    // Pie del sitio (app/components/pie.tsx).
    pieNav: 'Mapa del sitio',
    pieInicio: 'Peaje, inicio',
    pieFrase: 'Que la IA te recomiende.',
    pieQueHace: (asistentes: string) =>
      `Peaje mira si ${asistentes} te recomiendan cuando alguien busca lo que vendes, y su agente te dice qué falta y te prepara el arreglo. Tú decides qué se publica.`,
    pieProducto: 'Producto',
    pieComparar: 'Comparar',
    pieRecursos: 'Recursos',
    pieLegal: 'Legal',
    // Fila "Para" (industrias): lista en pie.tsx, sin mostrarse hasta que existan esas páginas.
    piePara: 'Para',
    pieRadar: 'Radar',
    piePrecios: 'Precios',
    pieComo: 'Cómo funciona',
    pieDevelopers: 'Developers',
    pieVsPeec: 'Peaje vs Peec',
    pieVsOtterly: 'Peaje vs Otterly',
    pieVsProfound: 'Peaje vs Profound',
    pieVsSemrush: 'Peaje vs Semrush',
    pieMejoresAeo: 'Mejores herramientas de AEO 2026',
    pieBlog: 'Blog',
    pieFaq: 'Preguntas frecuentes',
    pieMcp: 'MCP',
    pieTerminos: 'Términos',
    piePrivacidad: 'Privacidad',
    pieReembolsos: 'Reembolsos',
    pieContacto: 'Contacto',
    pieDerechos: (anio: number) => `© ${anio} Peaje`,
    actualizada: 'Última actualización',

    terminosTitulo: 'Términos de servicio',
    terminosMeta:
      'Las reglas para usar Peaje: cuenta, radar, kit, agente Pro, suscripción por Paddle, cobros opcionales a agentes y responsabilidades.',
    privacidadTitulo: 'Política de privacidad',
    privacidadMeta:
      'Qué datos recoge Peaje, para qué los usa, con qué proveedores los comparte y cómo ejercer tus derechos.',
    reembolsosTitulo: 'Política de reembolso y cancelación',
    reembolsosMeta:
      'Cómo cancelar la suscripción Pro de Peaje y cuándo hay reembolso. Paddle procesa los pedidos.',
  },
  en: {
    pieNav: 'Site map',
    pieInicio: 'Peaje, home',
    pieFrase: 'Get AI to recommend you.',
    pieQueHace: (asistentes: string) =>
      `Peaje checks whether ${asistentes} recommend you when someone looks for what you sell, and its agent tells you what is missing and prepares the fix. You decide what goes live.`,
    pieProducto: 'Product',
    pieComparar: 'Compare',
    pieRecursos: 'Resources',
    pieLegal: 'Legal',
    piePara: 'For',
    pieRadar: 'Radar',
    piePrecios: 'Pricing',
    pieComo: 'How it works',
    pieDevelopers: 'Developers',
    pieVsPeec: 'Peaje vs Peec',
    pieVsOtterly: 'Peaje vs Otterly',
    pieVsProfound: 'Peaje vs Profound',
    pieVsSemrush: 'Peaje vs Semrush',
    pieMejoresAeo: 'Best AEO tools 2026',
    pieBlog: 'Blog',
    pieFaq: 'FAQ',
    pieMcp: 'MCP',
    pieTerminos: 'Terms',
    piePrivacidad: 'Privacy',
    pieReembolsos: 'Refunds',
    pieContacto: 'Contact',
    pieDerechos: (anio: number) => `© ${anio} Peaje`,
    actualizada: 'Last updated',

    terminosTitulo: 'Terms of service',
    terminosMeta:
      'The rules for using Peaje: account, radar, kit, the Pro agent, the subscription sold by Paddle, optional charging to agents and responsibilities.',
    privacidadTitulo: 'Privacy notice',
    privacidadMeta:
      'What data Peaje collects, what it uses it for, which providers it shares it with and how to exercise your rights.',
    reembolsosTitulo: 'Refund and cancellation policy',
    reembolsosMeta:
      'How to cancel the Peaje Pro subscription and when you get a refund. Paddle processes the orders.',
  },
}
