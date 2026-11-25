// Central, validated configuration. The server refuses to start in production
// if any security-critical secret is missing or weak — there are NO hard-coded
// fallback secrets anywhere in the codebase.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const isProd = process.env.NODE_ENV === 'production';
const problems = [];

function bool(v, dflt = false) {
  if (v === undefined || v === '') return dflt;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

// In local development only, generate strong random secrets once and keep them
// in server/.dev-secrets.json (git-ignored) so the encrypted vault stays readable
// between restarts. Production must always provide real secrets via environment.
function devSecret(name) {
  const file = path.join(__dirname, '.dev-secrets.json');
  let store = {};
  try {
    store = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    store = {};
  }
  if (!store[name]) {
    store[name] = crypto.randomBytes(48).toString('base64url');
    fs.writeFileSync(file, JSON.stringify(store, null, 2), { mode: 0o600 });
  }
  return store[name];
}

function secret(name) {
  const v = process.env[name];
  const weak = !v || v.length < 32 || /CHANGE_ME/i.test(v);
  if (weak) {
    if (isProd) {
      problems.push(`${name} must be set to a random value of at least 32 characters.`);
      return '';
    }
    console.warn(`[config] ${name} not set — using an auto-generated development secret.`);
    return devSecret(name);
  }
  return v;
}

const config = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  jwtSecret: secret('JWT_SECRET'),
  encryptionKey: secret('ENCRYPTION_MASTER_KEY'),
  otpPepper: '',

  // Public URL of the site, e.g. https://axelonbd.com (used for CORS/CSRF/socket origin checks and emails)
  publicOrigin: (process.env.PUBLIC_ORIGIN || '').replace(/\/+$/, ''),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),

  // 'loopback' = only trust X-Forwarded-For when the request comes from the local
  // reverse proxy (cPanel/Passenger/Apache). Cannot be spoofed from the internet.
  trustProxy: process.env.TRUST_PROXY || 'loopback',
  cookieSecure: bool(process.env.COOKIE_SECURE, isProd),

  maxUploadMb: Math.min(Math.max(Number(process.env.MAX_UPLOAD_MB) || 100, 1), 500),

  admin: {
    fullName: process.env.ADMIN_FULL_NAME || 'Store Admin',
    email: String(process.env.ADMIN_EMAIL || '').toLowerCase().trim(),
    phone: process.env.ADMIN_PHONE || '',
    address: process.env.ADMIN_ADDRESS || '',
    password: process.env.ADMIN_PASSWORD || ''
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: bool(process.env.SMTP_SECURE, (Number(process.env.SMTP_PORT) || 465) === 465),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || ''
  },

  mongoUri: process.env.MONGO_URI || ''
};

config.otpPepper = crypto.createHash('sha256').update('otp:' + config.jwtSecret).digest();
config.smtpConfigured = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from);

if (isProd) {
  if (!config.admin.email) problems.push('ADMIN_EMAIL must be set.');
  if (!config.smtpConfigured) {
    problems.push('SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM must be set so verification emails can be sent.');
  }
  if (!config.publicOrigin) problems.push('PUBLIC_ORIGIN must be set (e.g. https://yourdomain.com).');
} else if (!config.admin.email) {
  config.admin.email = 'admin@localhost.test';
}

if (problems.length) {
  console.error('\n❌ Refusing to start — insecure or missing configuration:\n  - ' + problems.join('\n  - ') + '\n');
  process.exit(1);
}

module.exports = config;
