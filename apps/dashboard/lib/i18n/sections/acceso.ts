export const acceso = {
  es: {
    // --- /acceder ---
    entrando: 'Entrando…',
    tituloEntrar: 'Entrar',
    subtituloEntrar: 'Con tu email. No hay usuarios ni contraseñas.',
    campoEmail: 'Email',
    placeholderEmail: 'tu@tunegocio.com',
    enviando: 'Enviando…',
    enviarCodigo: 'Enviar código',
    botonEntrar: 'Entrar',
    verificando: 'Verificando…',
    registrarEsteNegocio: 'Registrar este negocio',

    // --- paso de código (compartido /acceder y /nuevo) ---
    revisaTuEmail: 'Revisa tu email',
    codigoEnviadoA: 'Te mandamos un código a',
    campoCodigo: 'Código',
    placeholderCodigo: '123456',

    // --- errores de cliente ---
    errorFaltaEmail: 'Falta tu email.',
    errorEnvioCodigo: 'No pudimos enviar el código. Revisa el email.',
    errorSesionVieja: 'Había una sesión vieja de Privy. La limpiamos: pide un código nuevo.',
    errorCodigoInvalidoPideOtro: 'Código inválido o vencido. Pide uno nuevo e intenta de nuevo.',
    errorCodigoInvalido: 'Código inválido o vencido. Intenta de nuevo.',
    errorIngresoFallo: 'El código era válido pero falló el ingreso. Intenta de nuevo.',

    // --- errores de servidor (/acceder/actions, /nuevo/actions) ---
    errorSesionNoVerificada: 'No pudimos verificar tu sesión. Intenta de nuevo.',
    errorSinNegocio: 'No hay ningún negocio registrado con ese email.',
    errorServidorEntrar: 'Error del servidor al entrar. Intenta de nuevo.',
    errorFaltaNombre: 'Falta el nombre del negocio.',
    errorFaltaUrl: 'Falta la URL de tu sitio web.',
    errorVerificaEmail: 'Verifica tu email antes de continuar.',
    errorUrlInvalida: 'Esa URL no parece válida. Ejemplo: https://tunegocio.com',
    errorNombreSinIdentificador: 'El nombre no genera un identificador válido.',
    errorSlugTomado: (slug: string) => `Ya hay un negocio registrado como "${slug}".`,

    // --- /nuevo ---
    tituloRegistrar: 'Registra tu negocio',
    subtituloRegistrar:
      'Con tu email creamos tu wallet de cobro automáticamente. Nada de API keys para copiar.',
    campoNombre: 'Nombre del negocio',
    placeholderNombre: 'Clima Andino',
    campoUrl: 'URL de tu sitio web',
    placeholderUrl: 'https://tunegocio.com',
    ayudaUrl: 'Tu web de siempre. Peaje le pone el cobro delante, no la cambia.',
    campoTuEmail: 'Tu email',
    ayudaEmail: 'Ahí te mandamos el código para entrar. También es donde cae tu identidad de cobro.',
    enviandoCodigo: 'Enviando código…',
    verificarYCrear: 'Verificar y crear gateway',

    // --- /nuevo, pantalla final ---
    listoTitulo: 'Listo. Tu gateway está arriba.',
    tuSaldo: 'Tu saldo',
    etiquetaCuenta: 'Cuenta',
    copiado: 'Copiado',
    copiar: 'Copiar',
    recibirasPagos: 'Acá vas a recibir los pagos de los agentes.',
    etiquetaEndpoint: 'Endpoint',
    placeholderRuta: 'tu-ruta',
    agentesConsumen: 'Los agentes consumen tu website por aquí.',
    sinRutasTodavia: 'Todavía no tienes rutas. Comienza el onboarding para crearlas.',
    empezarConScore: 'Empezar: mira tu score',

    // --- /negocios ---
    tusNegocios: 'Tus negocios',
    eligeNegocio: 'Elige a cuál entrar.',
    registrarOtro: '+ Registrar otro negocio',
  },
  en: {
    // --- /acceder ---
    entrando: 'Signing in…',
    tituloEntrar: 'Sign in',
    subtituloEntrar: 'With your email. No usernames, no passwords.',
    campoEmail: 'Email',
    placeholderEmail: 'you@yourbusiness.com',
    enviando: 'Sending…',
    enviarCodigo: 'Send code',
    botonEntrar: 'Sign in',
    verificando: 'Verifying…',
    registrarEsteNegocio: 'Register this business',

    // --- paso de código (compartido /acceder y /nuevo) ---
    revisaTuEmail: 'Check your email',
    codigoEnviadoA: 'We sent a code to',
    campoCodigo: 'Code',
    placeholderCodigo: '123456',

    // --- errores de cliente ---
    errorFaltaEmail: 'Enter your email.',
    errorEnvioCodigo: 'We could not send the code. Check the email address.',
    errorSesionVieja: 'There was an old Privy session. We cleared it: request a new code.',
    errorCodigoInvalidoPideOtro: 'Invalid or expired code. Request a new one and try again.',
    errorCodigoInvalido: 'Invalid or expired code. Try again.',
    errorIngresoFallo: 'The code was valid but sign-in failed. Try again.',

    // --- errores de servidor (/acceder/actions, /nuevo/actions) ---
    errorSesionNoVerificada: 'We could not verify your session. Try again.',
    errorSinNegocio: 'There is no business registered with that email.',
    errorServidorEntrar: 'Server error while signing in. Try again.',
    errorFaltaNombre: 'Enter the business name.',
    errorFaltaUrl: 'Enter your website URL.',
    errorVerificaEmail: 'Verify your email before continuing.',
    errorUrlInvalida: 'That URL does not look valid. Example: https://yourbusiness.com',
    errorNombreSinIdentificador: 'That name does not produce a valid identifier.',
    errorSlugTomado: (slug: string) => `There is already a business registered as "${slug}".`,

    // --- /nuevo ---
    tituloRegistrar: 'Register your business',
    subtituloRegistrar:
      'We create your payout wallet automatically from your email. No API keys to copy.',
    campoNombre: 'Business name',
    placeholderNombre: 'Clima Andino',
    campoUrl: 'Your website URL',
    placeholderUrl: 'https://yourbusiness.com',
    ayudaUrl: 'Your usual site. Peaje puts the charge in front of it, it does not change it.',
    campoTuEmail: 'Your email',
    ayudaEmail: 'That is where we send your sign-in code. It also holds your payout identity.',
    enviandoCodigo: 'Sending code…',
    verificarYCrear: 'Verify and create gateway',

    // --- /nuevo, pantalla final ---
    listoTitulo: 'Done. Your gateway is live.',
    tuSaldo: 'Your balance',
    etiquetaCuenta: 'Account',
    copiado: 'Copied',
    copiar: 'Copy',
    recibirasPagos: 'This is where you receive payments from agents.',
    etiquetaEndpoint: 'Endpoint',
    placeholderRuta: 'your-route',
    agentesConsumen: 'Agents reach your website through here.',
    sinRutasTodavia: 'You have no routes yet. Start the onboarding to create them.',
    empezarConScore: 'Start: check your score',

    // --- /negocios ---
    tusNegocios: 'Your businesses',
    eligeNegocio: 'Pick which one to open.',
    registrarOtro: '+ Register another business',
  },
}
