import { Correo, H3, L, Lista, Seccion, T, X } from '../components/legal'
import { CIUDAD_EN, CONTACTO, PADDLE_PORTAL, PADDLE_TERMINOS, TITULAR } from '@/lib/legal'
import { CUPOS_FOUNDER, LIMITES, PRECIOS_USD } from '@peaje/db'

// Terms of service, English version. Translation of es.tsx, which governs.
// Keep both in sync and update the date in lib/legal.ts.

export function TerminosEn() {
  return (
    <>
      <Seccion>
        <p>
          These are the rules for using Peaje. They are written so you can understand them in one read. If something
          is not clear, write to us before you accept and we will explain it.
        </p>
      </Seccion>

      <Seccion id="acceptance" titulo="1. Acceptance">
        <p>
          By creating an account or using Peaje you accept these terms, the <L href="/privacy">privacy notice</L> and
          the <L href="/reembolsos">refund and cancellation policy</L>, which are part of this agreement. If you do
          not agree, do not use the service.
        </p>
        <p>
          {/* TODO(San): confirm the legal owner; see lib/legal.ts. */}
          The service is provided by <T>{TITULAR}</T>, based in {CIUDAD_EN}. In this document we call her Peaje, we
          or us, and we call you the user or you.
        </p>
      </Seccion>

      <Seccion id="what-it-is" titulo="2. What Peaje is">
        <p>
          Peaje is software as a service, available at usepeaje.com, that gets a website or an API ready for AI
          agents: they find it, read it and, if the owner wants, pay per request. It has three parts:
        </p>
        <Lista>
          <li>
            <T>Radar</T>, free and with no account: you enter a domain and Peaje shows what an agent finds when it
            arrives, an agent-readiness score and how far it goes with Peaje. The score is calculated by Ora, an
            independent measurement service.
          </li>
          <li>
            <T>Kit</T>, free: a command or a text for your coding tool that installs Peaje in your project. Your site
            publishes files that agents read (llms.txt, openapi.json, an MCP server, agent cards, JSON-LD) and every
            route can have a price, including zero. It includes a log of agent visits and a daily monitor with fix
            tasks.
          </li>
          <li>
            <T>Pro agent</T>, paid: an AEO (answer engine optimization) agent that builds a plan around your goal,
            measures whether ChatGPT, Claude, Perplexity and Gemini cite your site, writes page drafts, hands tasks to
            your coding tool, checks the live site, measures again at 2 and 6 weeks, sends a weekly report by email and
            talks with you on the dashboard and on Telegram.
          </li>
        </Lista>
        <p>
          Peaje is software: it gets your site ready for AI agents to find it, read it and, if you want, pay it per
          request. How those charges work is in section 8.
        </p>
      </Seccion>

      <Seccion id="eligibility" titulo="3. Eligibility">
        <Lista>
          <li>
            You must be at least <T>eighteen (18) years old</T> and legally able to enter into a contract.
          </li>
          <li>The information you register must be true and up to date.</li>
          <li>If you use Peaje on behalf of a business or organization, you confirm you are authorized to bind it.</li>
          <li>
            You may not use the service if you are on a sanctions list that prevents it or if an earlier decision of
            ours closed your access.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="account" titulo="4. Your account and your sites">
        <Lista>
          <li>
            The account is created with your <T>email address</T>. You sign in with a code we send to that email.
            There is no password.
          </li>
          <li>
            Anyone with access to your email can enter your account. Protect it. You are responsible for everything
            that happens from your account.
          </li>
          <li>
            Only register domains you own or manage with the owner&apos;s permission. We may remove a site registered by
            someone who does not control it.
          </li>
          <li>
            Tell us right away at <Correo email={CONTACTO} /> if you think someone entered your account without
            permission.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="site-content" titulo="5. What Peaje reads from your site">
        <Lista>
          <li>
            To describe your site to agents, measure your score, write drafts and verify tasks, Peaje reads the{' '}
            <T>public pages</T> of the domains you register.
          </li>
          <li>
            The radar reads only public information from the domain you enter. It does not enter private areas or ask
            for credentials.
          </li>
          <li>
            The descriptions Peaje generates for your site (for example in llms.txt, openapi.json or the MCP server) are
            published on your domain and in the Peaje directory. You can edit them or ask us to remove them.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="ai" titulo="6. How the artificial intelligence works">
        <p>This section matters more than the others. Read all of it.</p>
        <Lista>
          <li>
            The agent writes drafts and tasks <T>from what is on your site and what you tell it</T>. It is instructed
            not to invent facts about your business.
          </li>
          <li>
            Even so, a language model can be wrong: misread a page, overstate a detail or suggest a change that does
            not work for you.
          </li>
          <li>
            <T>Review every draft and every task before you publish it on your site.</T> Peaje does not publish
            changes on your site by itself: your coding tool or you apply them. You are responsible for what is
            published on your domain.
          </li>
          <li>
            Citation measurement asks questions through each assistant&apos;s programming interface. It is an
            approximation: the app a person uses may answer differently depending on their account, location or
            history.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="acceptable-use" titulo="7. Acceptable use">
        <p>You may not use Peaje to:</p>
        <Lista>
          <li>Register a domain you do not control or impersonate another business or person.</li>
          <li>Publish false information about your business, your products or your prices.</li>
          <li>
            Sell or charge for illegal goods or services, or for content that infringes third parties&apos; copyright,
            trademarks or trade secrets.
          </li>
          <li>Publish defamatory, discriminatory, harassing or sexually explicit content, or content that promotes harm to people.</li>
          <li>Use the radar or the agent to scrape third-party sites at scale or to overload them.</li>
          <li>
            Break the security of the service: unauthorized penetration testing, reverse engineering, using the
            infrastructure for something else, or trying to get around your plan&apos;s limits.
          </li>
          <li>Resell the service or build a derivative product without our written agreement.</li>
        </Lista>
        <p>We do not review sites before they are registered. We do act when we get a report or detect abuse.</p>
      </Seccion>

      <Seccion id="agent-payments" titulo="8. Optional charging to agents">
        <p>
          The kit lets you put a price on a route of your site. When an agent requests that route, your site answers{' '}
          <T>HTTP 402</T> with the price and the agent decides whether to pay. About these charges:
        </p>
        <Lista>
          <li>
            They are <T>optional</T>. You can use Peaje without charging anything.
          </li>
          <li>
            They are <T>separate from the Pro subscription</T>. They settle on the payment network you choose;
            each payment goes straight to your payout address in the same transaction, and Peaje keeps its 2% fee.
            Peaje does not hold a balance for you, so there is nothing to withdraw.
            {/* TODO(San): confirm with the lawyer how to describe the payout wallet created with Privy at signup (owned by the user, Peaje cannot move it) and the direct split in PeajeSettlementV3. */}
          </li>
          <li>
            <T>Paddle never processes them</T>. Paddle only sells the Pro subscription (section 10).
          </li>
          <li>
            Peaje charges a <T>2% fee</T> on each payment your site receives from an agent.
          </li>
          <li>
            You set the prices and you are responsible for what you sell, for complying with the rules that apply to
            you and for the taxes on that income.
          </li>
          <li>
            Agent payments are recorded on public blockchain networks. We do not guarantee that an agent will pay or
            that it will do so a given number of times.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="ownership" titulo="9. Content ownership">
        <H3>9.1 What is yours stays yours</H3>
        <p>
          You own your site, what you write in Peaje and the drafts generated for you. Using Peaje does not transfer to
          us any ownership of your content.
        </p>
        <H3>9.2 The license you give us</H3>
        <p>
          To provide the service you grant us a <T>non-exclusive, worldwide, royalty-free and limited</T> license to
          read, store, process, reproduce and display your content and your site&apos;s content, only to operate Peaje
          for you, including publishing your descriptions for agents and listing your site in the Peaje directory.
        </p>
        <Lista>
          <li>That license does not let us sell your content or use it in advertising.</li>
          <li>We do not train artificial intelligence models on your content.</li>
          <li>
            The license ends when you delete the content or close your account, except for backups that are purged on
            our providers&apos; normal schedules.
          </li>
          <li>
            If we want to use your case as a public testimonial or example, we ask for your written permission first.
            Without it, no.
          </li>
        </Lista>
        <H3>9.3 What is ours stays ours</H3>
        <p>
          The software, the Peaje brand, the logo, the design and the structure of the product belong to their owner.
          These terms do not give you rights over them beyond the right to use the service while you comply with this
          agreement. The packages you install in your project (@peaje/next, @peaje/proxy and @peaje/cli) are published
          under the MIT license.
        </p>
      </Seccion>

      <Seccion id="plans" titulo="10. Plans, subscription and payments">
        <H3>10.1 The plans</H3>
        <Lista>
          <li>
            <T>Free</T>: radar, kit, priced routes, agent visit log, daily monitor and its fix tasks.
          </li>
          <li>
            <T>Pro founder</T>: <T>US${PRECIOS_USD.founder} a month</T>, only for the first {CUPOS_FOUNDER} businesses
            that subscribe. It includes {LIMITES.founder.creditos} credits a month for the agent&apos;s work and{' '}
            {LIMITES.founder.preguntas} questions tracked in AI assistants a month. Founders keep that price while their subscription stays active; if they cancel and come back, they pay the Pro price.
          </li>
          <li>
            <T>Pro</T>: <T>US${PRECIOS_USD.pro} a month</T> once the founder spots are taken. It includes{' '}
            {LIMITES.pro.creditos} credits a month and {LIMITES.pro.preguntas} tracked questions a month.
          </li>
        </Lista>
        <p>
          <T>Credits</T>. Talking to the agent uses no credits. Credits are spent on the work the agent does for you:
          lookups in your data, fixes, page drafts, series of pages, reports you ask for and mystery shopper tests. What
          each one costs is on the <L href="/precios">pricing page</L>. Scheduled reports and answers to questions that
          have nothing to do with your business use no credits. Credits renew on the 1st of each month, unused credits
          do not carry over and extra credits are not sold. If you run out, the agent keeps answering you, but it does
          no new work until the 1st of next month.
        </p>
        <p>
          The subscription is per site. Limits are counted per month. The current price and your country&apos;s taxes
          appear in the checkout before you confirm the purchase. We may adjust prices and limits with prior notice; a
          price change applies from the next renewal. Details are on the <L href="/precios">pricing page</L>.
        </p>

        <H3>10.2 How you are billed</H3>
        <Lista>
          <li>
            Our order process is conducted by our online reseller <T>Paddle.com</T>. Paddle.com is the{' '}
            <T>Merchant of Record</T> for all our orders: Paddle sells you the subscription, processes the payment,
            calculates and remits the taxes that apply in your country and issues the invoice. Paddle provides all
            customer service inquiries about those orders and handles returns.
          </li>
          <li>
            Paddle sells <T>only the Pro subscription</T>, which is software as a service. The optional charges to
            agents in section 8 do not go through Paddle.
          </li>
          <li>
            <T>Peaje never sees or stores your card details</T>. Paddle receives them directly in its checkout.
          </li>
          <li>
            The <X href={PADDLE_TERMINOS}>Paddle buyer terms</X> also apply to that purchase. If anything in these
            terms contradicts them on payment matters, Paddle&apos;s terms prevail.
          </li>
          <li>
            The subscription is billed <T>monthly</T> and <T>renews automatically</T> at the current price until you
            cancel. Paddle emails you a receipt for each charge.
          </li>
          <li>
            You can cancel at any time with the <T>Manage subscription</T> button in the Plan section of My agent, which
            opens the Paddle customer portal; there you can also change your payment method and download invoices. You
            can also do it from the link in your Paddle receipt or at <X href={PADDLE_PORTAL}>paddle.net</X>. You can also write to us and we cancel
            it for you. When you cancel you keep Pro until the end of the period already paid, and then the site moves
            to the free plan.
          </li>
          <li>
            If a renewal charge fails, Paddle emails you a link to update your payment method. If it is not completed,
            the subscription ends and the site moves to the free plan.
          </li>
        </Lista>

        <H3>10.3 Cancellation and refunds</H3>
        <p>
          The details are in the <L href="/reembolsos">refund and cancellation policy</L>, which is part of these
          terms. In short:
        </p>
        <Lista>
          <li>
            If it is the <T>first payment</T> of your subscription and you ask within <T>seven (7) days</T> of the
            charge, we refund the full amount, no questions asked.
          </li>
          <li>Renewals are not refunded, except for billing errors, which we always fix.</li>
          <li>Paddle issues the refund to the original payment method.</li>
          <li>
            When you move to the free plan, your site stays readable by agents and your priced routes keep working.
            What turns off is the Pro agent.
          </li>
          <li>
            None of this limits the rights the law of your country of residence gives you (for example the 14-day
            withdrawal right in the European Union and the United Kingdom, or the retraction right under Colombian
            law).
          </li>
        </Lista>
      </Seccion>

      <Seccion id="availability" titulo="11. Service availability">
        <p>
          Peaje is provided <T>as is</T> and subject to availability. We work to keep it running well, and there may
          still be interruptions for maintenance, provider failures or incidents. We do not guarantee uninterrupted or
          error-free operation.
        </p>
        <Lista>
          <li>
            We do not guarantee that an AI assistant will cite your site, that your score will go up, that agents will
            visit or that agents will pay.
          </li>
          <li>
            We may change, suspend or discontinue features. If we discontinue something important, we give reasonable
            notice.
          </li>
          <li>Keep your own copy of what matters to you. We are not a backup service.</li>
        </Lista>
      </Seccion>

      <Seccion id="liability" titulo="12. Limitation of liability">
        <Lista>
          <li>
            We are not liable for indirect or incidental damages, lost profits, lost business opportunities or
            reputational harm arising from use of the service.
          </li>
          <li>
            We are not liable for the content you publish on your site, for the changes your coding tool applies, or
            for what third-party agents or AI assistants do.
          </li>
          <li>
            Our total liability, for any cause, is limited to the{' '}
            <T>amount you paid for the service in the twelve (12) months before</T> the event that gave rise to the
            claim. On the free plan, that amount is zero.
          </li>
          <li>
            Nothing in this section limits liability that Colombian law does not allow to be limited, such as fraud or
            gross negligence.
          </li>
        </Lista>
        <p>
          You agree to hold us harmless from third-party claims arising from your site, what you sell, your use of the
          service or your breach of these terms.
        </p>
      </Seccion>

      <Seccion id="termination" titulo="13. Suspension and termination">
        <Lista>
          <li>
            You can stop using Peaje whenever you want and ask us to delete your account by writing to{' '}
            <Correo email={CONTACTO} />.
          </li>
          <li>
            We may suspend or close an account that breaks section 7, registers domains it does not control or puts
            the security of the platform at risk.
          </li>
          <li>
            When reasonable, we tell you first and give you a chance to fix it. In serious cases or legal risk, we
            suspend right away.
          </li>
          <li>
            If you ask us to delete your account and you have an active subscription, we cancel it before deleting the
            account. Your data is deleted as described in the privacy notice.
          </li>
          <li>
            The sections on content ownership, limitation of liability and governing law remain in force after
            termination.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="changes" titulo="14. Changes to these terms">
        <p>
          We may update these terms when the product, the billing method or the applicable rules change. If the change
          is substantial, we tell you by email or in the dashboard at least <T>fifteen (15) days</T> in advance. If you
          do not agree, you can cancel and close your account before it takes effect. Continuing to use Peaje after
          that date means you accept the new version.
        </p>
      </Seccion>

      <Seccion id="law" titulo="15. Governing law and disputes">
        <Lista>
          <li>
            These terms are governed by the <T>laws of the Republic of Colombia</T>.
          </li>
          <li>
            Before any legal action, we both agree to try to solve it directly in writing for <T>thirty (30) days</T>.
            Write to us and we will work it out.
          </li>
          <li>If there is no agreement, the dispute goes to the competent courts of Bogotá, Colombia.</li>
          <li>
            If you are a consumer, this does not affect the rights the consumer protection rules of your country of
            residence give you.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="general" titulo="16. General">
        <Lista>
          <li>
            These terms, the privacy notice and the refund policy are the entire agreement between you and Peaje about
            the service.
          </li>
          <li>If a clause turns out to be invalid, the others stay in force.</li>
          <li>
            You may not transfer your account or this agreement without our consent. We may assign it in a
            reorganization or sale of the business, telling you first.
          </li>
          <li>Not exercising a right at a given moment does not mean we waive it.</li>
          <li>The Spanish version governs. This English version is a reference translation.</li>
        </Lista>
      </Seccion>

      <Seccion id="contact" titulo="17. Contact">
        <p>
          Write to us at <Correo email={CONTACTO} />. Service owner: {TITULAR}, {CIUDAD_EN}.
        </p>
      </Seccion>
    </>
  )
}
