// Sends verification / password-reset emails over SMTP (free with your cPanel
// email account, or Gmail with an App Password, or Brevo's free tier).
const config = require('../config');

let transporter = null;
if (config.smtpConfigured) {
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    requireTLS: !config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const BRAND = 'AXELON';

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;color:#0F2557">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:1px solid #DBBB97">
<tr><td style="background:#0F2557;color:#F2D5B1;padding:16px 24px;font-size:20px;font-weight:bold;letter-spacing:2px">${BRAND}</td></tr>
<tr><td style="padding:24px"><h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>${bodyHtml}
<p style="font-size:12px;color:#6b7280;margin-top:24px">If you did not request this, you can safely ignore this email. Never share this code with anyone — ${BRAND} staff will never ask for it.</p>
</td></tr></table></td></tr></table></body></html>`;
}

async function send({ to, subject, text, html }) {
  if (!transporter) {
    if (config.isProd) throw new Error('Email service is not configured.');
    // Development only: print to the server console — never to the browser.
    console.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, text, html });
}

function codeBlock(code) {
  return `<p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#FBF6F0;border:1px dashed #B8844E;padding:12px;text-align:center;margin:16px 0">${esc(code)}</p>`;
}

module.exports = {
  async sendRegistrationCode(to, name, code) {
    await send({
      to,
      subject: `${BRAND} — your email verification code`,
      text: `Hello ${name},\n\nYour ${BRAND} verification code is: ${code}\nIt expires in 10 minutes.\n\nIf you did not try to create an account, ignore this email.`,
      html: layout('Verify your email', `<p>Hello ${esc(name)},</p><p>Use this code to finish creating your ${BRAND} account. It expires in <b>10 minutes</b>.</p>${codeBlock(code)}`)
    });
  },
  async sendAlreadyRegistered(to) {
    await send({
      to,
      subject: `${BRAND} — sign-up attempt for your email`,
      text: `Someone tried to create a new ${BRAND} account with this email, but you already have one.\nIf this was you, just sign in or use "Forgot password".`,
      html: layout('You already have an account', `<p>Someone tried to create a new ${BRAND} account with this email address, but an account already exists.</p><p>If this was you, simply sign in, or use <b>Forgot password</b> on the sign-in screen.</p>`)
    });
  },
  async sendPasswordResetCode(to, name, code) {
    await send({
      to,
      subject: `${BRAND} — password reset code`,
      text: `Hello ${name},\n\nYour ${BRAND} password reset code is: ${code}\nIt expires in 10 minutes.\n\nIf you did not request this, ignore this email — your password will not change.`,
      html: layout('Reset your password', `<p>Hello ${esc(name)},</p><p>Use this code to reset your ${BRAND} password. It expires in <b>10 minutes</b>.</p>${codeBlock(code)}`)
    });
  },
  async sendLoginCode(to, name, code, device) {
    await send({
      to,
      subject: `${BRAND} — admin sign-in code (new device)`,
      text: `Hello ${name},\n\nSomeone (hopefully you) is signing in to the ${BRAND} admin account from a new device:\n${device}\n\nYour sign-in code is: ${code}\nIt expires in 10 minutes.\n\nIf this wasn't you, DO NOT share this code — change your admin password immediately.`,
      html: layout(
        'New device sign-in',
        `<p>Hello ${esc(name)},</p><p>Someone is signing in to the ${BRAND} <b>admin account</b> from a new device:</p><p style="font-size:12px;color:#374151;background:#f3f4f6;padding:8px">${esc(device)}</p><p>Enter this code to allow it. It expires in <b>10 minutes</b>.</p>${codeBlock(code)}<p style="color:#b91c1c;font-weight:bold">If this wasn't you, do not share the code and change your admin password right away.</p>`
      )
    });
  },
  async sendEmailChangeCode(to, name, code) {
    await send({
      to,
      subject: `${BRAND} — confirm your new email address`,
      text: `Hello ${name},\n\nYour code to confirm this as your new ${BRAND} account email is: ${code}\nIt expires in 10 minutes.`,
      html: layout('Confirm your new email', `<p>Hello ${esc(name)},</p><p>Enter this code to make this your new ${BRAND} account email. It expires in <b>10 minutes</b>.</p>${codeBlock(code)}`)
    });
  },
  async sendEmailChangedNotice(to, name, newEmail) {
    await send({
      to,
      subject: `${BRAND} — your account email was changed`,
      text: `Hello ${name},\n\nThe email on your ${BRAND} account was changed to ${newEmail}. If this wasn't you, contact the store immediately.`,
      html: layout('Account email changed', `<p>Hello ${esc(name)},</p><p>The email on your ${BRAND} account was changed to <b>${esc(newEmail)}</b>.</p><p>If this wasn't you, contact the store immediately.</p>`)
    });
  },
  async sendPasswordChanged(to, name) {
    await send({
      to,
      subject: `${BRAND} — your password was changed`,
      text: `Hello ${name},\n\nYour ${BRAND} password was just changed and all other sessions were signed out.\nIf this wasn't you, reset your password immediately and contact us.`,
      html: layout('Password changed', `<p>Hello ${esc(name)},</p><p>Your ${BRAND} password was just changed and all other sessions were signed out.</p><p>If this wasn't you, reset your password immediately and contact the store.</p>`)
    });
  }
};
