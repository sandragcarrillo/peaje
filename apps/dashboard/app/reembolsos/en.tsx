import { Correo, L, Lista, Seccion, T, X } from '../components/legal'
import { CIUDAD_EN, CONTACTO, PADDLE_PORTAL, PADDLE_TERMINOS, TITULAR } from '@/lib/legal'
import { DIAS_PRUEBA } from '@peaje/db'

// Refund and cancellation policy, English version. Translation of es.tsx,
// which governs. Keep both in sync and update the date in lib/legal.ts.

export function ReembolsosEn() {
  return (
    <>
      <Seccion>
        <p>
          Peaje Pro is a monthly subscription that renews automatically until you cancel it. This page explains
          how to cancel and when we refund your money. The service is provided by <T>{TITULAR}</T>, owner of
          Peaje (usepeaje.com); the <L href="/terms">terms</L> and the <L href="/privacy">privacy notice</L> complete
          this document.
        </p>
      </Seccion>

      <Seccion id="trial" titulo="1. No free trial">
        <Lista>
          <li>
            Peaje Pro <T>has no free trial</T>. The radar and the kit are always free, with no subscription.
          </li>
          <li>
            If you subscribe and Pro is not for you, your <T>first payment is fully refunded</T> if you ask within 14
            days (section 3).
          </li>
        </Lista>
      </Seccion>

      <Seccion id="cancel" titulo="2. How to cancel">
        <Lista>
          <li>
            {/* TODO(San): once the dashboard has a "Manage subscription" button, name it here. */}
            Open the link in the receipt Paddle emailed you, or go to <X href={PADDLE_PORTAL}>paddle.net</X> with the
            email you paid with. There you can cancel, change your payment method or download invoices.
          </li>
          <li>
            If something gets in the way, write to <Correo email={CONTACTO} /> and we cancel it for you.
          </li>
        </Lista>
        <p>
          When you cancel <T>you keep Pro until the end of the period you already paid for</T>. Then the site moves to
          the free plan: it stays readable by agents, the kit stays installed and your priced routes keep working. What
          turns off is the Pro agent. Cancelling the subscription does not delete your account. If you ask us to delete
          your account and you have an active subscription, we cancel it before deleting the account.
        </p>
      </Seccion>

      <Seccion id="refunds" titulo="3. Refunds">
        <p>
          Our order process is conducted by our online reseller Paddle.com. Paddle.com is the{' '}
          <T>Merchant of Record</T> for all our orders. Paddle provides all customer service inquiries and handles
          returns. Our policy:
        </p>
        <Lista>
          <li>
            <T>First payment, 14 days, no questions asked.</T> If it is the first charge of your subscription and you
            ask for a refund within <T>fourteen (14) days</T> of that charge, we refund the full amount. You do not need
            to explain why.
          </li>
          <li>
            <T>Renewals.</T> Renewal charges are not refunded. To avoid paying for a month you will not use, cancel
            before the renewal date, which is always shown in the Paddle portal.
          </li>
          <li>
            <T>Billing errors.</T> A double charge, a charge after you cancelled or a charge for an amount different from
            the one advertised is always fixed, with no time limit. Write to us with the receipt.
          </li>
          <li>
            <T>How to ask.</T> Write to <Correo email={CONTACTO} /> from the email you paid with, or ask Paddle from the
            link in your receipt (or at <X href={PADDLE_PORTAL}>paddle.net</X>). We answer within 48 business hours.
          </li>
          <li>
            <T>How it arrives.</T> Paddle issues the refund to the original payment method. Paddle processes it within a
            few days; when it shows up depends on your bank, usually 5 to 10 business days. When we refund, the
            subscription is cancelled and the site moves to the free plan right away.
          </li>
        </Lista>
        <p>
          The <X href={PADDLE_TERMINOS}>Paddle buyer terms</X> also apply to these purchases. None of this limits the
          rights the law of your country of residence gives you: for example, the fourteen (14) day withdrawal right for
          consumers in the European Union and the United Kingdom, or the retraction right under Colombian law. Paddle
          applies those rights under its own refund policy.
        </p>
      </Seccion>

      <Seccion id="not-covered" titulo="4. What this policy does not cover">
        <p>
          The optional charges your site makes to agents over HTTP 402 are separate from the Pro subscription. They are
          credited to your business wallet and Paddle never processes them, so this policy does not
          apply to them. The rules for those charges are in section 8 of the <L href="/terms">terms</L>.
        </p>
      </Seccion>

      <Seccion id="contact" titulo="5. Contact">
        <p>
          Any question about a charge: <Correo email={CONTACTO} />. Service owner: {TITULAR}, {CIUDAD_EN}. The Spanish
          version of this policy governs.
        </p>
      </Seccion>
    </>
  )
}
