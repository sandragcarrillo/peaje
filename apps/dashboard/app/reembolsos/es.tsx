import { Correo, L, Lista, Seccion, T, X } from '../components/legal'
import { CIUDAD_ES, CONTACTO, PADDLE_PORTAL, PADDLE_TERMINOS, TITULAR } from '@/lib/legal'

// Política de reembolso y cancelación, versión en español (la que rige). Es la
// fuente de verdad: los términos (sección 10.3) la resumen y enlazan acá.
// Paddle exige que sea accesible desde la navegación del sitio (pie del
// layout). Reglas copiadas de la política web de Puente.
//
// Sin prueba gratis desde el 24 oct 2026 (decisión de San): el reembolso
// completo del primer pago dentro de 7 días hace de prueba (San, 24 oct 2026).

export function ReembolsosEs() {
  return (
    <>
      <Seccion>
        <p>
          Peaje Pro es una suscripción mensual que se renueva sola hasta que la cancelas. Esta página explica
          cómo cancelar y cuándo devolvemos el dinero. El servicio lo presta <T>{TITULAR}</T>, titular de
          Peaje (usepeaje.com); los <L href="/terms">términos</L> y la <L href="/privacy">política de privacidad</L>{' '}
          completan este documento.
        </p>
      </Seccion>

      <Seccion id="prueba" titulo="1. Sin prueba gratis">
        <Lista>
          <li>
            Peaje Pro <T>no tiene prueba gratis</T>. El radar y el kit son gratis siempre, sin suscripción.
          </li>
          <li>
            Si te suscribes y Pro no es para ti, el <T>primer pago tiene reembolso completo</T> si lo pides dentro de
            los 7 días (sección 3).
          </li>
        </Lista>
      </Seccion>

      <Seccion id="cancelar" titulo="2. Cómo cancelar">
        <Lista>
          <li>
            En Mi agente, sección Plan, toca <T>Gestionar suscripción</T>: abre el portal de clientes de Paddle, donde
            cancelas, cambias el medio de pago o descargas tus facturas.
          </li>
          <li>
            También puedes abrir el enlace del recibo que Paddle te mandó por correo, o entrar a{' '}
            <X href={PADDLE_PORTAL}>paddle.net</X> con el correo de la compra.
          </li>
          <li>
            Si algo no te deja, escríbenos a <Correo email={CONTACTO} /> y la cancelamos nosotros.
          </li>
        </Lista>
        <p>
          Al cancelar <T>conservas Pro hasta el final del período que ya pagaste</T>. Después el sitio pasa al plan
          gratis: sigue legible para agentes, el kit sigue instalado y tus rutas con precio siguen funcionando. Lo que se
          apaga es el agente Pro. Cancelar la suscripción no borra tu cuenta. Si nos pides borrar la cuenta y tienes una
          suscripción activa, la cancelamos antes de borrarla.
        </p>
      </Seccion>

      <Seccion id="reembolsos" titulo="3. Reembolsos">
        <p>
          Nuestro proceso de pedido lo realiza nuestro revendedor en línea Paddle.com. Paddle.com es el{' '}
          <T>Merchant of Record</T> (vendedor registrado) de todos nuestros pedidos, atiende las consultas de servicio al
          cliente sobre esos pedidos y gestiona las devoluciones. Nuestra política:
        </p>
        <Lista>
          <li>
            <T>Primer pago, 7 días, sin preguntas.</T> Si es el primer cobro de tu suscripción y pides el reembolso
            dentro de los <T>siete (7) días</T> siguientes a ese cobro, te devolvemos el importe completo. No hace
            falta que expliques por qué.
          </li>
          <li>
            <T>Renovaciones.</T> Los cobros de renovación no se reembolsan. Para no pagar un mes que no vas a usar,
            cancela antes de la fecha de renovación, que siempre está en el portal de Paddle.
          </li>
          <li>
            <T>Errores de cobro.</T> Un cobro doble, un cobro posterior a tu cancelación o un cobro por un importe
            distinto al anunciado se corrige siempre, sin plazo. Escríbenos con el recibo.
          </li>
          <li>
            <T>Cómo pedirlo.</T> Escríbenos a <Correo email={CONTACTO} /> desde el correo de la compra, o pídelo a
            Paddle desde el enlace del recibo (o en <X href={PADDLE_PORTAL}>paddle.net</X>). Respondemos en menos de 48
            horas hábiles.
          </li>
          <li>
            <T>Cómo llega.</T> El reembolso lo ejecuta Paddle al medio de pago original. Paddle lo procesa en pocos
            días; que aparezca en tu cuenta depende de tu banco, normalmente entre 5 y 10 días hábiles. Al reembolsar,
            la suscripción se cancela y el sitio pasa al plan gratis de inmediato.
          </li>
        </Lista>
        <p>
          A estas compras les aplican también los <X href={PADDLE_TERMINOS}>términos de compra de Paddle</X>. Nada de
          lo anterior limita los derechos que te reconozca la ley de tu país de residencia: por ejemplo, el derecho de
          desistimiento de catorce (14) días para consumidores de la Unión Europea y el Reino Unido, o el derecho de
          retracto de la ley colombiana. Paddle aplica esos derechos según su propia política de reembolsos.
        </p>
      </Seccion>

      <Seccion id="fuera" titulo="4. Lo que esta política no cubre">
        <p>
          Los cobros opcionales que tu sitio les hace a agentes por HTTP 402 están separados de la suscripción Pro. Se
          acreditan a la wallet de tu negocio y Paddle nunca los procesa, así que esta política no aplica
          a ellos. Las reglas de esos cobros están en la sección 8 de los <L href="/terms">términos</L>.
        </p>
      </Seccion>

      <Seccion id="contacto" titulo="5. Contacto">
        <p>
          Cualquier duda sobre un cobro: <Correo email={CONTACTO} />. Titular del servicio: {TITULAR}, {CIUDAD_ES}.
        </p>
      </Seccion>
    </>
  )
}
