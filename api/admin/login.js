import { buffer } from 'node:stream/consumers';
import { timingSafeEqual } from 'node:crypto';
import { signSession, buildSetCookieHeader } from '../../lib/admin-session.js';

async function getJsonBody(req) {
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.length > 0) {
    return JSON.parse(req.body);
  }
  try {
    const buf = await buffer(req);
    const text = buf.toString('utf8');
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safePasswordEqual(expected, provided) {
  const a = Buffer.from(String(expected ?? ''), 'utf8');
  const b = Buffer.from(String(provided ?? ''), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: '不正なリクエストです。' });
  }

  const expected = process.env.ADMIN_DASHBOARD_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!expected || !secret) {
    return res.status(503).json({ ok: false, error: '管理画面の設定が完了していません。' });
  }

  let body;
  try {
    body = await getJsonBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: '不正なリクエストです。' });
  }

  const password = body && typeof body.password === 'string' ? body.password : '';
  if (!safePasswordEqual(expected, password)) {
    return res.status(401).json({ ok: false, error: 'パスワードが正しくありません。' });
  }

  const token = signSession();
  if (!token) {
    return res.status(503).json({ ok: false, error: 'セッション設定エラーです。' });
  }

  res.setHeader('Set-Cookie', buildSetCookieHeader(token));
  return res.status(200).json({ ok: true });
}
