'use strict';
const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(scryptCallback);
const OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const KEY_BYTES = 64;

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new Error('Invalid password length');
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_BYTES, OPTIONS);
  return ['scrypt', OPTIONS.N, OPTIONS.r, OPTIONS.p, salt.toString('hex'), hash.toString('hex')].join('$');
}
async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string') return false;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (N !== OPTIONS.N || r !== OPTIONS.r || p !== OPTIONS.p) return false;
  if (!/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
  const actual = await scrypt(password, Buffer.from(parts[4], 'hex'), KEY_BYTES, OPTIONS);
  return timingSafeEqual(actual, Buffer.from(parts[5], 'hex'));
}
module.exports = { hashPassword, verifyPassword };
