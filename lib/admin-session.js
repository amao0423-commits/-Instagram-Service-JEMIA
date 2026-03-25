import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'jemia_admin_session';

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || '';
}

export function signSession() {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp, v: 1 })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  const secret = getSecret();
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function getSessionCookie(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1].trim()) : '';
}

export function verifyRequestSession(req) {
  return verifySessionToken(getSessionCookie(req));
}

export function buildSetCookieHeader(token, { clear = false } = {}) {
  const secure =
    process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${clear ? '' : encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
    clear ? 'Max-Age=0' : `Max-Age=${7 * 24 * 60 * 60}`,
  ];
  return parts.join('; ');
}
