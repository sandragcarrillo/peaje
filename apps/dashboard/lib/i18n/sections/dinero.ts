export const dinero = {
  es: {
    eyebrow: 'Mi wallet',
    // Ingresos
    ingresosTitulo: 'Ingresos',
    ingresosIntro:
      'Cada pago llega a tu dirección de cobro en la misma transacción. Peaje se queda con el 2% y no guarda tu plata, así que no hay nada que retirar.',
    totalRecibido: 'Recibido',
    totalRecibidoPie: 'Neto, ya en tu wallet',
    pagosCuenta: 'Pagos',
    sinDireccionTitulo: 'Pon tu dirección de cobro',
    sinDireccion:
      'Sin dirección de cobro tus rutas no cobran: los agentes no ven ninguna forma de pagar. Ponla aquí abajo.',
    listaTitulo: 'Pagos recibidos',
    listaVacia: 'Todavía no hay pagos.',
    colFecha: 'Fecha',
    colRuta: 'Ruta',
    colRed: 'Red',
    colNeto: 'Neto',
    colLlegoA: 'Llegó a',
    verTx: 'ver tx',
    antesDelCambio: 'antes del pago directo',
    reembolsado: 'reembolsado',
    reembolsadoPorPeaje: 'Tu origen falló y Peaje le devolvió el pago al agente desde su propia caja. El neto sigue en tu wallet.',
    notaAnteriores:
      'Los pagos marcados "antes del pago directo" son de cuando Peaje guardaba el saldo. Si te queda algo ahí, escríbenos y lo pasamos a tu dirección de cobro.',
    copiar: 'Copiar',
    copiado: 'Copiado',

    // Cobros a agentes (mainnet): el negocio decide cuándo empieza a cobrar
    cobrosAvisoTitulo: 'Activa cobros a agentes',
    cobrosAvisoTexto:
      'Los agentes ya pueden pagar por lo que usen en tu sitio. Te creamos una wallet para que recibas esos pagos. Peaje se queda con el 2%; el resto es tuyo.',
    cobrosConoceMas: 'Conoce más aquí',
    cobrosArticulo: '/blog/como-le-paga-un-agente-de-ia-a-mi-sitio-y-donde-recibo-el-pago',
    cobrosSinWallet: 'Antes de activarlos, elige en Ingresos la wallet donde recibes los pagos.',
    cobrosIrAIngresos: 'Ir a Ingresos',
    cobrosTitulo: 'Cobros a agentes',
    cobrosApagados: 'Están apagados, así que los agentes usan gratis tus rutas y links con precio.',
    cobrosActivos: (desde: string | null) =>
      desde
        ? `Están activos desde el ${desde}, y cada pago llega a tu wallet en el momento, menos el 2% de Peaje.`
        : 'Están activos, y cada pago llega a tu wallet en el momento, menos el 2% de Peaje.',
    cobrosActivar: 'Activar cobros',
    cobrosActivando: 'Activando…',
    cobrosApagar: 'Apagar cobros',
    cobrosApagando: 'Apagando…',
    cobrosErrorSinWallet: 'Primero elige la wallet donde recibes los pagos.',
    cobrosErrorGenerico: 'No se pudo guardar. Prueba de nuevo.',

    // Mi wallet
    miWallet: 'Mi wallet',
    sinWalletNegocio: 'Este sitio no tiene wallet configurada.',
    walletCustodiada: 'La wallet que Peaje creó para este negocio. Los pagos nuevos llegan a tu dirección de cobro.',
    walletExterna: 'Tu dirección de cobro es externa: los pagos llegan a una cuenta que manejas tú.',
    copiada: 'Copiada',
    copiarAddress: 'Copiar address',
    saldos: 'Saldos',

    // Popover
    wallet: 'Wallet',
    cerrar: 'Cerrar',
    cargando: 'Cargando…',
    sinWallet: 'Este sitio no tiene wallet.',
    recibir: 'Recibir',
    notaRecibir: 'La misma address recibe en todas las redes: pathUSD en Tempo, USDC en Arc y Arbitrum, USDG en Arbitrum y Robinhood.',
    volver: 'Volver',
    verIngresos: 'Ver ingresos →',

    fechaLocale: 'es-CO',
  },
  en: {
    eyebrow: 'My wallet',
    // Ingresos
    ingresosTitulo: 'Revenue',
    ingresosIntro:
      'Every payment lands in your payout address in the same transaction. Peaje keeps 2% and does not hold your money, so there is nothing to withdraw.',
    totalRecibido: 'Received',
    totalRecibidoPie: 'Net, already in your wallet',
    pagosCuenta: 'Payments',
    sinDireccionTitulo: 'Set your payout address',
    sinDireccion:
      'Without a payout address your routes do not charge: agents see no way to pay. Set it below.',
    listaTitulo: 'Payments received',
    listaVacia: 'No payments yet.',
    colFecha: 'Date',
    colRuta: 'Route',
    colRed: 'Network',
    colNeto: 'Net',
    colLlegoA: 'Sent to',
    verTx: 'view tx',
    antesDelCambio: 'before direct payouts',
    reembolsado: 'refunded',
    reembolsadoPorPeaje: 'Your origin failed and Peaje refunded the agent from its own funds. The net stays in your wallet.',
    notaAnteriores:
      'Payments marked "before direct payouts" are from when Peaje held the balance. If anything is left there, write to us and we move it to your payout address.',
    copiar: 'Copy',
    copiado: 'Copied',

    // Cobros a agentes (mainnet)
    cobrosAvisoTitulo: 'Turn on payments from agents',
    cobrosAvisoTexto:
      'Agents can now pay for what they use on your site. We created a wallet for you to receive those payments. Peaje keeps 2%; the rest is yours.',
    cobrosConoceMas: 'Learn more here',
    cobrosArticulo: '/blog/how-does-an-ai-agent-pay-my-website-and-where-does-the-money-go',
    cobrosSinWallet: 'Before turning them on, choose in Revenue the wallet where you get paid.',
    cobrosIrAIngresos: 'Go to Revenue',
    cobrosTitulo: 'Payments from agents',
    cobrosApagados: 'They are off, so agents use your priced routes and links for free.',
    cobrosActivos: (desde: string | null) =>
      desde
        ? `They have been on since ${desde}, and every payment lands in your wallet right away, minus Peaje's 2%.`
        : "They are on, and every payment lands in your wallet right away, minus Peaje's 2%.",
    cobrosActivar: 'Turn on payments',
    cobrosActivando: 'Turning on…',
    cobrosApagar: 'Turn off payments',
    cobrosApagando: 'Turning off…',
    cobrosErrorSinWallet: 'First choose the wallet where you get paid.',
    cobrosErrorGenerico: 'We could not save it. Try again.',

    // Mi wallet
    miWallet: 'My wallet',
    sinWalletNegocio: 'This site has no wallet set up.',
    walletCustodiada: 'The wallet Peaje created for this business. New payments land in your payout address.',
    walletExterna: 'Your payout address is external: payments land in an account you control.',
    copiada: 'Copied',
    copiarAddress: 'Copy address',
    saldos: 'Balances',

    // Popover
    wallet: 'Wallet',
    cerrar: 'Close',
    cargando: 'Loading…',
    sinWallet: 'This site has no wallet.',
    recibir: 'Receive',
    notaRecibir: 'The same address receives on every network: pathUSD on Tempo, USDC on Arc and Arbitrum, USDG on Arbitrum and Robinhood.',
    volver: 'Back',
    verIngresos: 'View revenue →',

    fechaLocale: 'en-US',
  },
}
