// Encryption-at-rest helpers (AES-256-GCM).
// Note: this protects data files on disk / database backups. It is NOT
// "end-to-end" encryption — the server holds the key so it can serve content.
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const config = require('../config');

const MASTER_KEY = crypto.createHash('sha256').update(String(config.encryptionKey)).digest();

const IV_LEN = 12;
const TAG_LEN = 16;

function encryptData(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return {
    cipher: 'AES-256-GCM',
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    ciphertext: encrypted.toString('hex')
  };
}

function decryptData(payload) {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.authTag) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'hex')), decipher.final()]).toString('utf8');
}

// ---------- Legacy (v1) buffer format: [iv | tag | ciphertext] ----------
function decryptBufferLegacy(combined) {
  const iv = combined.subarray(0, IV_LEN);
  const authTag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = combined.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// ---------- Streaming (v2) file format: [iv | ciphertext | tag] ----------
// Encrypts a file on disk without loading it into memory; returns { size, sha256 }.
async function encryptFileToPath(srcPath, destPath) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const hash = crypto.createHash('sha256');
  let size = 0;
  const t = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length;
      hash.update(chunk);
      cb(null, cipher.update(chunk));
    },
    flush(cb) {
      this.push(cipher.final());
      this.push(cipher.getAuthTag());
      cb();
    }
  });
  t.push(iv);
  await pipeline(fs.createReadStream(srcPath), t, fs.createWriteStream(destPath, { flags: 'wx', mode: 0o600 }));
  return { size, sha256: hash.digest('hex') };
}

// Plain-text length of a v2 encrypted file.
async function plainSizeV2(encPath) {
  const st = await fsp.stat(encPath);
  return Math.max(0, st.size - IV_LEN - TAG_LEN);
}

// Full, integrity-verified decryption stream (GCM tag is checked at the end).
async function createDecryptStreamV2(encPath) {
  const fh = await fsp.open(encPath, 'r');
  try {
    const st = await fh.stat();
    const iv = Buffer.alloc(IV_LEN);
    const tag = Buffer.alloc(TAG_LEN);
    await fh.read(iv, 0, IV_LEN, 0);
    await fh.read(tag, 0, TAG_LEN, st.size - TAG_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
    decipher.setAuthTag(tag);
    const plainLen = st.size - IV_LEN - TAG_LEN;
    if (plainLen <= 0) throw new Error('Empty or corrupt media file');
    const source = fs.createReadStream(encPath, { start: IV_LEN, end: IV_LEN + plainLen - 1 });
    return { source, stream: decipher, size: plainLen };
  } finally {
    await fh.close();
  }
}

// Random-access decryption of bytes [start, end] (inclusive) for HTTP Range
// requests (video/audio seeking). GCM is CTR mode underneath: plaintext block i
// uses counter = IV || (i + 2) as a 32-bit big-endian integer.
async function createRangeDecryptStreamV2(encPath, start, end) {
  const fh = await fsp.open(encPath, 'r');
  let iv;
  try {
    iv = Buffer.alloc(IV_LEN);
    await fh.read(iv, 0, IV_LEN, 0);
  } finally {
    await fh.close();
  }
  const blockIndex = Math.floor(start / 16);
  const skip = start % 16;
  const counter = Buffer.alloc(16);
  iv.copy(counter, 0);
  counter.writeUInt32BE((blockIndex + 2) >>> 0, 12);
  const decipher = crypto.createDecipheriv('aes-256-ctr', MASTER_KEY, counter);
  const source = fs.createReadStream(encPath, {
    start: IV_LEN + blockIndex * 16,
    end: IV_LEN + end
  });
  let toSkip = skip;
  const skipper = new Transform({
    transform(chunk, _enc, cb) {
      if (toSkip > 0) {
        const n = Math.min(toSkip, chunk.length);
        toSkip -= n;
        chunk = chunk.subarray(n);
      }
      cb(null, chunk);
    }
  });
  return { source, stream: decipher, skipper };
}

// Strips prototype-pollution and Mongo-operator keys from untrusted JSON.
// (XSS is prevented by React's output escaping + strict URL validation + CSP,
// not by mangling text, which the old regex filter did unreliably.)
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function sanitizeInput(input, depth = 0) {
  if (depth > 12) return undefined;
  if (Array.isArray(input)) return input.slice(0, 500).map((v) => sanitizeInput(v, depth + 1));
  if (input && typeof input === 'object') {
    const clean = {};
    for (const key of Object.keys(input)) {
      if (FORBIDDEN_KEYS.has(key) || key.startsWith('$')) continue;
      clean[key] = sanitizeInput(input[key], depth + 1);
    }
    return clean;
  }
  if (typeof input === 'string') return input.replace(/\u0000/g, '');
  return input;
}

module.exports = {
  encryptData,
  decryptData,
  decryptBufferLegacy,
  encryptFileToPath,
  plainSizeV2,
  createDecryptStreamV2,
  createRangeDecryptStreamV2,
  sanitizeInput
};
