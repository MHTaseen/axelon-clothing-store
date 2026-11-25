// Detects the REAL type of an uploaded file from its first bytes ("magic numbers").
// The browser-supplied MIME type and file extension are never trusted.
// Only these safe media/document types are accepted — HTML, SVG, scripts,
// archives and executables are all rejected.
const fsp = require('fs/promises');

async function readHead(filePath, n = 64) {
  const fh = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fh.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

function ascii(buf, start, len) {
  return buf.subarray(start, start + len).toString('latin1');
}

// Returns { mime, category, ext } or null when the type is not allowed.
function detect(buf, claimedMime = '') {
  if (buf.length < 4) return null;
  const b = buf;

  // ---- Images ----
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', category: 'image', ext: '.jpg' };
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a) {
    return { mime: 'image/png', category: 'image', ext: '.png' };
  }
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return { mime: 'image/gif', category: 'image', ext: '.gif' };
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return { mime: 'image/webp', category: 'image', ext: '.webp' };

  // ---- ISO-BMFF family (mp4 / mov / m4a / avif / heic) ----
  if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4);
    if (['avif', 'avis'].includes(brand)) return { mime: 'image/avif', category: 'image', ext: '.avif' };
    if (['heic', 'heix', 'mif1', 'msf1', 'hevc'].includes(brand)) return { mime: 'image/heic', category: 'image', ext: '.heic' };
    if (['M4A ', 'M4B '].includes(brand)) return { mime: 'audio/mp4', category: 'audio', ext: '.m4a' };
    if (brand === 'qt  ') return { mime: 'video/quicktime', category: 'video', ext: '.mov' };
    if (String(claimedMime).startsWith('audio/')) return { mime: 'audio/mp4', category: 'audio', ext: '.m4a' };
    return { mime: 'video/mp4', category: 'video', ext: '.mp4' };
  }

  // ---- WebM / Matroska (also browser voice notes) ----
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    if (String(claimedMime).startsWith('audio/')) return { mime: 'audio/webm', category: 'audio', ext: '.webm' };
    return { mime: 'video/webm', category: 'video', ext: '.webm' };
  }

  // ---- Audio ----
  if (ascii(b, 0, 4) === 'OggS') return { mime: 'audio/ogg', category: 'audio', ext: '.ogg' };
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') return { mime: 'audio/wav', category: 'audio', ext: '.wav' };
  if (ascii(b, 0, 3) === 'ID3') return { mime: 'audio/mpeg', category: 'audio', ext: '.mp3' };
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return { mime: 'audio/aac', category: 'audio', ext: '.aac' };
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return { mime: 'audio/mpeg', category: 'audio', ext: '.mp3' };

  // ---- Documents ----
  if (ascii(b, 0, 5) === '%PDF-') return { mime: 'application/pdf', category: 'document', ext: '.pdf' };

  return null;
}

async function detectFile(filePath, claimedMime) {
  return detect(await readHead(filePath), claimedMime);
}

module.exports = { detect, detectFile };
