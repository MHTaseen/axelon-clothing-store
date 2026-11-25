const config = require('./config'); // validates secrets first — exits if insecure
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const dns = require('dns').promises;
const { pipeline } = require('stream/promises');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Server } = require('socket.io');

const store = require('./models/SiteStore');
const mailer = require('./security/mailer');
const v = require('./security/validators');
const { detectFile } = require('./security/fileType');
const {
  encryptFileToPath,
  plainSizeV2,
  createDecryptStreamV2,
  createRangeDecryptStreamV2,
  decryptBufferLegacy,
  sanitizeInput
} = require('./security/cryptoVault');

const app = express();
const server = http.createServer(app);

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const TMP_DIR = path.join(UPLOADS_DIR, 'tmp');
fs.mkdirSync(TMP_DIR, { recursive: true, mode: 0o700 });

const COOKIE_NAME = 'axelon_session';
const SESSION_TTL = { admin: 12 * 60 * 60, customer: 7 * 24 * 60 * 60 }; // seconds
const BCRYPT_COST = 12;
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);
const MAX_FILE_SIZE = config.maxUploadMb * 1024 * 1024;
const CUSTOMER_DAILY_UPLOAD_BYTES = 500 * 1024 * 1024;

// ==================== ORIGIN / CSRF HELPERS ====================

const trustedOrigins = new Set([config.publicOrigin, ...config.allowedOrigins].filter(Boolean));
if (!config.isProd) ['http://localhost:5173', 'http://127.0.0.1:5173'].forEach((o) => trustedOrigins.add(o)); // Vite dev server only

function originAllowed(origin, host) {
  if (!origin) return true; // non-browser client; browsers always send Origin on cross-site writes
  if (trustedOrigins.has(origin)) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function requestOrigin(req) {
  const o = req.get('origin');
  if (o && o !== 'null') return o;
  if (o === 'null') return 'null';
  const ref = req.get('referer');
  if (ref) {
    try {
      return new URL(ref).origin;
    } catch {
      return 'null';
    }
  }
  return '';
}

function clientIp(req) {
  return req.ip || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

// ==================== CORE MIDDLEWARE ====================

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", ...[...trustedOrigins].map((o) => o.replace(/^http/, 'ws'))],
        frameSrc: ['https://www.google.com', 'https://maps.google.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.isProd ? { upgradeInsecureRequests: [] } : {})
      }
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false
  })
);
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=(), microphone=(self)');
  next();
});
app.use(compression());
if (config.allowedOrigins.length) {
  app.use('/api', cors({ origin: config.allowedOrigins, credentials: true }));
}
app.use(cookieParser());

// CSRF defence: state-changing API calls must come from our own site.
// (Session cookie is also SameSite=Lax + HttpOnly.)
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = requestOrigin(req);
  if (origin && !originAllowed(origin, req.get('host'))) {
    return res.status(403).json({ error: 'Request blocked: invalid origin.' });
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = sanitizeInput(req.body);
  next();
});

function limiter({ windowMs, max, message, key }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: key || clientIp,
    message: { error: message || 'Too many requests. Please slow down and try again shortly.' }
  });
}

app.use('/api', limiter({ windowMs: 15 * 60 * 1000, max: 900 }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const loginIpLimiter = limiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many sign-in attempts. Please try again in 15 minutes.' });
const loginAccountLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: 'Too many sign-in attempts for this account. Please try again in 15 minutes.',
  key: (req) => `login:${v.normEmail(req.body?.email)}:${clientIp(req)}`
});
const otpSendLimiter = limiter({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many code requests. Please try again later.' });
const otpVerifyLimiter = limiter({ windowMs: 15 * 60 * 1000, max: 25, message: 'Too many verification attempts. Please try again later.' });
const userKey = (req) => `u:${req.user?.id || clientIp(req)}`;
const uploadLimiter = limiter({ windowMs: 60 * 60 * 1000, max: 60, key: userKey, message: 'Upload limit reached. Please try again later.' });
const messageLimiter = limiter({ windowMs: 60 * 1000, max: 30, key: userKey, message: 'You are sending messages too fast.' });
const orderLimiter = limiter({ windowMs: 60 * 60 * 1000, max: 10, key: userKey, message: 'Too many orders. Please contact us via Messenger.' });

// ==================== SESSIONS (HttpOnly cookie, revocable) ====================

function userFromToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'axelon' });
    const user = store.findUserById(decoded.sub);
    if (!user || (user.tokenVersion || 0) !== decoded.tv) return null;
    return user;
  } catch {
    return null;
  }
}

function issueSession(res, user) {
  const ttl = user.role === 'admin' ? SESSION_TTL.admin : SESSION_TTL.customer;
  const token = jwt.sign({ sub: user.id, tv: user.tokenVersion || 0, role: user.role }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: ttl,
    issuer: 'axelon'
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: ttl * 1000
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/' });
}

function optionalAuth(req, res, next) {
  const user = userFromToken(req.cookies?.[COOKIE_NAME]);
  req.user = user ? store.publicUser(user) : null;
  next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) {
      clearSession(res);
      return res.status(401).json({ error: 'Please sign in first to access this feature.' });
    }
    next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden.' });
    next();
  });
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function hasMx(email) {
  const domain = email.split('@')[1];
  if (!domain) return false;
  try {
    const records = await Promise.race([dns.resolveMx(domain), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
    return Array.isArray(records) && records.some((r) => r.exchange && r.exchange !== '.');
  } catch {
    return false;
  }
}

// ==================== AUTH: REGISTRATION WITH EMAIL VERIFICATION ====================

const CODE_SENT_MSG = 'We sent a 6-digit code to your email. It expires in 10 minutes — check your Inbox and Spam folder.';

app.post(
  '/api/auth/register/request-otp',
  otpSendLimiter,
  wrap(async (req, res) => {
    const p = store.validateProfile(req.body || {});
    if (p.error) return res.status(400).json({ error: p.error });
    const pwErr = v.passwordProblem(req.body.password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const { email } = p.data;
    if (!(await hasMx(email))) {
      return res.status(400).json({ error: `The email domain "${email.split('@')[1]}" cannot receive mail. Please use a real email address.` });
    }

    // Do not reveal whether the email is registered: same response either way,
    // but the real owner gets a heads-up email instead of a code.
    if (store.findUserByEmail(email)) {
      const t = store.createOtp('exists', email);
      if (!t.error) mailer.sendAlreadyRegistered(email).catch((e) => console.error('Mail error:', e.message));
      return res.json({ success: true, email, message: CODE_SENT_MSG });
    }

    const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_COST);
    const otp = store.createOtp('register', email, { ...p.data, passwordHash });
    if (otp.error) return res.status(429).json({ error: otp.error });

    try {
      await mailer.sendRegistrationCode(email, p.data.fullName, otp.code);
    } catch (e) {
      console.error('Mail error:', e.message);
      return res.status(502).json({ error: 'We could not send the verification email right now. Please try again in a few minutes.' });
    }
    res.json({ success: true, email, message: CODE_SENT_MSG });
  })
);

app.post('/api/auth/register/verify-otp', otpVerifyLimiter, (req, res) => {
  const email = v.normEmail(req.body?.email);
  const result = store.verifyOtp('register', email, req.body?.code);
  if (result.error) return res.status(400).json({ error: result.error });

  const payload = result.pending.payload;
  if (!payload || store.findUserByEmail(email)) {
    return res.status(400).json({ error: 'This email is already registered. Please sign in instead.' });
  }
  if (store.findUserByPhone(payload.phone)) {
    return res.status(409).json({ error: 'This phone number is already linked to another account. Please use a different number.' });
  }
  const user = store.createUserFromPending(payload);
  issueSession(res, user);
  res.status(201).json({ user: store.publicUser(user) });
});

// ==================== AUTH: SIGN IN / OUT ====================

app.post(
  '/api/auth/login',
  loginIpLimiter,
  loginAccountLimiter,
  wrap(async (req, res) => {
    const email = v.normEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
    if (!email || !password) return res.status(400).json({ error: 'Please enter both Email and Password.' });

    const user = store.findUserByEmail(email);
    // Always run bcrypt so response time doesn't reveal whether the account exists.
    const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password.' });

    issueSession(res, user);
    res.json({ user: store.publicUser(user) });
  })
);

app.post('/api/auth/logout', (req, res) => {
  clearSession(res);
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ==================== AUTH: FORGOT PASSWORD ====================

const RESET_SENT_MSG =
  'If an account exists for this email, a 6-digit reset code has been sent. It expires in 10 minutes — check Inbox and Spam. (Codes can be requested once per minute.)';

app.post(
  '/api/auth/forgot-password/request-otp',
  otpSendLimiter,
  wrap(async (req, res) => {
    const email = v.normEmail(req.body?.email);
    if (!v.isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    const user = store.findUserByEmail(email);
    if (user) {
      const otp = store.createOtp('reset', email);
      if (!otp.error) {
        try {
          await mailer.sendPasswordResetCode(email, user.fullName, otp.code);
        } catch (e) {
          console.error('Mail error:', e.message);
          return res.status(502).json({ error: 'We could not send the email right now. Please try again in a few minutes.' });
        }
      }
    }
    res.json({ success: true, email, message: RESET_SENT_MSG });
  })
);

app.post(
  '/api/auth/forgot-password/reset',
  otpVerifyLimiter,
  wrap(async (req, res) => {
    const email = v.normEmail(req.body?.email);
    const pwErr = v.passwordProblem(req.body?.newPassword);
    if (pwErr) return res.status(400).json({ error: pwErr });
    const result = store.verifyOtp('reset', email, req.body?.code);
    if (result.error) return res.status(400).json({ error: result.error });
    const user = store.findUserByEmail(email);
    if (!user) return res.status(400).json({ error: 'Invalid or expired code.' });

    store.setPasswordHash(user, await bcrypt.hash(req.body.newPassword, BCRYPT_COST));
    revokeUserSockets(user.id);
    clearSession(res);
    mailer.sendPasswordChanged(user.email, user.fullName).catch((e) => console.error('Mail error:', e.message));
    res.json({ success: true, message: 'Password changed successfully! You can now sign in with your new password.' });
  })
);

// ==================== PUBLIC CATALOG ====================

app.get('/api/search', (req, res) => {
  res.json({ results: store.publicSearch(req.query.q) });
});

app.get('/api/bootstrap', optionalAuth, (req, res) => {
  res.json(store.getBootstrap({ admin: req.user?.role === 'admin' }));
});

app.get('/api/site-config', (req, res) => {
  res.json({ config: store.state.config });
});

// ==================== ADMIN: SITE CONFIG, SECTIONS, PRODUCTS ====================

function adminBoot() {
  return store.getBootstrap({ admin: true });
}

app.put('/api/site-config', requireAdmin, (req, res) => {
  const updated = store.updateConfig(req.body || {});
  emitSiteUpdated();
  res.json({ config: updated });
});

app.post('/api/sections', requireAdmin, (req, res) => {
  const result = store.addSection(req.body || {});
  if (result.error) return res.status(409).json({ error: result.error });
  emitSiteUpdated();
  res.status(201).json({ section: result.section, ...adminBoot() });
});

app.put('/api/sections/:sectionId', requireAdmin, (req, res) => {
  const result = store.updateSection(req.params.sectionId, req.body || {});
  if (result.error) return res.status(result.error.includes('not found') ? 404 : 409).json({ error: result.error });
  emitSiteUpdated();
  res.json({ section: result.section, ...adminBoot() });
});

app.delete('/api/sections/:sectionId', requireAdmin, (req, res) => {
  const result = store.deleteSection(req.params.sectionId);
  if (result.error) return res.status(400).json({ error: result.error });
  purgeMediaFiles(result.mediaIdsToPurge);
  emitSiteUpdated();
  res.json({ success: true, ...adminBoot() });
});

app.post('/api/sections/:sectionId/products', requireAdmin, (req, res) => {
  const result = store.addProductToSection(req.params.sectionId, req.body || {});
  if (result.error) return res.status(result.error.includes('not found') ? 404 : 409).json({ error: result.error });
  emitSiteUpdated();
  res.status(201).json({ product: result.product, ...adminBoot() });
});

app.put('/api/sections/:sectionId/products/:productId', requireAdmin, (req, res) => {
  const result = store.updateProductInSection(req.params.sectionId, req.params.productId, req.body || {});
  if (result.error) return res.status(result.error.includes('not found') ? 404 : 409).json({ error: result.error });
  purgeMediaFiles(result.mediaIdsToPurge);
  emitSiteUpdated();
  res.json({ product: result.product, ...adminBoot() });
});

function handleDeleteProduct(req, res) {
  const result = store.deleteProduct(req.params.productId);
  if (!result) return res.status(404).json({ error: 'Product not found' });
  purgeMediaFiles(result.mediaIdsToPurge);
  emitSiteUpdated();
  res.json({ success: true, ...adminBoot() });
}
app.delete('/api/sections/:sectionId/products/:productId', requireAdmin, handleDeleteProduct);
app.delete('/api/products/:productId', requireAdmin, handleDeleteProduct);

// ==================== ENCRYPTED MEDIA: UPLOAD ====================

const uploadQuota = new Map(); // userId -> { windowStart, bytes }

const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    filename: (req, file, cb) => cb(null, `up-${crypto.randomBytes(16).toString('hex')}`)
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 5, fieldSize: 1024, parts: 7 }
});

function safeFileName(name) {
  const base = path.basename(String(name || 'file')).replace(/[\u0000-\u001f\u007f"\\/<>:|?*]/g, '_');
  return base.slice(-120) || 'file';
}

app.post('/api/media/upload', requireAuth, uploadLimiter, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    const tmpPath = req.file?.path;
    const cleanup = () => tmpPath && fsp.unlink(tmpPath).catch(() => {});
    try {
      if (err) {
        cleanup();
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `File exceeds the ${config.maxUploadMb}MB maximum limit.` });
        return res.status(400).json({ error: 'Upload failed. Please try a different file.' });
      }
      if (!req.file) return res.status(400).json({ error: 'No file provided.' });
      if (req.file.size === 0) {
        cleanup();
        return res.status(400).json({ error: 'The file is empty.' });
      }

      const isAdmin = req.user.role === 'admin';
      const purpose = req.query.purpose === 'product' || req.body?.purpose === 'product' ? 'product' : 'chat';
      if (purpose === 'product' && !isAdmin) {
        cleanup();
        return res.status(403).json({ error: 'Forbidden.' });
      }

      if (!isAdmin) {
        const now = Date.now();
        const q = uploadQuota.get(req.user.id) || { windowStart: now, bytes: 0 };
        if (now - q.windowStart > 24 * 60 * 60 * 1000) Object.assign(q, { windowStart: now, bytes: 0 });
        if (q.bytes + req.file.size > CUSTOMER_DAILY_UPLOAD_BYTES) {
          cleanup();
          return res.status(429).json({ error: 'Daily upload limit reached. Please try again tomorrow.' });
        }
        q.bytes += req.file.size;
        uploadQuota.set(req.user.id, q);
      }

      const type = await detectFile(tmpPath, req.file.mimetype);
      if (!type || (purpose === 'product' && type.category !== 'image')) {
        cleanup();
        return res.status(415).json({
          error:
            purpose === 'product'
              ? 'Only real image files (JPG, PNG, WEBP, GIF, AVIF) are allowed for product photos.'
              : 'This file type is not allowed. You can send photos, videos, audio/voice notes, or PDF files.'
        });
      }

      const fileId = `media-${Date.now().toString(36)}-${crypto.randomBytes(12).toString('hex')}`;
      const { size, sha256 } = await encryptFileToPath(tmpPath, path.join(UPLOADS_DIR, `${fileId}.enc`));
      cleanup();

      const record = {
        id: fileId,
        format: 2,
        purpose,
        ownerId: req.user.id,
        threadId: null,
        originalName: safeFileName(req.file.originalname),
        mimeType: type.mime,
        size,
        category: type.category,
        sha256,
        url: `/api/media/stream/${fileId}`,
        createdAt: new Date().toISOString()
      };
      store.addMedia(record);
      const { ownerId, threadId, sha256: _h, format, ...publicRecord } = record;
      res.status(201).json({ file: publicRecord });
    } catch (e) {
      cleanup();
      next(e);
    }
  });
});

// ==================== ENCRYPTED MEDIA: STREAM (access-controlled) ====================

function canAccessMedia(meta, user) {
  if (meta.purpose === 'product' || meta.purpose === 'legacy') return true;
  if (!user) return false;
  return user.role === 'admin' || meta.ownerId === user.id || meta.threadId === user.id;
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return null;
  return { start, end };
}

app.get(
  '/api/media/stream/:id',
  optionalAuth,
  wrap(async (req, res) => {
    const meta = store.getMedia(req.params.id);
    if (!meta || !canAccessMedia(meta, req.user)) return res.status(404).json({ error: 'Media not found' });
    const encPath = path.join(UPLOADS_DIR, `${meta.id}.enc`);
    if (!fs.existsSync(encPath)) return res.status(404).json({ error: 'Media not found' });

    const isPublic = meta.purpose === 'product' || meta.purpose === 'legacy';
    const inlineOk = ['image', 'video', 'audio'].includes(meta.category) && req.query.download !== '1';
    const fileName = safeFileName(meta.originalName);
    const asciiName = fileName.replace(/[^\x20-\x7e]/g, '_');

    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', isPublic ? 'public, max-age=86400' : 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `${inlineOk ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.setHeader('Accept-Ranges', 'bytes');

    // Legacy (v1) files: small, decrypted in memory
    if (meta.format !== 2) {
      const buf = decryptBufferLegacy(await fsp.readFile(encPath));
      const r = req.headers.range ? parseRange(req.headers.range, buf.length) : null;
      if (req.headers.range && !r) {
        res.setHeader('Content-Range', `bytes */${buf.length}`);
        return res.status(416).end();
      }
      if (r) {
        res.status(206).setHeader('Content-Range', `bytes ${r.start}-${r.end}/${buf.length}`);
        res.setHeader('Content-Length', r.end - r.start + 1);
        return res.end(buf.subarray(r.start, r.end + 1));
      }
      res.setHeader('Content-Length', buf.length);
      return res.end(buf);
    }

    const size = await plainSizeV2(encPath);
    if (req.headers.range) {
      const r = parseRange(req.headers.range, size);
      if (!r) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${r.start}-${r.end}/${size}`);
      res.setHeader('Content-Length', r.end - r.start + 1);
      const { source, stream, skipper } = await createRangeDecryptStreamV2(encPath, r.start, r.end);
      return pipeline(source, stream, skipper, res).catch(() => res.destroy());
    }
    res.setHeader('Content-Length', size);
    const { source, stream } = await createDecryptStreamV2(encPath);
    return pipeline(source, stream, res).catch(() => res.destroy());
  })
);

function purgeMediaFiles(ids = []) {
  const valid = (ids || []).filter((id) => store.getMedia(id));
  valid.forEach((id) => fsp.unlink(path.join(UPLOADS_DIR, `${id}.enc`)).catch(() => {}));
  return store.removeMedia(valid).length;
}

// Housekeeping: delete chat uploads never attached to a message (after 24h) and stale temp files.
setInterval(async () => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const orphans = Object.values(store.state.media || {})
    .filter((m) => m.purpose === 'chat' && !m.threadId && Date.parse(m.createdAt) < cutoff)
    .map((m) => m.id);
  if (orphans.length) purgeMediaFiles(orphans);
  try {
    for (const f of await fsp.readdir(TMP_DIR)) {
      const p = path.join(TMP_DIR, f);
      const st = await fsp.stat(p);
      if (Date.now() - st.mtimeMs > 60 * 60 * 1000) await fsp.unlink(p);
    }
  } catch {}
}, 60 * 60 * 1000).unref();

// ==================== ORDERS ====================

app.post('/api/orders', requireAuth, orderLimiter, (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Admin account cannot place orders.' });
  const result = store.createOrder(req.user, req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  const { order } = result;

  const thread = store.ensureThread(req.user.id, req.user.fullName, req.user.phone, req.user.email);
  const itemSummary = order.items.map((i) => `• ${i.name} × ${i.quantity} (TK ${(i.price * i.quantity).toLocaleString()})`).join('\n');
  const posted = store.addMessage({
    clientId: thread.clientId,
    sender: 'client',
    senderName: req.user.fullName,
    text:
      `🧾 NEW BOOKING ORDER SLIP #${order.id}\nClient: ${order.client.name} | Phone: ${order.client.phone}\n` +
      `Address: ${order.client.address}\n\n${itemSummary}\n\nTotal Payable: TK ${order.totalAmount.toLocaleString()}`
  });
  if (posted) emitChat(thread.clientId, posted);
  io.to('admin-room').emit('orders:new', order);
  res.status(201).json({ order });
});

app.get('/api/orders', requireAdmin, (req, res) => {
  res.json({ orders: store.getOrders() });
});

// ==================== ADMIN: CLIENT ACCOUNTS ====================

app.get('/api/admin/clients', requireAdmin, (req, res) => {
  res.json({ clients: store.getAllClients() });
});

app.post(
  '/api/admin/clients',
  requireAdmin,
  wrap(async (req, res) => {
    const p = store.validateProfile(req.body || {});
    if (p.error) return res.status(400).json({ error: p.error });
    const pwErr = v.passwordProblem(req.body.password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    if (store.findUserByEmail(p.data.email)) return res.status(400).json({ error: 'An account with this email already exists.' });
    if (store.findUserByPhone(p.data.phone)) return res.status(400).json({ error: 'An account with this phone number already exists.' });
    const client = store.adminCreateClient(p.data, await bcrypt.hash(req.body.password, BCRYPT_COST));
    res.status(201).json({ client: store.getAllClients().find((c) => c.id === client.id), clients: store.getAllClients() });
  })
);

app.put(
  '/api/admin/clients/:userId',
  requireAdmin,
  wrap(async (req, res) => {
    const body = req.body || {};
    const partial = {};
    ['fullName', 'email', 'phone', 'address'].forEach((k) => {
      if (body[k] !== undefined && String(body[k]).trim() !== '') partial[k] = body[k];
    });
    const p = store.validateProfile(partial, { partial: true });
    if (p.error) return res.status(400).json({ error: p.error });
    let hash = null;
    if (body.newPassword && String(body.newPassword).trim()) {
      const pwErr = v.passwordProblem(String(body.newPassword));
      if (pwErr) return res.status(400).json({ error: pwErr });
      hash = await bcrypt.hash(String(body.newPassword), BCRYPT_COST);
    }
    const result = store.adminUpdateClient(req.params.userId, p.data, hash);
    if (result.error) return res.status(400).json({ error: result.error });
    if (hash || p.data.email) revokeUserSockets(req.params.userId);
    res.json({ client: store.getAllClients().find((c) => c.id === req.params.userId), clients: store.getAllClients() });
  })
);

app.delete('/api/admin/clients/:userId', requireAdmin, (req, res) => {
  const ok = store.adminDeleteClient(req.params.userId);
  if (!ok) return res.status(404).json({ error: 'Client not found' });
  revokeUserSockets(req.params.userId);
  res.json({ success: true, clients: store.getAllClients() });
});

// ==================== MESSENGER ====================

app.post('/api/chat/session', requireAuth, (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Use the admin inbox.' });
  const thread = store.ensureThread(req.user.id, req.user.fullName, req.user.phone, req.user.email);
  res.json({ thread });
});

app.get('/api/chat/threads', requireAdmin, (req, res) => {
  res.json({ threads: store.getAllThreads() });
});

app.post('/api/chat/admin-start', requireAdmin, (req, res) => {
  const body = req.body || {};
  const requested = v.str(body.clientId, 80);
  const existingUser = requested ? store.findUserById(requested) : null;
  if (existingUser && existingUser.role !== 'admin') {
    return res.json({ thread: store.ensureThread(existingUser.id, existingUser.fullName, existingUser.phone, existingUser.email) });
  }
  if (requested && store.getThread(requested)) return res.json({ thread: store.getThread(requested) });
  const name = v.str(body.clientName, 80);
  if (!name) return res.status(400).json({ error: 'Client name is required.' });
  const id = `client-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  res.json({ thread: store.ensureThread(id, name, v.str(body.clientPhone, 30), v.normEmail(body.clientEmail)) });
});

app.post('/api/chat/message', requireAuth, messageLimiter, (req, res) => {
  const body = req.body || {};
  const isAdmin = req.user.role === 'admin';

  let targetClientId;
  if (isAdmin) {
    targetClientId = v.str(body.clientId, 80);
    if (!store.getThread(targetClientId)) {
      const u = store.findUserById(targetClientId);
      if (!u || u.role === 'admin') return res.status(404).json({ error: 'Conversation not found.' });
      store.ensureThread(u.id, u.fullName, u.phone, u.email);
    }
  } else {
    targetClientId = req.user.id;
    store.ensureThread(req.user.id, req.user.fullName, req.user.phone, req.user.email);
  }

  // Attachments: only files THIS user uploaded, referenced by id — the server builds the records.
  const rawAtt = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [];
  const attachments = [];
  for (const a of rawAtt) {
    const id = typeof a === 'string' ? a : a?.id;
    const meta = store.getMedia(id);
    if (!meta || meta.purpose !== 'chat' || meta.ownerId !== req.user.id || (meta.threadId && meta.threadId !== targetClientId)) {
      return res.status(400).json({ error: 'One of the attachments is invalid. Please upload it again.' });
    }
    meta.threadId = targetClientId;
    attachments.push({
      id: meta.id,
      originalName: meta.originalName,
      mimeType: meta.mimeType,
      size: meta.size,
      category: meta.category,
      url: meta.url,
      createdAt: meta.createdAt
    });
  }

  const productId = v.str(body.inquiredProductId || body.inquiredProduct?.id, 80);
  const product = productId ? store.publicProduct(store.findProduct(productId)) : null;
  const inquiredProduct = product
    ? { id: product.id, name: product.name, price: product.price, images: (product.images || []).slice(0, 1), fields: product.fields }
    : null;

  const text = v.str(body.text, 4000);
  if (!text && attachments.length === 0 && !inquiredProduct) return res.status(400).json({ error: 'Message is empty.' });

  const posted = store.addMessage({
    clientId: targetClientId,
    sender: isAdmin ? 'admin' : 'client',
    senderName: isAdmin ? 'AXELON Admin' : req.user.fullName,
    text,
    attachments,
    inquiredProduct
  });
  emitChat(targetClientId, posted);
  res.status(201).json(posted);
});

app.delete('/api/chat/message/:clientId/:messageId', requireAdmin, (req, res) => {
  const { clientId, messageId } = req.params;
  const result = store.deleteMessage(clientId, messageId);
  if (!result) return res.status(404).json({ error: 'Message or conversation not found.' });
  const freedFiles = purgeMediaFiles(result.removedAttachmentIds);
  io.to(`thread:${clientId}`).to('admin-room').emit('chat:message-deleted', { clientId, messageId, thread: result.thread });
  res.json({ success: true, thread: result.thread, freedFiles });
});

app.delete('/api/chat/thread/:clientId', requireAdmin, (req, res) => {
  const { clientId } = req.params;
  const result = store.deleteThread(clientId);
  if (!result) return res.status(404).json({ error: 'Conversation not found.' });
  const freedFiles = purgeMediaFiles(result.removedAttachmentIds);
  io.to(`thread:${clientId}`).to('admin-room').emit('chat:thread-deleted', { clientId });
  res.json({ success: true, threads: store.getAllThreads(), freedFiles });
});

app.all('/api/*', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ==================== SOCKET.IO (authenticated rooms only) ====================

const io = new Server(server, {
  maxHttpBufferSize: 100 * 1024,
  serveClient: false,
  cors: config.allowedOrigins.length ? { origin: config.allowedOrigins, credentials: true } : undefined,
  // Blocks cross-site WebSocket hijacking: only our own pages may connect with the user's cookie.
  allowRequest: (req, cb) => cb(null, originAllowed(req.headers.origin, req.headers.host))
});

function parseCookies(header = '') {
  const out = {};
  String(header)
    .split(';')
    .forEach((part) => {
      const i = part.indexOf('=');
      if (i > 0) {
        try {
          out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
        } catch {}
      }
    });
  return out;
}

io.use((socket, next) => {
  const user = userFromToken(parseCookies(socket.handshake.headers.cookie)[COOKIE_NAME]);
  socket.data.user = user ? store.publicUser(user) : null;
  next();
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  if (!user) return; // guests only receive public catalog updates
  socket.join(`user:${user.id}`);
  if (user.role === 'admin') socket.join('admin-room');
  else socket.join(`thread:${user.id}`); // a customer can ONLY ever join their own conversation
});

function emitChat(clientId, { thread, message }) {
  io.to(`thread:${clientId}`).emit('chat:message', { clientId, message, thread });
  io.to('admin-room').emit('chat:admin-update', { clientId, message, thread });
}

function emitSiteUpdated() {
  io.except('admin-room').emit('site:updated', store.getBootstrap());
  io.to('admin-room').emit('site:updated', adminBoot());
}

function revokeUserSockets(userId) {
  io.in(`user:${userId}`).disconnectSockets(true);
}

// ==================== FRONTEND (production build) ====================

const CLIENT_DIST = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      dotfiles: 'ignore',
      setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
      }
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// ==================== ERRORS ====================

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  console.error('Unhandled error:', err?.stack || err);
  if (res.headersSent) return res.destroy();
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));

store.connectMongo();
server.listen(config.port, () => {
  console.log(`AXELON server running on port ${config.port} (${config.isProd ? 'production' : 'development'})`);
  if (!config.smtpConfigured) console.warn('[dev] SMTP not configured — verification codes are printed to this console only.');
});

module.exports = { app, server };
