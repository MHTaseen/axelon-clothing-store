// Input validation helpers shared by routes and the data store.

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
// Bangladesh mobile numbers: 01XXXXXXXXX, optionally prefixed with +88 / 88
const BD_PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;
const MEDIA_ID_RE = /^media-[a-z0-9]+-[a-f0-9]{16,32}$/;

function str(v, max = 200) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

function normEmail(v) {
  return str(v, 254).toLowerCase();
}

function isEmail(v) {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v);
}

function normPhone(v) {
  return str(v, 30).replace(/[\s\-()]/g, '');
}

function isPhone(v) {
  return BD_PHONE_RE.test(normPhone(v));
}

function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters long.';
  if (Buffer.byteLength(pw, 'utf8') > 72) return 'Password is too long (maximum 72 bytes).';
  if (!/[a-z]/.test(pw)) return 'Password must include at least one lowercase letter (a-z).';
  if (!/[A-Z]/.test(pw)) return 'Password must include at least one uppercase letter (A-Z).';
  if (!/[0-9]/.test(pw)) return 'Password must include at least one digit (0-9).';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must include at least one special character (e.g. !, @, #, $).';
  return null;
}

// Returns a safe URL string or '' — only http(s), mailto, tel, or same-site relative paths.
function safeUrl(v, { allowMailTel = false } = {}) {
  const raw = str(v, 2048);
  if (!raw) return '';
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) return raw;
  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    // Bare domain like "facebook.com/axelon" → assume https
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(candidate)) candidate = 'https://' + candidate;
    else return '';
  }
  try {
    const u = new URL(candidate);
    const ok = ['http:', 'https:'].includes(u.protocol) || (allowMailTel && ['mailto:', 'tel:'].includes(u.protocol));
    return ok ? u.toString() : '';
  } catch {
    return '';
  }
}

// Product image: https URL, a site image, or an uploaded media stream URL.
function safeImageUrl(v) {
  const u = safeUrl(v);
  if (!u) return '';
  if (u.startsWith('/')) {
    if (/^\/images\/[A-Za-z0-9._\-/]+$/.test(u) && !u.includes('..')) return u;
    const m = u.match(/^\/api\/media\/stream\/([a-z0-9-]+)$/);
    if (m && MEDIA_ID_RE.test(m[1])) return u;
    return '';
  }
  return u.startsWith('https://') || u.startsWith('http://') ? u : '';
}

function isHexColor(v) {
  return typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);
}

module.exports = {
  str,
  normEmail,
  isEmail,
  normPhone,
  isPhone,
  passwordProblem,
  safeUrl,
  safeImageUrl,
  isHexColor,
  MEDIA_ID_RE
};
