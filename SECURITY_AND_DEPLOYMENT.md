# AXELON — Security Fixes & cPanel Deployment Guide

## 1. What was fixed

| # | Problem | Fix |
|---|---------|-----|
| 1 | Verification/reset codes were sent back to the browser → anyone could reset the admin password | Codes are only ever **emailed**. They're never in API responses and never written to logs in production. |
| 2 | Hard-coded fallback JWT secret, encryption key and admin password (`Abc@1234`) | All removed. In production the server **refuses to start** if a secret is missing, short or still `CHANGE_ME`. The admin password comes from `ADMIN_PASSWORD` on first start only. |
| 3 | Anyone could join `admin-room` or any chat over Socket.IO | Sockets are authenticated from the session cookie. The **server** assigns rooms: customers get only their own conversation, admins get the admin room. Client "join" events are ignored. Cross-site WebSocket connections are blocked. |
| 4 | Upload of HTML/SVG led to XSS and session theft | Uploads require sign-in. The real file type is checked from the file's bytes (photos, video, audio, PDF only; HTML/SVG/scripts/EXE/ZIP rejected). Files are served with `nosniff` and a sandbox security policy, PDFs as downloads. The session token is now an **HttpOnly cookie** that JavaScript can't read. A strict site-wide Content Security Policy is on. |
| 5 | Unauthenticated fake orders and fake messages into anyone's chat | Orders need a verified account. Orders and messages always go to the signed-in user's own conversation. |
| 6 | Customers could set their own prices | The browser sends only product IDs and quantities. The **server** looks up prices and computes delivery (TK 120, free over TK 3,000) and totals. |
| 7 | Easy to crash the server (105 MB requests, uploads in RAM) | JSON limit is 1 MB. Uploads stream to disk and are encrypted in chunks, so they never sit in memory. Video seeking decrypts only the requested bytes. Socket messages are capped at 100 KB. Per-user upload quota is 500 MB/day. Unused uploads are cleaned up after 24 h. The data file is written atomically. |
| 8 | Hidden "not visible to client" product fields were sent to everyone | Removed from every public response (homepage, search, live updates). Only the admin receives them. |
| 9 | Rate limiting broken behind the cPanel proxy; codes could be brute-forced | `trust proxy` is set correctly. Separate limits apply to sign-in (per IP and per account), code requests, code checks, uploads, messages and orders. Each code allows 5 wrong tries, then it's burned. One resend per minute, max 5 per hour, expires in 10 minutes, single-use, stored only as an HMAC hash. |
| 10 | CORS allowed every website | CORS is off by default (same-site only). Every write request must come from your own domain (Origin check) plus a `SameSite=Lax` cookie. |
| 11 | Token in `localStorage`, no `secure` flag, stays valid after password change | Session uses an HttpOnly + Secure + SameSite cookie (12 h for admin, 7 days for customers). Password reset, admin password change, email change or account deletion **instantly revokes** all sessions and live sockets. There's a real logout endpoint. |
| 12 | Account discovery (anyone could check which emails are registered) | Registration and forgot-password give the same answer whether or not the email exists. The real owner gets a "someone tried to sign up with your email" message instead. Sign-in timing is equalised. |
| 13 | Weak regex XSS filter; `javascript:` links possible | Replaced with real defences: React escaping, strict URL validation on the server (and again in the browser) for social links, logos, product images and attachments, plus CSP. Prototype-pollution keys are stripped. |
| 14 | File deletion via forged attachment IDs | Attachments are referenced by ID only and must be files **you** uploaded. The server builds the attachment record itself. IDs are pattern-checked before touching the disk. |
| 15 | Anyone with a link could open private chat files | Chat files are viewable only by the uploader, the customer in that conversation, and the admin. Product photos stay public. |
| 16 | Outdated `multer` 1.x with known DoS bugs | Upgraded to `multer` 2.x. Added `nodemailer` 7.x. |
| 17 | Your personal phone, email and home address were in the public repo | Removed from code. Set your store contact details in **Admin Controls → Footer**. |
| 18 | Misleading "end-to-end encryption" claim | Text corrected. Data is encrypted **at rest** (AES-256-GCM) and in transit (HTTPS). |
| 19 | Demo chat shipped to production | Removed automatically. |
| 20 | Wrong key or crash could wipe all data | The server refuses to start rather than overwrite a vault it can't decrypt. Writes are atomic, file permissions are `600`, and an optional MongoDB backup copy is restored automatically if the disk copy is missing. |

Also added: HSTS, Referrer-Policy, Permissions-Policy, clickjacking protection, no-store caching on API responses, generic error messages (no stack traces), and stricter validation of all input lengths, phone numbers (Bangladesh format) and passwords (bcrypt 72-byte limit).

> **Honest note:** no website can be "100% unhackable". These fixes close every hole that was found and follow current best practice. The rest of security is operational: strong unique passwords, 2FA on cPanel/GitHub/email, keeping packages updated (`npm audit`), and backups.

---

## 2. Free email verification (choose one)

### Option A: your cPanel mailbox (recommended, free with your hosting)
1. In cPanel, go to **Email Accounts → Create**, e.g. `noreply@yourdomain.com`, with a long random password.
2. In cPanel, go to **Email Deliverability**. Click **Repair**/**Install** so **SPF** and **DKIM** show "Valid". This keeps codes out of spam.
3. Click **Connect Devices** next to the mailbox and note the **outgoing (SMTP) server** and port **465**.
4. Set these environment variables:
   ```
   SMTP_HOST=mail.yourdomain.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=noreply@yourdomain.com
   SMTP_PASS=<mailbox password>
   MAIL_FROM="AXELON <noreply@yourdomain.com>"
   ```
   Shared hosts usually cap outgoing mail at a few hundred messages per hour, which is plenty for sign-up codes.

### Option B: Gmail (free, about 500 emails/day)
1. Turn on 2-Step Verification on the Gmail account.
2. Go to Google Account → Security → **App passwords** and create one.
3. Use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<16-char app password>`, `MAIL_FROM="AXELON <you@gmail.com>"`.

How it works for customers: they fill in the sign-up form and the server checks the email domain can receive mail. A 6-digit code is emailed and the account is created **only** after they enter the correct code. Password resets work the same way.

---

## 3. Deploy on cPanel

**A. Build the website on your own computer** (needs Node 18+):
```bash
cd client
npm install
npm run build        # creates client/dist
```

**B. Upload.** In cPanel **File Manager**, create a folder **outside** `public_html`, e.g. `/home/<user>/axelon`. Upload:
```
axelon/server/   (everything except node_modules and .env)
axelon/client/dist/
```
Never put `server/`, `.env`, `uploads/` or the vault file inside `public_html`.

**C. Generate secrets** (on your computer, inside `server/`):
```bash
node scripts/generate-secrets.js
```
Save the output somewhere safe (a password manager). **Back up `ENCRYPTION_MASTER_KEY`.** If you lose it, the data can't be recovered.

**D. cPanel → Setup Node.js App → Create Application**
- Node.js version: 20 or newer
- Application mode: **Production**
- Application root: `axelon/server`
- Application URL: your domain
- Application startup file: `index.js`
- Environment variables: add everything from `server/.env.example` with real values (`NODE_ENV=production`, `PUBLIC_ORIGIN=https://yourdomain.com`, the two secrets, `ADMIN_*`, `SMTP_*`). `ADMIN_PASSWORD` must be strong (8+ characters with upper, lower, digit and symbol).
- Click **Create**, then **Run NPM Install**, then **Restart**.

**E. HTTPS.** In cPanel **SSL/TLS Status**, run **AutoSSL** for the domain. Then in **Domains**, turn on **Force HTTPS Redirect**.

**F. Test.** Open the site and register with a real email; you should receive a code. Sign in as admin, add a product with a photo, place a test order and send a chat message. If the app won't start, open the app's **stderr.log** in the application root. Missing settings are listed there in plain English.

---

## 4. Checklist after going live
- [ ] Change the cPanel password (it was shared in a chat) and enable cPanel **Two-Factor Authentication**.
- [ ] Enable 2FA on GitHub and on the admin email account.
- [ ] After the first successful start you may remove `ADMIN_PASSWORD` from the environment (it's only used on first start).
- [ ] Set your real store phone, email and address in **Admin Controls → Footer**.
- [ ] Back up `server/models/axelon_vault.enc.json` and `server/uploads/` regularly (cPanel **Backup**), or set `MONGO_URI` to a free MongoDB Atlas cluster for an automatic encrypted copy.
- [ ] Every month or so, run `npm audit` and `npm update` in `server/` and `client/`.
