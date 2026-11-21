# Atlas Chile: roadmap (backlog)

Decided items waiting for their turn. Newest decisions first.

## Access and monetisation

- **Trial for new users (decided 2026-11-21):** 3 days from signup with trends unlocked and 3 free reports.
  - Schema: `profiles.trial_until`, set by the signup trigger to `now() + 3 days`; 3 report credits as a `purchases` row (`kind = 'trial'`, `credits = 3`, `status = 'paid'`, `provider = 'trial'`).
  - `currentAccount()` treats `trial_until > now()` like a subscription for trends; reports use the credits.
  - Show "trial: N days left" in the account page and header.
- **Trends open to everyone for now (2026-11-21):** the paywall is switched off (`NEXT_PUBLIC_TRENDS_PAYWALL` unset). Turn it back on once there is a user base.
- **Timed trends preview (decided 2026-11-21, with the paywall back on):** a new session sees full trends for a few minutes, then they lock until payment or trial.
  - Server keeps the start time in an httpOnly signed cookie (`trends_preview_started`, HMAC with a server secret), so clearing localStorage does not reset it.
  - `/api/trends` serves the full table while `now - started < N minutes`, otherwise the free view. The client shows a countdown and swaps to the locked view when the time is up.
  - Limit: a private window or a new browser restarts the preview. A per-IP rate limit (for example one preview per IP per day) can be added if it gets abused.
- Payments (Mercado Pago or Flow) once the Chilean legal entity exists: single report, packs of 10–30, unlimited subscription.
- Transactional e-mail via Resend (custom SMTP in Supabase) before public launch.

## Data

- SII catastro (Detalle Catastral): local downloader `pipeline/chile/fetch_catastro.py` asks for login at run time. Then:
  - EC01 (UF/m²);
  - type, area, year and avalúo in the object card;
  - rol → address search.
- Claude API key on Vercel for real AI reports.
