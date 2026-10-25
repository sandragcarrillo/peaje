import { Correo, H3, L, Lista, Seccion, T, X } from '../components/legal'
import { CIUDAD_ES, CONTACTO, PADDLE_PORTAL, PADDLE_TERMINOS, TITULAR } from '@/lib/legal'
import { CUPOS_FOUNDER, LIMITES, PRECIOS_USD } from '@peaje/db'

// Términos de servicio, versión en español (la que rige). Modelados sobre los
// de Puente, que Paddle ya aprobó. Describen el producto como funciona hoy:
// radar, kit, cobro opcional a agentes por HTTP 402 y el agente Pro vendido
// por Paddle. Cada cambio de producto que toque estas reglas va acá, en en.tsx
// y en la fecha de lib/legal.ts.

export function TerminosEs() {
  return (
    <>
      <Seccion>
        <p>
          Estas son las reglas para usar Peaje. Están escritas para que las entiendas de una lectura. Si algo no te
          queda claro, escríbenos antes de aceptar y te lo explicamos.
        </p>
      </Seccion>

      <Seccion id="aceptacion" titulo="1. Aceptación">
        <p>
          Al crear una cuenta o usar Peaje aceptas estos términos, la <L href="/privacy">política de privacidad</L> y
          la <L href="/reembolsos">política de reembolso y cancelación</L>, que hacen parte de este acuerdo. Si no
          estás de acuerdo, no uses el servicio.
        </p>
        <p>
          {/* TODO(San): confirmar titular; ver lib/legal.ts. */}
          El servicio lo presta <T>{TITULAR}</T>, con domicilio en {CIUDAD_ES}. En este documento nos referimos a ella
          como Peaje o nosotros, y a ti como usuario o tú.
        </p>
      </Seccion>

      <Seccion id="que-es" titulo="2. Qué es Peaje">
        <p>
          Peaje es un software como servicio, disponible en usepeaje.com, que deja un sitio web o una API listos para
          agentes de inteligencia artificial: que los encuentren, los lean y, si el dueño quiere, les paguen por pedido.
          Tiene tres partes:
        </p>
        <Lista>
          <li>
            <T>Radar</T>, gratis y sin cuenta: escribes un dominio y Peaje muestra qué encuentra un agente cuando llega,
            un puntaje de preparación para agentes y hasta dónde sube con Peaje. El puntaje lo calcula Ora, un servicio
            de medición independiente.
          </li>
          <li>
            <T>Kit</T>, gratis: un comando o un texto para tu herramienta de código que instala Peaje en tu proyecto.
            Tu sitio publica archivos que los agentes leen (llms.txt, openapi.json, un servidor MCP, agent cards,
            JSON-LD) y cada ruta puede tener un precio, incluido cero. Incluye el registro de visitas de agentes y un
            monitor diario con tareas de arreglo.
          </li>
          <li>
            <T>Agente Pro</T>, de pago: un agente de AEO (optimización para motores de respuesta) que arma un plan
            según tu objetivo, mide si ChatGPT, Claude, Perplexity y Gemini citan tu sitio, escribe borradores de
            páginas, le pasa tareas a tu herramienta de código, verifica el sitio en vivo, vuelve a medir a las 2 y a
            las 6 semanas, manda un reporte semanal por correo y conversa contigo en el dashboard y en Telegram.
          </li>
        </Lista>
        <p>
          Peaje es software: deja tu sitio listo para que los agentes de IA lo encuentren, lo lean y, si quieres, le
          paguen por pedido. Cómo funcionan esos cobros está en la sección 8.
          {/* TODO(San): antes de afirmar que Peaje no es procesador de pagos ni transmisor de dinero, revisarlo con un abogado: hoy Peaje opera wallets custodiales para los negocios (Privy) y liquida pagos por su contrato. */}
        </p>
      </Seccion>

      <Seccion id="elegibilidad" titulo="3. Elegibilidad">
        <Lista>
          <li>
            Debes tener al menos <T>dieciocho (18) años</T> y capacidad legal para obligarte.
          </li>
          <li>La información que registres debe ser veraz y estar actualizada.</li>
          <li>Si usas Peaje en nombre de un negocio u organización, declaras que tienes facultades para obligarlo.</li>
          <li>
            No puedes usar el servicio si estás en una lista de sanciones que lo impida o si una decisión previa nuestra
            canceló tu acceso.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="cuenta" titulo="4. Tu cuenta y tus sitios">
        <Lista>
          <li>
            La cuenta se crea con tu <T>correo electrónico</T>. Entras con un código que enviamos a ese correo. No hay
            contraseña.
          </li>
          <li>
            Quien tenga acceso a tu correo puede entrar a tu cuenta. Protégelo. Eres responsable de todo lo que ocurra
            desde tu cuenta.
          </li>
          <li>
            Solo registra dominios que sean tuyos o que administres con permiso de su dueño. Podemos retirar un sitio
            registrado por alguien que no lo controla.
          </li>
          <li>
            Avísanos de inmediato a <Correo email={CONTACTO} /> si crees que alguien entró a tu cuenta sin permiso.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="contenido-sitio" titulo="5. Lo que Peaje lee de tu sitio">
        <Lista>
          <li>
            Para describir tu sitio a los agentes, medir tu puntaje, escribir borradores y verificar tareas, Peaje lee
            las <T>páginas públicas</T> de los dominios que registras.
          </li>
          <li>
            El radar lee solo información pública del dominio que escribes. No entra a zonas privadas ni pide
            credenciales.
          </li>
          <li>
            Las descripciones que Peaje genera para tu sitio (por ejemplo en llms.txt, openapi.json o el servidor MCP)
            se publican en tu dominio y en el directorio de Peaje. Puedes editarlas o pedir que las retiremos.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="ia" titulo="6. Cómo trabaja la inteligencia artificial">
        <p>Esta sección importa más que las otras. Léela completa.</p>
        <Lista>
          <li>
            El agente escribe borradores y tareas <T>a partir de lo que hay en tu sitio y de lo que tú le cuentas</T>.
            Está instruido para no inventar datos sobre tu negocio.
          </li>
          <li>
            Aun así, un modelo de lenguaje puede equivocarse: malinterpretar una página, exagerar un matiz o proponer
            un cambio que no te sirve.
          </li>
          <li>
            <T>Revisa cada borrador y cada tarea antes de publicarla en tu sitio.</T> Peaje no publica cambios en tu
            sitio por su cuenta: los aplica tu herramienta de código o tú. La responsabilidad por lo que se publica en
            tu dominio es tuya.
          </li>
          <li>
            La medición de citas le hace preguntas a las interfaces de programación de cada asistente. Es una
            aproximación: la app que usa una persona puede responder distinto según su cuenta, su ubicación o su
            historial.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="uso-aceptable" titulo="7. Uso aceptable">
        <p>No puedes usar Peaje para:</p>
        <Lista>
          <li>Registrar un dominio que no controlas o suplantar a otro negocio o persona.</li>
          <li>Publicar información falsa sobre tu negocio, tus productos o tus precios.</li>
          <li>
            Vender o cobrar por bienes o servicios ilegales, o por contenido que infrinja derechos de autor, marcas o
            secretos empresariales de terceros.
          </li>
          <li>Publicar contenido difamatorio, discriminatorio, de acoso, sexual explícito o que promueva daño a personas.</li>
          <li>
            Usar el radar o el agente para raspar de forma masiva sitios de terceros, o para sobrecargarlos.
          </li>
          <li>
            Vulnerar la seguridad del servicio: pruebas de intrusión sin permiso, ingeniería inversa, uso de la
            infraestructura para otra cosa, o intentos de saltarte los límites de tu plan.
          </li>
          <li>Revender el servicio o crear un producto derivado sin nuestro acuerdo escrito.</li>
        </Lista>
        <p>No revisamos los sitios antes de que se registren. Sí actuamos cuando recibimos un reporte o detectamos un abuso.</p>
      </Seccion>

      <Seccion id="cobros-agentes" titulo="8. Cobros opcionales a agentes">
        <p>
          El kit te deja ponerle precio a una ruta de tu sitio. Cuando un agente pide esa ruta, tu sitio le responde{' '}
          <T>HTTP 402</T> con el precio y el agente decide si paga. Sobre esos cobros:
        </p>
        <Lista>
          <li>
            Son <T>opcionales</T>. Puedes usar Peaje sin cobrar nada.
          </li>
          <li>
            Son <T>independientes de la suscripción Pro</T>. Se liquidan en la red de pago que elijas, Peaje registra
            cada pago y lo acredita a la wallet de tu negocio, desde donde lo retiras.
            {/* TODO(San): confirmar cómo describir la wallet del negocio que se crea con Privy al registrarse (de quién es, quién la controla, cómo se retira). */}
          </li>
          <li>
            <T>Paddle nunca los procesa</T>. Paddle solo vende la suscripción Pro (sección 10).
          </li>
          <li>
            Peaje cobra una <T>comisión del 2%</T> de cada pago que recibe tu sitio de un agente.
          </li>
          <li>
            Tú fijas los precios y respondes por lo que vendes, por cumplir las normas que te apliquen y por los
            impuestos de esos ingresos.
          </li>
          <li>
            Los pagos de agentes quedan registrados en redes públicas de blockchain. No garantizamos
            que un agente pague ni que lo haga un número determinado de veces.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="propiedad" titulo="9. Propiedad del contenido">
        <H3>9.1 Lo tuyo es tuyo</H3>
        <p>
          Tú eres el dueño de tu sitio, de lo que escribes en Peaje y de los borradores que se generan para ti. Usar
          Peaje no nos transfiere ningún derecho de propiedad sobre tu contenido.
        </p>
        <H3>9.2 La licencia que nos das</H3>
        <p>
          Para prestarte el servicio nos concedes una licencia <T>no exclusiva, mundial, libre de regalías y
          limitada</T> para leer, almacenar, procesar, reproducir y mostrar tu contenido y el de tu sitio, con el único
          fin de operar Peaje para ti, incluido publicar tus descripciones para agentes y mostrar tu sitio en el
          directorio de Peaje.
        </p>
        <Lista>
          <li>Esa licencia no nos permite vender tu contenido ni usarlo en publicidad.</li>
          <li>No entrenamos modelos de inteligencia artificial con tu contenido.</li>
          <li>
            La licencia termina cuando borras el contenido o cierras tu cuenta, salvo por copias de respaldo que se
            purgan en los plazos normales de nuestros proveedores.
          </li>
          <li>
            Si quisiéramos usar tu caso como testimonio o ejemplo público, te pedimos permiso escrito antes. Sin ese
            permiso, no.
          </li>
        </Lista>
        <H3>9.3 Lo nuestro es nuestro</H3>
        <p>
          El software, la marca Peaje, el logotipo, el diseño y la estructura del producto son de su titular. Estos
          términos no te transfieren derechos sobre ellos, más allá del derecho de usar el servicio mientras cumplas
          este acuerdo. Los paquetes que instalas en tu proyecto (@peaje/next, @peaje/proxy y @peaje/cli) se publican con licencia MIT.
        </p>
      </Seccion>

      <Seccion id="planes" titulo="10. Planes, suscripción y pagos">
        <H3>10.1 Los planes</H3>
        <Lista>
          <li>
            <T>Gratis</T>: radar, kit, rutas con precio, registro de visitas, monitor diario y sus tareas de arreglo.
          </li>
          <li>
            <T>Pro founder</T>: <T>US${PRECIOS_USD.founder} al mes</T>, solo para los primeros {CUPOS_FOUNDER}{' '}
            negocios que se suscriben. Incluye {LIMITES.founder.preguntas} preguntas medidas en asistentes de IA y{' '}
            {LIMITES.founder.mensajes} mensajes al agente por mes. Quien entra como founder mantiene ese precio mientras su suscripción siga activa; si la cancela y vuelve, paga el precio Pro.
            {/* TODO(San): definir si el precio founder se mantiene si la persona cancela y vuelve a suscribirse. */}
          </li>
          <li>
            <T>Pro</T>: <T>US${PRECIOS_USD.pro} al mes</T> cuando se toman los cupos founder. Incluye{' '}
            {LIMITES.pro.preguntas} preguntas medidas y {LIMITES.pro.mensajes} mensajes al agente por mes.
          </li>
        </Lista>
        <p>
          La suscripción es por sitio. Los límites se cuentan por mes. El precio vigente y los impuestos de tu país
          aparecen en el formulario de pago antes de confirmar la compra. Podemos ajustar precios y límites con aviso
          previo; un cambio de precio aplica desde la siguiente renovación. El detalle está en{' '}
          <L href="/precios">precios</L>.
        </p>

        <H3>10.2 Cómo se cobra</H3>
        <Lista>
          <li>
            Nuestro proceso de pedido lo realiza nuestro revendedor en línea <T>Paddle.com</T>. Paddle.com es el{' '}
            <T>Merchant of Record</T> (vendedor registrado) de todos nuestros pedidos: Paddle te vende la suscripción,
            procesa el pago, calcula y declara los impuestos que correspondan a tu país y emite la factura. Paddle
            atiende las consultas de servicio al cliente sobre esos pedidos y gestiona las devoluciones.
          </li>
          <li>
            Paddle vende <T>solo la suscripción Pro</T>, que es software como servicio. Los cobros opcionales a
            agentes de la sección 8 no pasan por Paddle.
          </li>
          <li>
            <T>Peaje nunca ve ni guarda los datos de tu tarjeta</T>. Los recibe Paddle directamente en su formulario.
          </li>
          <li>
            A esa compra le aplican también los <X href={PADDLE_TERMINOS}>términos de compra de Paddle</X>. Si algo de
            estos términos los contradice en lo relativo al pago, mandan los de Paddle.
          </li>
          <li>
            La suscripción se cobra <T>cada mes</T> y se <T>renueva automáticamente</T> por el precio vigente hasta
            que la canceles. Paddle te envía el recibo de cada cobro al correo de la compra.
          </li>
          <li>
            {/* TODO(San): cuando exista el botón "Gestionar suscripción" en el dashboard, nombrarlo acá. */}
            Cancelas cuando quieras desde el enlace del recibo de Paddle o en{' '}
            <X href={PADDLE_PORTAL}>paddle.net</X>, donde también cambias el medio de pago y descargas tus facturas.
            También puedes escribirnos y la cancelamos por ti. Al cancelar conservas Pro hasta el final del período ya
            pagado y después el sitio pasa al plan gratis.
          </li>
          <li>
            Si un cobro de renovación falla, Paddle te avisa por correo con un enlace para actualizar el medio de pago.
            Si no se completa, la suscripción termina y el sitio pasa al plan gratis.
          </li>
        </Lista>

        <H3>10.3 Cancelación y reembolsos</H3>
        <p>
          El detalle está en la <L href="/reembolsos">política de reembolso y cancelación</L>, que hace parte de
          estos términos. En resumen:
        </p>
        <Lista>
          <li>
            Si es el <T>primer pago</T> de tu suscripción y lo pides dentro de los <T>siete (7) días</T> siguientes
            al cobro, te devolvemos el importe completo, sin preguntas.
          </li>
          <li>Las renovaciones no se reembolsan, salvo error de cobro, que corregimos siempre.</li>
          <li>El reembolso lo ejecuta Paddle al medio de pago original.</li>
          <li>
            Al bajar al plan gratis, tu sitio sigue legible para agentes y tus rutas con precio siguen funcionando. Lo
            que se apaga es el agente Pro.
          </li>
          <li>
            Nada de lo anterior limita los derechos que te reconozca la ley de tu país de residencia (por ejemplo el
            desistimiento de catorce días en la Unión Europea y el Reino Unido, o el retracto de la ley colombiana).
          </li>
        </Lista>
      </Seccion>

      <Seccion id="disponibilidad" titulo="11. Disponibilidad del servicio">
        <p>
          Peaje se presta <T>tal como está</T> y sujeto a disponibilidad. Trabajamos para que funcione bien, y aun así
          puede haber interrupciones por mantenimiento, fallas de proveedores o incidentes. No garantizamos operación
          ininterrumpida ni libre de errores.
        </p>
        <Lista>
          <li>
            No garantizamos que un asistente de IA cite tu sitio, que suba tu puntaje, que lleguen visitas de agentes
            ni que los agentes paguen.
          </li>
          <li>
            Podemos cambiar, suspender o descontinuar funciones. Si descontinuamos algo importante, avisamos con
            antelación razonable.
          </li>
          <li>Mantén tu propia copia de lo que te importa. No somos un servicio de respaldo.</li>
        </Lista>
      </Seccion>

      <Seccion id="responsabilidad" titulo="12. Limitación de responsabilidad">
        <Lista>
          <li>
            No respondemos por daños indirectos, incidentales, lucro cesante, pérdida de oportunidades de negocio ni
            daño reputacional derivado del uso del servicio.
          </li>
          <li>
            No respondemos por el contenido que publiques en tu sitio, por los cambios que aplique tu herramienta de
            código, ni por lo que hagan los agentes o los asistentes de IA de terceros.
          </li>
          <li>
            Nuestra responsabilidad total, por cualquier causa, se limita al{' '}
            <T>monto que hayas pagado por el servicio en los doce (12) meses anteriores</T> al hecho que originó el
            reclamo. Si usas el plan gratis, ese monto es cero.
          </li>
          <li>
            Nada en esta sección limita responsabilidades que la ley colombiana no permita limitar, como el dolo o la
            culpa grave.
          </li>
        </Lista>
        <p>
          Te comprometes a mantenernos indemnes frente a reclamos de terceros que surjan de tu sitio, de lo que vendes,
          de tu uso del servicio o de tu incumplimiento de estos términos.
        </p>
      </Seccion>

      <Seccion id="suspension" titulo="13. Suspensión y terminación">
        <Lista>
          <li>
            Puedes dejar de usar Peaje cuando quieras y pedir la eliminación de tu cuenta escribiendo a{' '}
            <Correo email={CONTACTO} />.
          </li>
          <li>
            Podemos suspender o cancelar una cuenta que viole la sección 7, que registre dominios ajenos o que ponga en
            riesgo la seguridad de la plataforma.
          </li>
          <li>
            Cuando sea razonable, te avisamos antes y te damos oportunidad de corregir. En casos graves o de riesgo
            legal, suspendemos de inmediato.
          </li>
          <li>
            Si nos pides borrar la cuenta y tienes una suscripción activa, la cancelamos antes de borrarla. Tus datos
            se eliminan según la política de privacidad.
          </li>
          <li>
            Las secciones sobre propiedad del contenido, limitación de responsabilidad y ley aplicable siguen vigentes
            después de la terminación.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="cambios" titulo="14. Cambios en estos términos">
        <p>
          Podemos actualizar estos términos cuando cambie el producto, la forma de cobro o la normativa aplicable. Si
          el cambio es sustancial, te avisamos por correo o dentro del dashboard con al menos{' '}
          <T>quince (15) días</T> de antelación. Si no estás de acuerdo, puedes cancelar y cerrar tu cuenta antes de
          que entre en vigor. Seguir usando Peaje después de esa fecha significa que aceptas la nueva versión.
        </p>
      </Seccion>

      <Seccion id="ley" titulo="15. Ley aplicable y solución de controversias">
        <Lista>
          <li>
            Estos términos se rigen por las <T>leyes de la República de Colombia</T>.
          </li>
          <li>
            Antes de cualquier acción, nos comprometemos los dos a intentar una solución directa por escrito durante{' '}
            <T>treinta (30) días</T>. Escríbenos y lo resolvemos hablando.
          </li>
          <li>Si no hay acuerdo, la controversia se somete a los jueces competentes de Bogotá, Colombia.</li>
          <li>
            Si eres consumidor, esto no afecta los derechos que te reconozcan las normas de protección al consumidor de
            tu país de residencia.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="generales" titulo="16. Disposiciones generales">
        <Lista>
          <li>
            Estos términos, la política de privacidad y la política de reembolso son el acuerdo completo entre tú y
            Peaje sobre el servicio.
          </li>
          <li>Si una cláusula resulta inválida, las demás siguen vigentes.</li>
          <li>
            No puedes transferir tu cuenta ni este acuerdo sin nuestro consentimiento. Nosotros sí podemos cederlo en
            caso de reorganización o venta del negocio, avisándote antes.
          </li>
          <li>Que no ejerzamos un derecho en un momento dado no significa que renunciemos a él.</li>
          <li>La versión en español es la que rige. La versión en inglés es una traducción de referencia.</li>
        </Lista>
      </Seccion>

      <Seccion id="contacto" titulo="17. Contacto">
        <p>
          Escríbenos a <Correo email={CONTACTO} />. Titular del servicio: {TITULAR}, {CIUDAD_ES}.
        </p>
      </Seccion>
    </>
  )
}
