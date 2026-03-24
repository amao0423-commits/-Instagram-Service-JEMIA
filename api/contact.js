import { buffer } from 'node:stream/consumers';
import { Resend } from 'resend';

function sanitizeLine(s) {
  return String(s ?? '')
    .replace(/\r|\n/g, '')
    .trim();
}

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

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: '不正なリクエストです。' });
  }

  let body;
  try {
    body = await getJsonBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: '不正なリクエストです。' });
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: '必須項目をご入力ください。' });
  }

  if (body.website) {
    return res.status(200).json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'サーバー設定が完了していません。' });
  }

  const name = sanitizeLine(body.name);
  const email = String(body.email ?? '').trim();
  const entity = sanitizeLine(body.entity);
  const company = sanitizeLine(body.company);
  const industry = sanitizeLine(body.industry);
  const inquiry_type = sanitizeLine(body.inquiry_type);
  const instagram_id = sanitizeLine(body.instagram_id);
  const message = String(body.message ?? '').trim();

  let productLines = [];
  if (Array.isArray(body.product_interest)) {
    productLines = body.product_interest.map((p) => sanitizeLine(p)).filter(Boolean);
  }

  if (!name || !email || !industry || !message) {
    return res.status(400).json({ ok: false, error: '必須項目をご入力ください。' });
  }

  if (entity === 'corporate' && !company) {
    return res.status(400).json({ ok: false, error: '法人の場合は会社名をご入力ください。' });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return res.status(400).json({ ok: false, error: 'メールアドレスの形式が正しくありません。' });
  }

  const adminTo = process.env.ADMIN_EMAIL || 'amao0423@hotseller.co.kr';
  const fromRaw = process.env.RESEND_FROM || 'JEMIA <onboarding@resend.dev>';

  const adminSubject = '【JEMIA】新規お問い合わせ/診断申し込みがありました';
  const userSubject = '【JEMIA】お問い合わせありがとうございます';

  let adminBody = 'お問い合わせフォームより送信がありました。\n\n';
  adminBody += `お名前: ${name}\n`;
  adminBody += `メール: ${email}\n`;
  adminBody += `種別: ${entity}\n`;
  if (entity === 'corporate') {
    adminBody += `会社名: ${company}\n`;
  }
  adminBody += `業種: ${industry}\n`;
  adminBody += `問い合わせ種別: ${inquiry_type}\n`;
  if (productLines.length) {
    adminBody += `興味のある商品: ${productLines.join('、')}\n`;
  }
  adminBody += `Instagram ID: ${instagram_id}\n`;
  adminBody += `\n--- ご質問・その他 ---\n${message}\n`;

  let userBody = `${name} 様\n\n`;
  userBody += 'この度は、JEMIAへお問い合わせいただき、誠にありがとうございます。\n';
  userBody += '仮のお申し込み・お問い合わせを受け付けました。\n';
  userBody += '内容を確認のうえ、担当者より1〜2営業日以内にメールにてご連絡いたします。\n';
  userBody += '今しばらくお待ちくださいますようお願い申し上げます。\n\n';
  userBody += '━━━━━━━━━━━━━━━━\n';
  userBody += '株式会社ホットセラー JEMIA\n';

  const resend = new Resend(apiKey);

  const adminResult = await resend.emails.send({
    from: fromRaw,
    to: adminTo,
    replyTo: email,
    subject: adminSubject,
    text: adminBody,
  });

  if (adminResult.error) {
    console.error('[contact] admin mail', adminResult.error);
    return res.status(500).json({ ok: false, error: '送信に失敗しました。しばらくしてから再度お試しください。' });
  }

  const userResult = await resend.emails.send({
    from: fromRaw,
    to: email,
    subject: userSubject,
    text: userBody,
  });

  if (userResult.error) {
    console.error('[contact] user mail', userResult.error);
    return res.status(500).json({ ok: false, error: '送信に失敗しました。しばらくしてから再度お試しください。' });
  }

  return res.status(200).json({ ok: true });
}
