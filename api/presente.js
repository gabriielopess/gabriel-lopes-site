const crypto = require('node:crypto');
const KEY = 'presentes:2026:respostas';
const COOKIE = 'presente_admin';
const databaseUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const databaseToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const sign = value => crypto.createHmac('sha256', process.env.PRESENTE_ADMIN_PASSWORD).update(value).digest('hex');
function equal(a, b) { const x = crypto.createHash('sha256').update(String(a)).digest(); const y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); }
async function redis(command) {
  const response = await fetch(databaseUrl(), { method: 'POST', headers: { Authorization: `Bearer ${databaseToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(8000) });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error('Storage unavailable');
  return result.result;
}
function authorized(req) {
  const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
  const [expires, signature] = token.split('.');
  return /^\d+$/.test(expires || '') && Number(expires) > Date.now() && Number(expires) <= Date.now() + 28800000 && equal(signature, sign(expires));
}
async function limited(req, scope, max) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const key = `presentes:rate:${scope}:${crypto.createHash('sha256').update(ip).digest('hex')}`;
  const count = await redis(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", '1', key, '900']);
  return Number(count) > max;
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, body) => res.status(status).json(body);
  const action = req.query?.action || 'submit';
  if (!['submit', 'responses', 'login', 'logout'].includes(action)) return send(404, { error: 'Não encontrado.' });
  const method = action === 'responses' ? 'GET' : 'POST';
  if (req.method !== method) { res.setHeader('Allow', method); return send(405, { error: 'Método não permitido.' }); }
  if (!databaseUrl() || !databaseToken() || !process.env.PRESENTE_ADMIN_USER || (process.env.PRESENTE_ADMIN_PASSWORD || '').length < 16) return send(503, { error: 'O formulário ainda não está disponível. Tente novamente mais tarde.' });
  if (req.method === 'POST') {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(415, { error: 'Formato inválido.' });
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) return send(403, { error: 'Origem não permitida.' }); } catch { return send(403, { error: 'Origem inválida.' }); }
    }
  }
  let body = req.body || {};
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { return send(400, { error: 'Dados inválidos.' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 4096) return send(400, { error: 'Dados inválidos.' });
  try {
    if (action === 'logout') { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/api/presente; HttpOnly; Secure; SameSite=Strict; Max-Age=0`); return send(200, { ok: true }); }
    if (action === 'login') {
      if (await limited(req, 'login', 10)) return send(429, { error: 'Muitas tentativas. Aguarde 15 minutos.' });
      if (typeof body.username !== 'string' || typeof body.password !== 'string' || !equal(body.username, process.env.PRESENTE_ADMIN_USER) || !equal(body.password, process.env.PRESENTE_ADMIN_PASSWORD)) return send(401, { error: 'Usuário ou senha incorretos.' });
      const expires = String(Date.now() + 28800000);
      res.setHeader('Set-Cookie', `${COOKIE}=${expires}.${sign(expires)}; Path=/api/presente; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
      return send(200, { ok: true });
    }
    if (action === 'responses') {
      if (!authorized(req)) return send(401, { error: 'Entre para consultar as respostas.' });
      const values = await redis(['HGETALL', KEY]);
      const rows = [];
      for (let i = 1; i < values.length; i += 2) rows.push(JSON.parse(values[i]));
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return send(200, { rows });
    }
    const { id, model, size } = body;
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name) || !['Feminino', 'Masculino'].includes(model) || !['P', 'M', 'G', 'GG', 'XGG'].includes(size) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '')) return send(400, { error: 'Confira o nome, o modelo e o tamanho.' });
    if (await limited(req, 'submit', 60)) return send(429, { error: 'Muitos envios. Aguarde 15 minutos e tente novamente.' });
    await redis(['HSETNX', KEY, id, JSON.stringify({ id, name, model, size, createdAt: new Date().toISOString() })]);
    return send(200, { ok: true });
  } catch { return send(503, { error: 'Não foi possível concluir agora. Tente novamente em instantes.' }); }
};
