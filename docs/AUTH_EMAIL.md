# Sign-in / sign-up e-mail (PROMETEO)

Sign-in is passwordless: `SignIn.tsx` calls `signInWithOtp`, Supabase e-mails a one-time link,
the link lands on `/api/auth/callback`, which turns `token_hash` into a session cookie.
A new e-mail gets the **Confirm signup** template, a known e-mail gets **Magic Link**.

The templates live in `supabase/email-templates/` and are pasted into the Supabase dashboard
(they are not deployed from the repo). Their link goes through our own domain
(`{{ .RedirectTo }}&token_hash=…&type=email`), so it opens in any browser or device,
unlike the default `{{ .ConfirmationURL }}` (PKCE, same browser only).

## One-time setup

1. **Resend** (resend.com): add the domain `prometeo.land`, put the DNS records it shows
   (SPF/DKIM, optional DMARC) at the domain registrar, wait for "Verified", create an API key.
2. **Supabase → Authentication → Emails → SMTP Settings**: enable custom SMTP
   - Host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key
   - Sender e-mail `hola@prometeo.land`, sender name `PROMETEO`
   - Without custom SMTP Supabase only mails members of the Supabase project.
3. **Supabase → Authentication → Emails → Templates**
   - Confirm signup: subject `Confirma tu registro en PROMETEO`, body = `confirm-signup.html`
   - Magic Link: subject `Tu enlace para entrar a PROMETEO`, body = `magic-link.html`
4. **Supabase → Authentication → URL Configuration**
   - Site URL: `https://prometeo.land`
   - Redirect URLs: `https://prometeo.land/**` (keep the Vercel URL too while it is used).
   The template appends `&token_hash=…` to the redirect URL, so the redirect URL must be on this list
   (otherwise Supabase falls back to the Site URL and the link breaks).
5. **Supabase → Authentication → Rate Limits**: raise "emails sent per hour" (default 30 with custom SMTP)
   before launch.
