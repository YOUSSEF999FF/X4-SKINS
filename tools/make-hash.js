// node tools/make-hash.js "password" [getPassUrl] [howToUrl]  ->  prints the content of data/gate.json
const crypto = require('crypto');
const pw = (process.argv[2] || '').trim();
if (!pw) { console.error('usage: node make-hash.js "password" [getPassUrl] [howToUrl]'); process.exit(1); }
const salt = crypto.randomBytes(16), iter = 120000;
const hash = crypto.pbkdf2Sync(pw, salt, iter, 32, 'sha256');
console.log(JSON.stringify({
  v: 1, salt: salt.toString('base64'), iter, hash: hash.toString('base64'),
  getPass: { label: 'Get Pass', url: process.argv[3] || '' },
  howToGetPass: { label: 'How To Get Pass', url: process.argv[4] || '' }
}, null, 2));
