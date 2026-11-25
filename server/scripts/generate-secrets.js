// Prints fresh random secrets for your production environment.
// Usage:  node scripts/generate-secrets.js
const crypto = require('crypto');
const s = () => crypto.randomBytes(48).toString('base64url');
console.log(`JWT_SECRET=${s()}`);
console.log(`ENCRYPTION_MASTER_KEY=${s()}`);
console.log('\nKeep these private. Back up ENCRYPTION_MASTER_KEY — without it your data cannot be decrypted.');
