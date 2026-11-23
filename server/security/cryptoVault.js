const crypto = require('crypto');

const getMasterKey = () => {
  const secret = process.env.ENCRYPTION_MASTER_KEY || 'AXELON_AES_256_GCM_MASTER_KEY_2026_ULTRA_SECURE';
  return crypto.createHash('sha256').update(String(secret)).digest();
};

function encryptData(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    cipher: 'AES-256-GCM',
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    ciphertext: encrypted
  };
}

function decryptData(payload) {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.authTag) return null;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getMasterKey(),
    Buffer.from(payload.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  if (Array.isArray(input)) return input.map(sanitizeInput);
  if (input && typeof input === 'object') {
    const clean = {};
    for (const key of Object.keys(input)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      clean[key] = sanitizeInput(input[key]);
    }
    return clean;
  }
  return input;
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptBuffer(combinedBuffer) {
  const iv = combinedBuffer.subarray(0, 12);
  const authTag = combinedBuffer.subarray(12, 28);
  const encrypted = combinedBuffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

module.exports = { encryptData, decryptData, encryptBuffer, decryptBuffer, sanitizeInput };
