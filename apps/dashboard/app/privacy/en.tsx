import { Correo, H3, L, Lista, Seccion, T } from '../components/legal'
import { CIUDAD_EN, CONTACTO, TITULAR } from '@/lib/legal'

// Privacy notice, English version. Translation of es.tsx, which governs.
// Keep both in sync and update the date in lib/legal.ts.

export function PrivacidadEn() {
  return (
    <>
      <Seccion>
        <p>
          Peaje gets your site ready for AI agents. To do that it handles your account data, reads your site&apos;s
          content and logs what agents do when they arrive. This notice explains what we keep, why, who we share it
          with and how to ask us to delete it.
        </p>
      </Seccion>

      <Seccion id="controller" titulo="1. Data controller">
        <p>
          {/* TODO(San): confirm the legal owner; see lib/legal.ts. */}
          The controller of your personal data is <T>{TITULAR}</T>, based in {CIUDAD_EN}, owner of the Peaje service
          (usepeaje.com).
        </p>
        <p>
          Contact email for any personal data matter: <Correo email={CONTACTO} />.
        </p>
        <p>
          This notice is governed by Colombian Law 1581 of 2012, Decree 1377 of 2013 and the other Colombian personal
          data protection rules.
        </p>
      </Seccion>

      <Seccion id="scope" titulo="2. Who this notice applies to">
        <Lista>
          <li>
            <T>Peaje users</T>: people who create an account and register one or more sites.
          </li>
          <li>
            <T>People who use the radar</T>: those who enter a domain and their email to see the result.
          </li>
          <li>
            <T>Whoever sends requests to a site running Peaje</T>: agents, bots and programs whose requests go through
            Peaje (section 9).
          </li>
        </Lista>
      </Seccion>

      <Seccion id="data" titulo="3. What data we collect">
        <H3>3.1 Your account and your sites</H3>
        <Lista>
          <li>
            <T>Email address</T>. It is what you use to sign in: we send a code to that email. We do not use
            passwords.
          </li>
          <li>
            Your <T>Privy user ID</T>, from the provider that verifies your email and creates your business wallet, and
            the <T>address of that wallet</T>.
          </li>
          <li>
            For each site: name, short identifier (slug), <T>domain</T> and, if you add them, the business logo, phone,
            address, description and public profiles.
          </li>
          <li>The plan status of each site (free, trial, founder or Pro) and its dates.</li>
        </Lista>

        <H3>3.2 Your site&apos;s content</H3>
        <Lista>
          <li>
            The <T>public pages</T> of your domains, which Peaje reads to describe your site to agents, calculate your
            score, learn the tone you write in and verify tasks.
          </li>
          <li>
            What Peaje generates from that: descriptions for agents, the plan, page drafts, tasks, the questions we
            track in AI assistants and their results, reports and mystery shopper tests.
          </li>
        </Lista>

        <H3>3.3 Radar</H3>
        <Lista>
          <li>
            When you use the radar we keep your <T>email</T>, the <T>domain</T> you checked, the language, the date of
            the last report we sent you and whether you <T>agreed to receive tips</T> by email (an optional box,
            unchecked by default). We keep your email in a cookie so we do not ask for it on every check.
          </li>
          <li>Your IP address is used only in memory to limit repeated attempts. We do not store it.</li>
        </Lista>

        <H3>3.4 Agent visits to your site</H3>
        <p>
          For each request that goes through Peaje we log the path, the method, the <T>user agent</T> (the name the
          program identifies itself with, for example GPTBot), the agent type, the response, whether it paid, the
          amount, the network and the time. <T>We do not store the IP address</T> of whoever makes the request. You,
          the site owner, see these logs.
        </p>

        <H3>3.5 Agent payments and withdrawals</H3>
        <p>
          If you charge agents, we keep a record of each payment: the path, the amount, the fee, the network, the{' '}
          <T>agent&apos;s wallet address</T> and the transaction reference. For each withdrawal we keep the amount, the
          destination wallet and the reference. These transactions are also recorded on public blockchain networks
          that anyone can look up.
        </p>

        <H3>3.6 Conversation with the agent</H3>
        <p>
          The <T>messages</T> you write to the Pro agent and its replies, on the dashboard, on Telegram or on Slack,
          with the channel they came through.
        </p>

        <H3>3.7 Telegram and Slack</H3>
        <Lista>
          <li>
            If you connect <T>Telegram</T>: the chat ID, your Telegram username and the language.
          </li>
          <li>
            If you connect <T>Slack</T>: the workspace ID and name, the channel, the user who installed the app and the
            bot token, which we store encrypted.
          </li>
          <li>If you schedule reports: the channel, the destination (email or chat), the frequency and the time zone.</li>
        </Lista>

        <H3>3.8 Subscription</H3>
        <p>
          {/* TODO(San): once Paddle is integrated, list the Paddle IDs stored (customer, subscription). */}
          We keep your plan status and its end date. We do <T>not</T> receive or store card numbers, security codes or
          bank details: the Pro subscription payment is processed by Paddle (section 7).
        </p>

        <H3>3.9 What we do not collect</H3>
        <Lista>
          <li>
            We do not ask for sensitive data: health, ethnic origin, sexual orientation, religious beliefs, political or
            union affiliation, biometric data. If you write it in the chat, it stays under your control and you can ask
            us to delete it.
          </li>
          <li>We do not store IP addresses of users or visitors.</li>
          <li>We do not use tracking, advertising or third-party cookies (section 13).</li>
        </Lista>
      </Seccion>

      <Seccion id="purposes" titulo="4. What we use your data for">
        <Lista>
          <li>
            <T>Providing the service</T>: creating your account, signing you in, generating your site&apos;s kit,
            showing you the radar and the visits, and running the Pro agent.
          </li>
          <li>
            <T>Recording the payments</T> your site receives from agents and processing your withdrawals.
          </li>
          <li>
            <T>Managing your subscription</T> and applying each plan&apos;s limits.
          </li>
          <li>
            <T>Notifying you</T> by email, Telegram or Slack: monitor alerts, the weekly report and radar results.
          </li>
          <li>
            <T>Sending you tips</T> on getting found by agents, only if you agreed in the radar.
          </li>
          <li>
            <T>Answering your support messages</T>.
          </li>
          <li>
            <T>Meeting legal obligations</T> and <T>keeping the service secure</T>: preventing abuse, fraud and
            automated misuse.
          </li>
        </Lista>
        <p>We do not sell your data. We do not rent it. We do not hand it to advertisers or data brokers.</p>
      </Seccion>

      <Seccion id="legal-basis" titulo="5. Legal basis and consent">
        <p>
          We process your data with your <T>prior, express and informed consent</T>, which you give when you create
          your account or use the radar and accept this notice. We also rely on <T>performance of the contract</T>,{' '}
          <T>compliance with legal obligations</T> that apply in Colombia and our <T>legitimate interest</T> in keeping
          the service secure and working.
        </p>
        <p>
          You can withdraw your consent at any time, except when a rule or the contract requires us to keep the data.
          Withdrawal does not affect what we did before it.
        </p>
      </Seccion>

      <Seccion id="ai" titulo="6. How we use artificial intelligence">
        <Lista>
          <li>
            We use language models to describe your site, build the plan, write drafts and tasks, and talk with you.
          </li>
          <li>
            To measure whether you are cited, we ask questions to ChatGPT, Claude, Perplexity and Gemini. Those
            assistants receive the questions, not your email or your account data.
          </li>
          <li>
            <T>We do not train models on your content</T>. The AI providers process the data under their terms for
            programming interfaces.
          </li>
          <li>We do not make automated decisions with legal effects on you.</li>
        </Lista>
      </Seccion>

      <Seccion id="processors" titulo="7. Who we share data with">
        <p>
          We share data only with providers we need to run the service. Each one processes the data on our instructions
          and is bound to protect it. This is the complete list as of the date of this notice:
        </p>
        <Lista>
          <li>
            <T>Supabase</T>: database. It is where your account, your sites, the visits, the payments and the
            conversation with the agent live.
          </li>
          <li>
            <T>Vercel</T>: hosts the website and the dashboard (usepeaje.com).
          </li>
          <li>
            <T>Railway</T>: hosts the gateway (api.usepeaje.com), which agent requests go through and where the Pro
            agent runs.
          </li>
          <li>
            <T>Privy</T>: sends the sign-in code to your email, verifies your identity and creates and manages your
            business wallet. It receives your email.
          </li>
          <li>
            <T>Resend</T>: sends operational emails (radar results, alerts, the weekly report and tips if you agreed).
            It receives your email and the content of the message.
          </li>
          <li>
            <T>Anthropic (Claude)</T>: generates the descriptions, the plan, the drafts, the tasks and the agent&apos;s
            replies from your site&apos;s content and your messages. It also answers questions for citation measurement.
          </li>
          <li>
            <T>OpenAI</T>, <T>Perplexity</T> and <T>Google (Gemini)</T>: answer the questions we use to measure whether
            they cite your site.
          </li>
          <li>
            <T>Ora</T>: calculates the agent-readiness score. It receives the domain being checked.
          </li>
          <li>
            <T>Telegram</T> and <T>Slack</T>: only if you connect them, to talk with the agent and receive reports.
            They receive the messages you exchange with the agent on that channel.
          </li>
          <li>
            <T>Paddle</T>: sells the Pro subscription as Merchant of Record: it processes the payment, calculates and
            remits your country&apos;s taxes and issues the invoice. It receives your email, your country and your
            payment method directly in its checkout; Peaje never sees your card details. Paddle&apos;s terms and privacy
            policy also apply to that payment.
          </li>
        </Lista>
        <p>
          We may also hand data to authorities when there is a valid legal request, and to legal or accounting advisers
          when needed to defend a right. If we add or change a provider that processes personal data, we update this
          list and the date of this notice.
        </p>
      </Seccion>

      <Seccion id="transfers" titulo="8. International transfers">
        <p>
          The providers in section 7 run servers outside Colombia, mainly in the United States and the European Union.
          That means your data is transferred and processed abroad. By accepting this notice you authorize that
          transfer.
        </p>
      </Seccion>

      <Seccion id="visitors" titulo="9. Whoever sends requests to a site running Peaje">
        <Lista>
          <li>
            We log the data in section 3.4 on behalf of the site owner, who sees it on their dashboard. For that data,
            the site owner is the controller and Peaje acts as processor.
          </li>
          <li>
            <T>We do not store the IP address</T> of whoever makes the request. We do use it in memory, briefly, to
            limit excessive requests.
          </li>
          <li>
            If an agent pays, its wallet address stays in the payment record and on the public network where it was
            made.
          </li>
        </Lista>
        <p>
          Our hosting providers may keep their own technical logs, with IP addresses, for short periods for security
          and diagnostics. That happens on their infrastructure and is governed by their policies.
        </p>
      </Seccion>

      <Seccion id="retention" titulo="10. How long we keep your data">
        <Lista>
          <li>
            <T>Your account, your sites and their content</T>: while your account is active.
          </li>
          <li>
            <T>Agent visits</T>: while the site that received them exists.
          </li>
          <li>
            <T>Conversation with the agent</T>: while the site exists. You can ask us to delete it without deleting the
            rest.
          </li>
          <li>
            <T>Radar</T>: until you ask us to remove you. If you agreed to tips, you can withdraw that permission at any
            time.
          </li>
          <li>
            <T>Payment, withdrawal and billing records</T>: for the period Colombian law requires.
          </li>
        </Lista>
        <p>
          When you ask us to delete your account, we delete your data from our systems within{' '}
          <T>thirty (30) calendar days</T>, except what we must keep by law. What is already on a public blockchain
          network cannot be deleted.
        </p>
      </Seccion>

      <Seccion id="security" titulo="11. Security">
        <Lista>
          <li>Data is encrypted in transit and stored encrypted at rest by our providers.</li>
          <li>Slack tokens are stored encrypted.</li>
          <li>Service keys exist only on the server and are never exposed in the browser.</li>
        </Lista>
        <p>
          No system is perfect. If an incident affects your personal data, we tell you and notify the competent
          authority as the law requires.
        </p>
      </Seccion>

      <Seccion id="rights" titulo="12. Your rights">
        <p>As the owner of your personal data, Colombian law gives you these rights:</p>
        <Lista>
          <li>
            <T>Know</T> what data of yours we hold and <T>access</T> it free of charge.
          </li>
          <li>
            <T>Update and correct</T> data that is incomplete, inaccurate or out of date.
          </li>
          <li>
            <T>Delete</T> your data when there is no legal or contractual duty to keep it.
          </li>
          <li>
            <T>Withdraw the consent</T> you gave us.
          </li>
          <li>
            <T>Request proof</T> of the consent you gave.
          </li>
          <li>
            <T>Be informed</T> about how we have used your data.
          </li>
          <li>
            <T>File complaints</T> with the Superintendence of Industry and Commerce (SIC) for breaches of the data
            protection law.
          </li>
        </Lista>
        <H3>How to exercise them</H3>
        <p>
          Write to <Correo email={CONTACTO} /> from your account email, with your name, the right you want to exercise
          and what you need. If you write from another email we ask you to verify your identity before we act.
        </p>
        <Lista>
          <li>
            <T>Inquiries</T>: we answer within ten (10) business days at most. If we cannot, we tell you and use up to
            five (5) more business days.
          </li>
          <li>
            <T>Claims</T>: we answer within fifteen (15) business days at most. If we cannot, we tell you and use up to
            eight (8) more business days.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="cookies" titulo="13. Cookies and local storage">
        <p>
          usepeaje.com <T>does not use tracking, advertising or third-party cookies</T>. We have no social media pixels
          and no external analytics tools. We use only what it needs to work:
        </p>
        <Lista>
          <li>
            A <T>session</T> cookie so you do not have to request a code on every visit. It is deleted when you sign
            out.
          </li>
          <li>
            A cookie with your <T>language</T> and, if you used the radar, another with your <T>email</T> so we do not
            ask for it again.
          </li>
          <li>
            Browser <T>local storage</T> to remember the light or dark theme. That data does not leave your device.
          </li>
          <li>When you sign in, Privy may store in your browser what it needs to verify your email, under its own policy.</li>
          <li>
            When you pay for Pro, the Paddle checkout may use its own cookies to complete the purchase and prevent fraud,
            under Paddle&apos;s policy.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="minors" titulo="14. Minors">
        <p>
          Peaje is a service for people eighteen (18) and older. We do not knowingly collect data from minors. If we
          detect an account of a minor, we delete it along with its data.
        </p>
      </Seccion>

      <Seccion id="communications" titulo="15. Messages we send you">
        <Lista>
          <li>
            <T>Operational</T>: sign-in code and notices about your account, your site and your subscription. They are
            part of the service while you have an account.
          </li>
          <li>
            <T>From the Pro agent</T>: monitor alerts and the weekly report, by email, Telegram or Slack depending on
            what you set up.
          </li>
          <li>
            <T>Tips</T>: only if you checked the box in the radar. Each one tells you how to unsubscribe.
          </li>
        </Lista>
      </Seccion>

      <Seccion id="changes" titulo="16. Changes to this notice">
        <p>
          We may update this notice when the product or the rules change. When the change is substantial, we tell you
          by email or in the dashboard before it takes effect. The last updated date is at the top and bottom of this
          document. Continuing to use Peaje after a change means you accept it.
        </p>
      </Seccion>

      <Seccion id="contact" titulo="17. Contact">
        <p>
          Any question, request or claim about your personal data: <Correo email={CONTACTO} />. Controller: {TITULAR},{' '}
          {CIUDAD_EN}.
        </p>
        <p>
          If you think we did not handle your request well, you can go to Colombia&apos;s Superintendence of Industry and
          Commerce. The rules for using the service are in the <L href="/terms">terms</L>. The Spanish version of this
          notice governs.
        </p>
      </Seccion>
    </>
  )
}
