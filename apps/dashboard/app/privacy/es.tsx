import { Correo, H3, L, Lista, Seccion, T } from '../components/legal'
import { CIUDAD_ES, CONTACTO, TITULAR } from '@/lib/legal'

// Política de privacidad, versión en español (la que rige). Modelada sobre la
// de Puente. Describe lo que el código hace hoy: cada dato y cada proveedor
// listado acá sale del repo (packages/db/src/types.ts, apps/gateway,
// apps/dashboard). Si se suma o se quita un proveedor, se cambia acá, en en.tsx
// y en la fecha de lib/legal.ts.

export function PrivacidadEs() {
  return (
    <>
      <Seccion>
        <p>
          Peaje deja tu sitio listo para agentes de IA. Para eso maneja datos de tu cuenta, lee el contenido de tu
          sitio y registra lo que los agentes hacen cuando llegan. Este documento explica qué guardamos, por qué, con
          quién lo compartimos y cómo pedirnos que lo borremos.
        </p>
      </Seccion>

      <Seccion id="responsable" titulo="1. Responsable del tratamiento">
        <p>
          {/* TODO(San): confirmar titular; ver lib/legal.ts. */}
          La responsable del tratamiento de tus datos personales es <T>{TITULAR}</T>, con domicilio en {CIUDAD_ES},
          titular del servicio Peaje (usepeaje.com).
        </p>
        <p>
          Correo de contacto para cualquier tema de datos personales: <Correo email={CONTACTO} />.
        </p>
        <p>
          Esta política se rige por la Ley 1581 de 2012, el Decreto 1377 de 2013 y las demás normas colombianas de
          protección de datos personales.
        </p>
      </Seccion>

      <Seccion id="alcance" titulo="2. A quién le aplica esta política">
        <Lista>
          <li>
            <T>Usuarios de Peaje</T>: personas que crean una cuenta y registran uno o más sitios.
          </li>
          <li>
            <T>Personas que usan el radar</T>: quienes escriben un dominio y su correo para ver el resultado.
          </li>
          <li>
            <T>Quien hace pedidos a un sitio con Peaje</T>: agentes, bots y programas cuyas solicitudes pasan por
            Peaje (sección 9).
          </li>
        </Lista>
      </Seccion>

      <Seccion id="datos" titulo="3. Qué datos recogemos">
        <H3>3.1 Tu cuenta y tus sitios</H3>
        <Lista>
          <li>
            <T>Correo electrónico</T>. Es el dato que usas para entrar: te enviamos un código a ese correo. No usamos
            contraseñas.
          </li>
          <li>
            El <T>identificador de usuario de Privy</T>, el proveedor que verifica tu correo y crea la wallet de tu
            negocio, y la <T>dirección de esa wallet</T>.
          </li>
          <li>
            De cada sitio: nombre, identificador corto (slug), <T>dominio</T> y, si los agregas, logo, teléfono,
            dirección, descripción y perfiles públicos del negocio.
          </li>
          <li>El estado del plan de cada sitio (gratis, prueba, founder o Pro) y sus fechas.</li>
        </Lista>

        <H3>3.2 El contenido de tu sitio</H3>
        <Lista>
          <li>
            Las <T>páginas públicas</T> de tus dominios, que Peaje lee para describir tu sitio a los agentes, calcular
            tu puntaje, aprender el tono con el que escribes y verificar tareas.
          </li>
          <li>
            Lo que Peaje genera a partir de eso: descripciones para agentes, el plan, los borradores de página, las
            tareas, las preguntas que medimos en asistentes de IA y sus resultados, los reportes y las pruebas de
            comprador misterioso.
          </li>
        </Lista>

        <H3>3.3 Radar</H3>
        <Lista>
          <li>
            Cuando usas el radar guardamos tu <T>correo</T>, el <T>dominio</T> que revisaste, el idioma, la fecha del
            último reporte que te enviamos y si <T>aceptaste recibir consejos</T> por correo (casilla opcional, sin
            marcar por defecto). Guardamos tu correo en una cookie para no pedírtelo en cada revisión.
          </li>
          <li>
            Tu dirección IP se usa solo en memoria para limitar intentos seguidos. No la guardamos.
          </li>
        </Lista>

        <H3>3.4 Visitas de agentes a tu sitio</H3>
        <p>
          Por cada solicitud que pasa por Peaje registramos la ruta, el método, el <T>agente de usuario</T> (el nombre
          con el que se identifica el programa, por ejemplo GPTBot), el tipo de agente, la respuesta, si pagó, el monto,
          la red y la hora. <T>No guardamos la dirección IP</T> de quien hace la solicitud. Estos registros los ves tú,
          dueño del sitio.
        </p>

        <H3>3.5 Pagos de agentes y retiros</H3>
        <p>
          Si cobras a agentes, guardamos un registro de cada pago: la ruta, el monto, la comisión, la red, la{' '}
          <T>dirección de wallet del agente</T> y la referencia de la transacción. De cada retiro guardamos el monto, la
          wallet de destino y la referencia. Estas transacciones quedan además registradas en redes públicas de
          blockchain, que cualquiera puede consultar.
        </p>

        <H3>3.6 Conversación con el agente</H3>
        <p>
          Los <T>mensajes</T> que le escribes al agente Pro y sus respuestas, en el dashboard, en Telegram o en Slack,
          con el canal por el que llegaron.
        </p>

        <H3>3.7 Telegram y Slack</H3>
        <Lista>
          <li>
            Si conectas <T>Telegram</T>: el identificador del chat, tu nombre de usuario de Telegram y el idioma.
          </li>
          <li>
            Si conectas <T>Slack</T>: el identificador y el nombre del espacio de trabajo, el canal, el usuario que
            instaló la app y el token del bot, que guardamos cifrado.
          </li>
          <li>Si programas reportes: el canal, el destino (correo o chat), la frecuencia y la zona horaria.</li>
        </Lista>

        <H3>3.8 Suscripción</H3>
        <p>
          {/* TODO(San): cuando se integre Paddle, listar los identificadores de Paddle que se guardan (cliente, suscripción). */}
          Guardamos el estado de tu plan y su fecha de vencimiento. <T>No</T> recibimos ni almacenamos números de
          tarjeta, códigos de seguridad ni datos bancarios: el pago de la suscripción Pro lo procesa Paddle (sección 7).
        </p>

        <H3>3.9 Qué no recogemos</H3>
        <Lista>
          <li>
            No pedimos datos sensibles: salud, origen étnico, orientación sexual, creencias religiosas, afiliación
            política o sindical, datos biométricos. Si los escribes en el chat, quedan bajo tu control y puedes pedir
            que los borremos.
          </li>
          <li>No guardamos direcciones IP de usuarios ni de visitantes.</li>
          <li>No usamos cookies de rastreo, de publicidad ni de terceros (sección 13).</li>
        </Lista>
      </Seccion>

      <Seccion id="finalidades" titulo="4. Para qué usamos tus datos">
        <Lista>
          <li>
            <T>Darte el servicio</T>: crear tu cuenta, autenticarte, generar el kit de tu sitio, mostrarte el radar y
            las visitas, y operar el agente Pro.
          </li>
          <li>
            <T>Registrar los pagos</T> que tu sitio recibe de agentes y procesar tus retiros.
          </li>
          <li>
            <T>Administrar tu suscripción</T> y aplicar los límites de cada plan.
          </li>
          <li>
            <T>Avisarte</T> por correo, Telegram o Slack: alertas del monitor, reporte semanal y resultados del radar.
          </li>
          <li>
            <T>Enviarte consejos</T> para que los agentes te encuentren, solo si lo aceptaste en el radar.
          </li>
          <li>
            <T>Responder tus mensajes</T> de soporte.
          </li>
          <li>
            <T>Cumplir obligaciones legales</T> y <T>mantener el servicio seguro</T>: prevenir abuso, fraude y uso
            automatizado.
          </li>
        </Lista>
        <p>No vendemos tus datos. No los alquilamos. No los cedemos a anunciantes ni a corredores de datos.</p>
      </Seccion>

      <Seccion id="base-legal" titulo="5. Base legal y autorización">
        <p>
          Tratamos tus datos con tu <T>autorización previa, expresa e informada</T>, que nos das al crear tu cuenta o
          al usar el radar y aceptar esta política. También nos apoyamos en la <T>ejecución del contrato</T>, el{' '}
          <T>cumplimiento de obligaciones legales</T> aplicables en Colombia y nuestro <T>interés legítimo</T> en
          mantener el servicio seguro y funcionando.
        </p>
        <p>
          Puedes revocar tu autorización en cualquier momento, salvo cuando una norma o el contrato exijan conservar el
          dato. La revocación no afecta lo que hicimos antes de ella.
        </p>
      </Seccion>

      <Seccion id="ia" titulo="6. Cómo usamos inteligencia artificial">
        <Lista>
          <li>
            Usamos modelos de lenguaje para describir tu sitio, armar el plan, escribir borradores y tareas, y conversar
            contigo.
          </li>
          <li>
            Para medir si te citan, le hacemos preguntas a ChatGPT, Claude, Perplexity y Gemini. Esos asistentes
            reciben las preguntas, no tu correo ni los datos de tu cuenta.
          </li>
          <li>
            <T>No entrenamos modelos con tu contenido</T>. Los proveedores de IA procesan los datos bajo sus términos
            para interfaces de programación.
          </li>
          <li>No tomamos decisiones automatizadas con efectos jurídicos sobre ti.</li>
        </Lista>
      </Seccion>

      <Seccion id="encargados" titulo="7. Con quién compartimos datos">
        <p>
          Compartimos datos solo con proveedores que necesitamos para operar el servicio. Cada uno trata los datos por
          nuestra instrucción y está obligado a protegerlos. Esta es la lista completa a la fecha de esta política:
        </p>
        <Lista>
          <li>
            <T>Supabase</T>: base de datos. Es donde viven tu cuenta, tus sitios, las visitas, los pagos y la
            conversación con el agente.
          </li>
          <li>
            <T>Vercel</T>: aloja el sitio web y el dashboard (usepeaje.com).
          </li>
          <li>
            <T>Railway</T>: aloja el gateway (api.usepeaje.com), por donde pasan las solicitudes de agentes y donde
            corre el agente Pro.
          </li>
          <li>
            <T>Privy</T>: envía el código de acceso a tu correo, verifica tu identidad y crea y administra la wallet
            de tu negocio. Recibe tu correo.
          </li>
          <li>
            <T>Resend</T>: envía los correos operativos (resultados del radar, alertas, reporte semanal y consejos si
            los aceptaste). Recibe tu correo y el contenido del aviso.
          </li>
          <li>
            <T>Anthropic (Claude)</T>: genera las descripciones, el plan, los borradores, las tareas y las respuestas
            del agente a partir del contenido de tu sitio y de tus mensajes. También responde preguntas para medir
            citas.
          </li>
          <li>
            <T>OpenAI</T>, <T>Perplexity</T> y <T>Google (Gemini)</T>: responden las preguntas con las que medimos si
            citan tu sitio.
          </li>
          <li>
            <T>Ora</T>: calcula el puntaje de preparación para agentes. Recibe el dominio que se revisa.
          </li>
          <li>
            <T>Telegram</T> y <T>Slack</T>: solo si los conectas, para conversar con el agente y recibir reportes.
            Reciben los mensajes que intercambias con el agente por ese canal.
          </li>
          <li>
            <T>Paddle</T>: vende la suscripción Pro como vendedor registrado (Merchant of Record): procesa el pago,
            calcula y declara los impuestos de tu país y emite la factura. Recibe tu correo, tu país y tu medio de pago
            directamente en su formulario; Peaje nunca ve los datos de tu tarjeta. A ese pago le aplican también los
            términos y la política de privacidad de Paddle.
          </li>
        </Lista>
        <p>
          También podemos entregar datos a autoridades cuando exista una solicitud legal válida, y a asesores legales o
          contables cuando sea necesario para defender un derecho. Si sumamos o cambiamos un proveedor que trate datos
          personales, actualizamos esta lista y la fecha del documento.
        </p>
      </Seccion>

      <Seccion id="transferencias" titulo="8. Transferencias internacionales">
        <p>
          Los proveedores de la sección 7 operan servidores fuera de Colombia, principalmente en Estados Unidos y en la
          Unión Europea. Eso significa que tus datos se transfieren y se procesan en el exterior. Al aceptar esta
          política autorizas esa transferencia.
        </p>
      </Seccion>

      <Seccion id="visitantes" titulo="9. Quien hace pedidos a un sitio con Peaje">
        <Lista>
          <li>
            Registramos los datos de la sección 3.4 por cuenta del dueño del sitio, que los ve en su dashboard. Frente
            a esos datos, el dueño del sitio es responsable y Peaje actúa como encargado.
          </li>
          <li>
            <T>No guardamos la dirección IP</T> de quien hace la solicitud. Sí la usamos en memoria, por un momento,
            para limitar el exceso de pedidos.
          </li>
          <li>
            Si un agente paga, la dirección de su wallet queda en el registro del pago y en la red pública donde se
            hizo.
          </li>
        </Lista>
        <p>
          Nuestros proveedores de alojamiento pueden conservar registros técnicos propios, con direcciones IP, por
          períodos cortos y con fines de seguridad y diagnóstico. Eso ocurre en su infraestructura y se rige por sus
          políticas.
        </p>
      </Seccion>

      <Seccion id="retencion" titulo="10. Por cuánto tiempo guardamos tus datos">
        <Lista>
          <li>
            <T>Tu cuenta, tus sitios y su contenido</T>: mientras tengas la cuenta activa.
          </li>
          <li>
            <T>Visitas de agentes</T>: mientras exista el sitio que las recibió.
          </li>
          <li>
            <T>Conversación con el agente</T>: mientras exista el sitio. Puedes pedirnos que la borremos sin borrar el
            resto.
          </li>
          <li>
            <T>Radar</T>: hasta que pidas que te saquemos. Si aceptaste consejos, puedes retirar ese permiso cuando quieras.
          </li>
          <li>
            <T>Registros de pagos, retiros y facturación</T>: por el término que exija la ley colombiana.
          </li>
        </Lista>
        <p>
          Cuando pides eliminar tu cuenta, borramos tus datos de nuestros sistemas en un plazo máximo de{' '}
          <T>treinta (30) días calendario</T>, salvo lo que debamos conservar por obligación legal. Lo que ya quedó en
          una red pública de blockchain no se puede borrar.
        </p>
      </Seccion>

      <Seccion id="seguridad" titulo="11. Seguridad">
        <Lista>
          <li>Los datos viajan cifrados en tránsito y se almacenan cifrados en reposo en nuestros proveedores.</li>
          <li>Los tokens de Slack se guardan cifrados.</li>
          <li>Las claves de servicio solo existen en el servidor y nunca se exponen en el navegador.</li>
        </Lista>
        <p>
          Ningún sistema es infalible. Si ocurre un incidente que afecte tus datos personales, te avisamos y
          notificamos a la autoridad competente en los términos de la ley.
        </p>
      </Seccion>

      <Seccion id="derechos" titulo="12. Tus derechos">
        <p>Como titular de datos personales, la ley colombiana te reconoce estos derechos:</p>
        <Lista>
          <li>
            <T>Conocer</T> qué datos tuyos tenemos y <T>acceder</T> a ellos de forma gratuita.
          </li>
          <li>
            <T>Actualizar y rectificar</T> los datos que estén incompletos, inexactos o desactualizados.
          </li>
          <li>
            <T>Suprimir</T> tus datos cuando no exista un deber legal o contractual de conservarlos.
          </li>
          <li>
            <T>Revocar la autorización</T> que nos diste.
          </li>
          <li>
            <T>Solicitar prueba</T> de la autorización que otorgaste.
          </li>
          <li>
            <T>Ser informado</T> sobre el uso que le hemos dado a tus datos.
          </li>
          <li>
            <T>Presentar quejas</T> ante la Superintendencia de Industria y Comercio por infracciones a la ley de
            protección de datos.
          </li>
        </Lista>
        <H3>Cómo ejercerlos</H3>
        <p>
          Escribe a <Correo email={CONTACTO} /> desde el correo de tu cuenta, con tu nombre, el derecho que quieres
          ejercer y lo que necesitas. Si escribes desde otro correo te pedimos verificar tu identidad antes de actuar.
        </p>
        <Lista>
          <li>
            <T>Consultas</T>: respondemos en máximo diez (10) días hábiles. Si no alcanzamos, te informamos y usamos
            hasta cinco (5) días hábiles adicionales.
          </li>
          <li>
            <T>Reclamos</T>: respondemos en máximo quince (15) días hábiles. Si no alcanzamos, te informamos y usamos
            hasta ocho (8) días hábiles adicionales.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="cookies" titulo="13. Cookies y almacenamiento local">
        <p>
          usepeaje.com <T>no usa cookies de rastreo, de publicidad ni de terceros</T>. No tenemos píxeles de redes
          sociales ni herramientas de analítica externas. Usamos solo lo necesario para que funcione:
        </p>
        <Lista>
          <li>
            Una cookie de <T>sesión</T> para que no tengas que pedir un código en cada visita. Se borra al salir.
          </li>
          <li>
            Una cookie con tu <T>idioma</T> y, si usaste el radar, otra con tu <T>correo</T> para no pedírtelo de
            nuevo.
          </li>
          <li>
            <T>Almacenamiento local</T> del navegador para recordar el tema claro u oscuro. Ese dato no sale de tu
            equipo.
          </li>
          <li>
            Privy, al entrar, puede guardar en tu navegador lo que necesita para verificar tu correo, según su propia
            política.
          </li>
          <li>
            Cuando pagas Pro, el formulario de Paddle puede usar sus propias cookies para completar la compra y
            prevenir fraude, según la política de Paddle.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="menores" titulo="14. Menores de edad">
        <p>
          Peaje es un servicio para mayores de dieciocho (18) años. No recogemos datos de menores a sabiendas. Si
          detectamos una cuenta de un menor, la eliminamos junto con sus datos.
        </p>
      </Seccion>

      <Seccion id="comunicaciones" titulo="15. Comunicaciones que te enviamos">
        <Lista>
          <li>
            <T>Operativas</T>: código de acceso, avisos de tu cuenta, de tu sitio y de tu suscripción. Hacen parte del
            servicio mientras tengas cuenta.
          </li>
          <li>
            <T>Del agente Pro</T>: alertas del monitor y reporte semanal, por correo, Telegram o Slack según lo que
            configures.
          </li>
          <li>
            <T>Consejos</T>: solo si marcaste la casilla en el radar. Cada envío trae cómo darte de baja.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="cambios" titulo="16. Cambios a esta política">
        <p>
          Podemos actualizar esta política cuando cambie el producto o la normativa. Cuando el cambio sea sustancial,
          te avisamos por correo o en el dashboard antes de que entre en vigor. La fecha de última actualización está
          al inicio y al final del documento. Seguir usando Peaje después de un cambio significa que lo aceptas.
        </p>
      </Seccion>

      <Seccion id="contacto" titulo="17. Contacto">
        <p>
          Cualquier duda, solicitud o reclamo sobre tus datos personales: <Correo email={CONTACTO} />. Responsable:{' '}
          {TITULAR}, {CIUDAD_ES}.
        </p>
        <p>
          Si consideras que no atendimos bien tu solicitud, puedes acudir a la Superintendencia de Industria y Comercio
          de Colombia. Las reglas de uso del servicio están en los <L href="/terms">términos</L>.
        </p>
      </Seccion>
    </>
  )
}
