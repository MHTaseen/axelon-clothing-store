require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dns = require('dns').promises;
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Server } = require('socket.io');

const siteStore = require('./models/SiteStore');
const { encryptBuffer, decryptBuffer, sanitizeInput } = require('./security/cryptoVault');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'AXELON_JWT_ULTRA_SECURE_SIGNING_KEY_2026_9F8E7D6C5B4A';

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MEDIA_INDEX_FILE = path.join(UPLOADS_DIR, 'media_index.json');
let mediaIndex = {};
if (fs.existsSync(MEDIA_INDEX_FILE)) {
  try {
    mediaIndex = JSON.parse(fs.readFileSync(MEDIA_INDEX_FILE, 'utf8'));
  } catch {
    mediaIndex = {};
  }
}
function saveMediaIndex() {
  fs.writeFileSync(MEDIA_INDEX_FILE, JSON.stringify(mediaIndex, null, 2), 'utf8');
}

const io = new Server(server, {
  maxHttpBufferSize: 105 * 1024 * 1024,
  cors: { origin: true, credentials: true }
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
  })
);
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '105mb' }));
app.use(express.urlencoded({ extended: true, limit: '105mb' }));

// Global XSS & NoSQL injection sanitization
app.use((req, res, next) => {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  if (req.params) req.params = sanitizeInput(req.params);
  res.setHeader('X-Security-Vault', 'AES-256-GCM-Active');
  next();
});

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// 100MB Encrypted Media Upload Engine (Images, Videos, Audio, PDFs, Any File)
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const blocked = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.vbs', '.scr'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (blocked.includes(ext)) return cb(new Error('Executable files are blocked for security.'));
    cb(null, true);
  }
});

function classifyMime(mime = '', filename = '') {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)) return 'image';
  if (['.mp4', '.webm', '.mov', '.mkv', '.avi'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) return 'audio';
  return 'document';
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

// Auth Middlewares
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || req.cookies?.axelon_token;
  if (!token) return res.status(401).json({ error: 'Please sign in first to access this feature.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = siteStore.findUserByEmail(decoded.email);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    req.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only the single Master Admin can perform this action.' });
    }
    next();
  });
}

// Verify email domain has valid MX mail records (real email domain authentication)
async function verifyEmailDomainMX(email) {
  const domain = String(email || '').split('@')[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

// ==================== AUTHENTICATION & EMAIL VERIFICATION API ====================

// Step 1 of Registration: Validate fields, uniqueness (1 account per email & phone), MX record check, and send 6-digit OTP
app.post('/api/auth/register/request-otp', authLimiter, async (req, res) => {
  const { fullName, email, phone, address, password } = req.body;
  const normEmail = String(email || '').toLowerCase().trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // Authenticate that the email domain actually exists and receives mail
  const hasMx = await verifyEmailDomainMX(normEmail);
  if (!hasMx) {
    return res.status(400).json({
      error: `Email domain "${normEmail.split('@')[1]}" could not be verified as a real mail server. Please use a real email address (e.g. Gmail, Outlook, Yahoo).`
    });
  }

  const result = siteStore.createRegistrationOtp({ fullName, email: normEmail, phone, address, password });
  if (result.error) return res.status(400).json({ error: result.error });

  console.log(`\n📧 [EMAIL VERIFICATION OTP] To: ${result.email} | Code: ${result.verificationCode} (Valid 10 min)\n`);

  res.json({
    success: true,
    email: result.email,
    message: `A 6-digit verification code has been generated for ${result.email}.`,
    // Provided in local dev preview so you can test email verification immediately without configuring an external SMTP server
    devPreviewCode: result.verificationCode
  });
});

// Step 2 of Registration: Verify 6-digit Email OTP & finalize account creation
app.post('/api/auth/register/verify-otp', authLimiter, (req, res) => {
  const { email, code } = req.body;
  const result = siteStore.verifyRegistrationOtp(email, code);
  if (result.error) return res.status(400).json({ error: result.error });

  const u = result.user;
  const token = jwt.sign({ id: u.id, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: '7d' });

  res.cookie('axelon_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.status(201).json({
    token,
    user: {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      address: u.address,
      role: u.role
    }
  });
});

// Sign In with Email & Password ONLY (Handles both Customers & the Single Master Admin)
app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter both Email and Password.' });
  }
  const user = siteStore.findUserByEmail(email);
  const validPass = user && bcrypt.compareSync(password, user.passwordHash);
  if (!user || !validPass) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: user.role === 'admin' ? '24h' : '7d' }
  );

  res.cookie('axelon_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role
    }
  });
});

// Forgot Password Step 1: Request Email OTP
app.post('/api/auth/forgot-password/request-otp', authLimiter, (req, res) => {
  const { email } = req.body;
  const result = siteStore.createPasswordResetOtp(email);
  if (result.error) return res.status(404).json({ error: result.error });

  console.log(`\n🔐 [PASSWORD RESET OTP] To: ${result.email} | Code: ${result.verificationCode} (Valid 10 min)\n`);

  res.json({
    success: true,
    email: result.email,
    message: `A 6-digit password reset code has been sent to ${result.email}.`,
    devPreviewCode: result.verificationCode
  });
});

// Forgot Password Step 2: Verify OTP & Set New Strong Password
app.post('/api/auth/forgot-password/reset', authLimiter, (req, res) => {
  const { email, code, newPassword } = req.body;
  const result = siteStore.confirmPasswordReset(email, code, newPassword);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ success: true, message: 'Password changed successfully! You can now sign in with your new password.' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ==================== PUBLIC SEARCH API (Anyone Can Search Without Signing In) ====================

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  const all = siteStore.getAllProductsFlat();
  if (!q) return res.json({ results: all });

  const results = all.filter((p) => {
    const inName = (p.name || '').toLowerCase().includes(q);
    const inSection = (p.sourceSectionName || '').toLowerCase().includes(q);
    const inVisibleFields = (p.fields || []).some(
      (f) =>
        f.visibleToClient !== false &&
        !(f.label || '').toLowerCase().includes('description') &&
        (`${f.label} ${f.value}`).toLowerCase().includes(q)
    );
    return inName || inSection || inVisibleFields;
  });
  res.json({ results });
});

// ==================== SITE CONFIG & SECTIONS API ====================

app.get('/api/bootstrap', (req, res) => {
  res.json(siteStore.getBootstrap());
});

app.get('/api/site-config', (req, res) => {
  res.json({ config: siteStore.state.config });
});

app.put('/api/site-config', requireAdmin, (req, res) => {
  const updated = siteStore.updateConfig(req.body);
  io.emit('site:updated', siteStore.getBootstrap());
  res.json({ config: updated });
});

// Sections CRUD ("Our Collection" is mandatory and always first) — Admin Only
app.post('/api/sections', requireAdmin, (req, res) => {
  const result = siteStore.addSection(req.body);
  if (result.error) return res.status(409).json({ error: result.error });
  const boot = siteStore.getBootstrap();
  io.emit('site:updated', boot);
  res.status(201).json({ section: result.section, ...boot });
});

app.put('/api/sections/:sectionId', requireAdmin, (req, res) => {
  const result = siteStore.updateSection(req.params.sectionId, req.body);
  if (result.error) return res.status(result.error.includes('not found') ? 404 : 409).json({ error: result.error });
  const boot = siteStore.getBootstrap();
  io.emit('site:updated', boot);
  res.json({ section: result.section, ...boot });
});

app.delete('/api/sections/:sectionId', requireAdmin, (req, res) => {
  const result = siteStore.deleteSection(req.params.sectionId);
  if (result.error) return res.status(400).json(result);
  const boot = siteStore.getBootstrap();
  io.emit('site:updated', boot);
  res.json({ success: true, ...boot });
});

// Products CRUD inside any section — Admin Only (with duplicate-name prevention)
app.post('/api/sections/:sectionId/products', requireAdmin, (req, res) => {
  const result = siteStore.addProductToSection(req.params.sectionId, req.body);
  if (result.error) return res.status(result.error.includes('not found') ? 404 : 409).json({ error: result.error });
  const boot = siteStore.getBootstrap();
  io.emit('site:updated', boot);
  res.status(201).json({ product: result.product, ...boot });
});

app.put('/api/sections/:sectionId/products/:productId', requireAdmin, (req, res) => {
  const result = siteStore.updateProductInSection(req.params.sectionId, req.params.productId, req.body);
  if (result.error) return res.status(result.error.includes('not found') ? 404 : 409).json({ error: result.error });
  const boot = siteStore.getBootstrap();
  io.emit('site:updated', boot);
  res.json({ product: result.product, ...boot });
});

app.delete('/api/sections/:sectionId/products/:productId', requireAdmin, (req, res) => {
  const result = siteStore.deleteProductFromSection(req.params.sectionId, req.params.productId);
  if (!result) return res.status(404).json({ error: 'Product not found' });

  // Permanently delete any uploaded encrypted media files for this product from disk
  (result.mediaIdsToPurge || []).forEach((fileId) => {
    const encPath = path.join(UPLOADS_DIR, `${fileId}.enc`);
    if (fs.existsSync(encPath)) {
      try {
        fs.unlinkSync(encPath);
      } catch { }
    }
    if (mediaIndex[fileId]) {
      delete mediaIndex[fileId];
    }
  });
  if ((result.mediaIdsToPurge || []).length > 0) saveMediaIndex();

  const boot = siteStore.getBootstrap();
  io.emit('site:updated', boot);
  res.json({ success: true, ...boot });
});

// Direct permanent product deletion by productId from anywhere on the site — Admin Only
app.delete('/api/products/:productId', requireAdmin, (req, res) => {
  const result = siteStore.deleteProductFromSection(null, req.params.productId);
  if (!result) return res.status(404).json({ error: 'Product not found' });

  (result.mediaIdsToPurge || []).forEach((fileId) => {
    const encPath = path.join(UPLOADS_DIR, `${fileId}.enc`);
    if (fs.existsSync(encPath)) {
      try {
        fs.unlinkSync(encPath);
      } catch { }
    }
    if (mediaIndex[fileId]) {
      delete mediaIndex[fileId];
    }
  });
  if ((result.mediaIdsToPurge || []).length > 0) saveMediaIndex();

  const boot = siteStore.getBootstrap();
  io.emit('site:updated', boot);
  res.json({ success: true, ...boot });
});

// ==================== 100MB ENCRYPTED MEDIA UPLOAD & STREAMING ====================

app.post('/api/media/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File exceeds the 100MB maximum limit.' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });

    try {
      const fileId = 'media-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const encryptedBinary = encryptBuffer(req.file.buffer);
      fs.writeFileSync(path.join(UPLOADS_DIR, `${fileId}.enc`), encryptedBinary);

      const record = {
        id: fileId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || 'application/octet-stream',
        size: req.file.size,
        category: classifyMime(req.file.mimetype, req.file.originalname),
        sha256,
        url: `/api/media/stream/${fileId}`,
        createdAt: new Date().toISOString()
      };
      mediaIndex[fileId] = record;
      saveMediaIndex();

      res.status(201).json({ file: record });
    } catch (e) {
      res.status(500).json({ error: 'Encryption failed during upload.' });
    }
  });
});

app.get('/api/media/stream/:id', (req, res) => {
  const meta = mediaIndex[req.params.id];
  if (!meta) return res.status(404).json({ error: 'Media not found' });
  const encPath = path.join(UPLOADS_DIR, `${req.params.id}.enc`);
  if (!fs.existsSync(encPath)) return res.status(404).json({ error: 'Encrypted file missing' });

  try {
    const decrypted = decryptBuffer(fs.readFileSync(encPath));
    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.originalName)}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.originalName)}"`);
    }

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : decrypted.length - 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${decrypted.length}`);
      res.setHeader('Content-Length', end - start + 1);
      return res.end(decrypted.subarray(start, end + 1));
    }

    res.setHeader('Content-Length', decrypted.length);
    return res.end(decrypted);
  } catch {
    res.status(500).json({ error: 'Media decryption integrity failed.' });
  }
});

// ==================== BOOKING ORDERS API ====================

app.post('/api/orders', (req, res) => {
  const order = siteStore.createOrder(req.body);

  // Also post booking slip summary to the client's Messenger thread so Admin receives it immediately
  if (req.body.clientId) {
    const itemSummary = (order.items || [])
      .map((i) => `• ${i.name} × ${i.quantity} (TK ${(i.price * i.quantity).toLocaleString()})`)
      .join('\n');

    const { thread, message } = siteStore.addMessage({
      clientId: req.body.clientId,
      clientName: order.client.name,
      clientPhone: order.client.phone,
      clientEmail: order.client.email,
      sender: 'client',
      text: `🧾 NEW BOOKING ORDER SLIP #${order.id}\nClient: ${order.client.name} | Phone: ${order.client.phone}\nAddress: ${order.client.address}\n\n${itemSummary}\n\nTotal Payable: TK ${order.totalAmount.toLocaleString()}`,
      attachments: [],
      inquiredProduct: null
    });

    io.to(`thread:${req.body.clientId}`).emit('chat:message', { clientId: req.body.clientId, message, thread });
    io.to('admin-room').emit('chat:admin-update', { clientId: req.body.clientId, message, thread });
  }

  io.to('admin-room').emit('orders:new', order);
  res.status(201).json({ order });
});

app.get('/api/orders', requireAdmin, (req, res) => {
  res.json({ orders: siteStore.getOrders() });
});

// ==================== ADMIN CLIENT ACCOUNTS CRUD API ====================

app.get('/api/admin/clients', requireAdmin, (req, res) => {
  res.json({ clients: siteStore.getAllClients() });
});

app.post('/api/admin/clients', requireAdmin, (req, res) => {
  const result = siteStore.adminCreateClient(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json({ client: result.client, clients: siteStore.getAllClients() });
});

app.put('/api/admin/clients/:userId', requireAdmin, (req, res) => {
  const result = siteStore.adminUpdateClient(req.params.userId, req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ client: result.client, clients: siteStore.getAllClients() });
});

app.delete('/api/admin/clients/:userId', requireAdmin, (req, res) => {
  const ok = siteStore.adminDeleteClient(req.params.userId);
  if (!ok) return res.status(404).json({ error: 'Client not found' });
  res.json({ success: true, clients: siteStore.getAllClients() });
});

// ==================== MESSENGER CHAT API (SIGNED-IN USERS ONLY + 100MB FILES) ====================

app.post('/api/chat/session', requireAuth, (req, res) => {
  const clientId = req.user.id;
  const thread = siteStore.ensureThread(clientId, req.user.fullName, req.user.phone, req.user.email);
  res.json({ thread });
});

app.get('/api/chat/threads', requireAdmin, (req, res) => {
  res.json({ threads: siteStore.getAllThreads() });
});

app.post('/api/chat/admin-start', requireAdmin, (req, res) => {
  const { clientId, clientName, clientPhone, clientEmail } = req.body;
  const targetId = clientId || 'client-' + Date.now();
  const thread = siteStore.ensureThread(targetId, clientName, clientPhone, clientEmail);
  res.json({ thread });
});

app.post('/api/chat/message', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const targetClientId = isAdmin ? req.body.clientId : req.user.id;
  if (!targetClientId) return res.status(400).json({ error: 'clientId required' });

  const { thread, message } = siteStore.addMessage({
    clientId: targetClientId,
    clientName: isAdmin ? req.body.clientName : req.user.fullName,
    clientPhone: isAdmin ? req.body.clientPhone : req.user.phone,
    clientEmail: isAdmin ? req.body.clientEmail : req.user.email,
    sender: isAdmin ? 'admin' : 'client',
    senderName: isAdmin ? 'AXELON Admin' : req.user.fullName,
    text: req.body.text,
    attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
    inquiredProduct: req.body.inquiredProduct || null
  });

  io.to(`thread:${targetClientId}`).emit('chat:message', { clientId: targetClientId, message, thread });
  io.to('admin-room').emit('chat:admin-update', { clientId: targetClientId, message, thread });

  res.status(201).json({ thread, message });
});

// Helper: permanently unlink encrypted media files from disk & index to free host storage
function purgeMediaFilesFromDisk(fileIds = []) {
  let purged = 0;
  fileIds.forEach((fileId) => {
    const encPath = path.join(UPLOADS_DIR, `${fileId}.enc`);
    if (fs.existsSync(encPath)) {
      try {
        fs.unlinkSync(encPath);
        purged++;
      } catch {}
    }
    if (mediaIndex[fileId]) delete mediaIndex[fileId];
  });
  if (fileIds.length > 0) saveMediaIndex();
  return purged;
}

// Admin-Only: Delete Any Specific Message (removed from BOTH Admin & Client + purges attached media files from disk)
app.delete('/api/chat/message/:clientId/:messageId', requireAdmin, (req, res) => {
  const { clientId, messageId } = req.params;
  const result = siteStore.deleteMessage(clientId, messageId);
  if (!result) return res.status(404).json({ error: 'Message or conversation not found.' });

  const freedFiles = purgeMediaFilesFromDisk(result.removedAttachmentIds);

  io.to(`thread:${clientId}`).emit('chat:message-deleted', { clientId, messageId, thread: result.thread });
  io.to('admin-room').emit('chat:message-deleted', { clientId, messageId, thread: result.thread });

  res.json({ success: true, thread: result.thread, freedFiles });
});

// Admin-Only: Delete Entire Conversation (removed from BOTH Admin & Client + purges all media files from disk)
app.delete('/api/chat/thread/:clientId', requireAdmin, (req, res) => {
  const { clientId } = req.params;
  const result = siteStore.deleteThread(clientId);
  if (!result) return res.status(404).json({ error: 'Conversation not found.' });

  const freedFiles = purgeMediaFilesFromDisk(result.removedAttachmentIds);

  io.to(`thread:${clientId}`).emit('chat:thread-deleted', { clientId });
  io.to('admin-room').emit('chat:thread-deleted', { clientId });

  res.json({ success: true, threads: siteStore.getAllThreads(), freedFiles });
});

// ==================== SOCKET.IO REAL-TIME ====================

io.on('connection', (socket) => {
  socket.on('join:thread', ({ clientId }) => {
    if (clientId) socket.join(`thread:${clientId}`);
  });
  socket.on('join:admin', () => {
    socket.join('admin-room');
  });
});

// Serve production frontend if built
const CLIENT_DIST = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Secure AXELON MERN Server running on http://localhost:${PORT}`);
});
