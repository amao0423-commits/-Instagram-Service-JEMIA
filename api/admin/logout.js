import { buildSetCookieHeader } from '../../lib/admin-session.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: '不正なリクエストです。' });
  }

  res.setHeader('Set-Cookie', buildSetCookieHeader('', { clear: true }));
  return res.status(200).json({ ok: true });
}
