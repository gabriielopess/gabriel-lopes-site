const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/presente.js');
process.env.KV_REST_API_URL = 'https://example.test';
process.env.KV_REST_API_TOKEN = 'test-token';
process.env.PRESENTE_ADMIN_PASSWORD = 'test-only-password-long';
process.env.PRESENTE_ADMIN_USER = 'gabriel';
const rows = new Map();
let rate = 1, offline = false;
global.fetch = async (_, options) => {
  if (offline) throw Error('offline');
  const [command, ...args] = JSON.parse(options.body);
  let result;
  if (command === 'EVAL') result = rate;
  else if (command === 'HSETNX') { result = rows.has(args[1]) ? 0 : 1; if (result) rows.set(args[1], args[2]); }
  else if (command === 'HGETALL') result = [...rows].flat();
  else throw Error('Unexpected command');
  return { ok: true, json: async () => ({ result }) };
};
async function call(action, body, cookie, extra = {}) {
  const req = { query: { action }, method: action === 'responses' ? 'GET' : 'POST', headers: { host: 'example.test', origin: 'https://example.test', 'content-type': 'application/json', cookie, ...extra }, body };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } };
  await handler(req, res); return res;
}
test('private responses, validated writes, retries, session and outages', async () => {
  assert.equal((await call('responses')).code, 401);
  assert.equal((await call('login', { password: 'wrong' })).code, 401);
  assert.equal((await call('login', { username: 'wrong', password: process.env.PRESENTE_ADMIN_PASSWORD })).code, 401);
  const login = await call('login', { username: 'gabriel', password: process.env.PRESENTE_ADMIN_PASSWORD });
  assert.equal(login.code, 200);
  const cookie = login.headers['Set-Cookie'].split(';')[0];
  assert.match(login.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/);
  const data = { id: '5b9c97dc-5c22-4d5a-b6bc-211ec89cf481', name: 'Gabriel Lopes', model: 'Masculino', size: 'XGG' };
  assert.equal((await call('submit', { ...data, size: 'PP' })).code, 400);
  assert.equal((await call('submit', { ...data, name: '  ' })).code, 400);
  assert.equal((await call('submit', data, null, { origin: 'https://evil.test' })).code, 403);
  assert.equal((await call('submit', data)).code, 200);
  assert.equal((await call('submit', data)).code, 200);
  const result = await call('responses', null, cookie);
  assert.equal(result.body.rows.length, 1);
  assert.equal(result.body.rows[0].size, 'XGG');
  assert.equal((await call('responses', null, cookie + 'broken')).code, 401);
  rate = 61; assert.equal((await call('submit', data)).code, 429); rate = 1;
  offline = true; assert.equal((await call('submit', data)).code, 503); offline = false;
  assert.match((await call('logout', {})).headers['Set-Cookie'], /Max-Age=0/);
  delete process.env.KV_REST_API_TOKEN;
  assert.equal((await call('submit', data)).code, 503);
});
