# Atlas Chile: roadmap (backlog)

Decided items waiting for their turn. Newest decisions first.

## Access and monetisation

- **Daily cap for the Unlimited plan (decided 2026-11-22):** 150 000 CLP/month covers the cost today, but add a fair-use limit of N reports per day (for example 30–50) so one account cannot be scripted. Check in `reportPayment()` (count of today's `reports` with `paid_with = 'subscription'`), with a clear message and a contact link when reached.
- **Pack vs plan pricing (2026-11-22):** per report, packs of 15 (4 667 CLP) and 30 (4 000 CLP) are cheaper than the Basic and Partner plans (5 000 CLP); plans win only through trends and data. Revisit when there is sales data.
- **Property type in the report (question from 2026-11-22, next iteration):** SII catastro already gives the main use (destino: H homes, C retail, O offices…), units, m² and year per building and per rol. Use it to compare the unit with sales of the same type in the comuna (EC01 by destino), and let the buyer pick or confirm the type (apartment / house / office / retail) and m² before generating the report.
- **E-mail after a purchase:** send the report link (guest single purchase) and a welcome with the sign-in link (pack or plan bought without an account) via Resend.
- **Legal before going live with real money:** terms of service, privacy policy, refund policy (Ley 19.496), contact details on the site (Stripe also asks for these), and invoicing once the Chilean company exists.

- **Trial for new users (decided 2026-11-21):** 3 days from signup with trends unlocked and 3 free reports.
  - Schema: `profiles.trial_until`, set by the signup trigger to `now() + 3 days`; 3 report credits as a `purchases` row (`kind = 'trial'`, `credits = 3`, `status = 'paid'`, `provider = 'trial'`).
  - `currentAccount()` treats `trial_until > now()` like a subscription for trends; reports use the credits.
  - Show "trial: N days left" in the account page and header.
- **Done 2026-11-22:** paywall on, 5-minute full trends preview per browser (signed httpOnly cookie `pm_trends_preview`, 30 days), Stripe payments (single report without an account, packs 5/15/30, plans Basic/Partner/Unlimited), pricing page. Possible abuse guard later: one preview per IP per day.
- Move payments from the personal Stripe account to the company (Stripe, Mercado Pago or Flow) once the Chilean legal entity and bank account exist.
- Transactional e-mail via Resend (custom SMTP in Supabase) before public launch.

## Data

- SII catastro (Detalle Catastral): local downloader `pipeline/chile/fetch_catastro.py` asks for login at run time. Then:
  - EC01 (UF/m²);
  - type, area, year and avalúo in the object card;
  - rol → address search.
- Claude API key on Vercel for real AI reports.
