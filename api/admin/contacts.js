import { buffer } from 'node:stream/consumers';
import { verifyRequestSession } from '../../lib/admin-session.js';
import { getSupabaseAdmin } from '../../lib/supabase-server.js';

const ALLOWED_STATUS = new Set(['未対応', '配布済', '契約', '失注']);

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

  if (!verifyRequestSession(req)) {
    return res.status(401).json({ ok: false, error: '認証が必要です。' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ ok: false, error: 'データベース設定が完了していません。' });
  }

  if (req.method === 'GET') {
    const { data: rows, error: listErr } = await supabase
      .from('contacts')
      .select(
        'id, created_at, name, email, type, industry, message, status, admin_memo'
      )
      .order('created_at', { ascending: false });

    if (listErr) {
      console.error('[admin/contacts] list', listErr);
      return res.status(500).json({ ok: false, error: '一覧の取得に失敗しました。' });
    }

    const { count, error: countErr } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('status', '未対応');

    if (countErr) {
      console.error('[admin/contacts] count', countErr);
    }

    return res.status(200).json({
      ok: true,
      contacts: rows || [],
      pendingCount: typeof count === 'number' ? count : 0,
    });
  }

  if (req.method === 'PATCH') {
    let body;
    try {
      body = await getJsonBody(req);
    } catch {
      return res.status(400).json({ ok: false, error: '不正なリクエストです。' });
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ ok: false, error: '不正なリクエストです。' });
    }

    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return res.status(400).json({ ok: false, error: '対象が指定されていません。' });
    }

    const patch = {};
    if ('status' in body) {
      const st = String(body.status ?? '').trim();
      if (!ALLOWED_STATUS.has(st)) {
        return res.status(400).json({ ok: false, error: 'ステータスが不正です。' });
      }
      patch.status = st;
    }
    if ('admin_memo' in body) {
      patch.admin_memo =
        typeof body.admin_memo === 'string' ? body.admin_memo : String(body.admin_memo ?? '');
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ ok: false, error: '更新内容がありません。' });
    }

    const { data, error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('id', id)
      .select(
        'id, created_at, name, email, type, industry, message, status, admin_memo'
      )
      .maybeSingle();

    if (error) {
      console.error('[admin/contacts] patch', error);
      return res.status(500).json({ ok: false, error: '更新に失敗しました。' });
    }
    if (!data) {
      return res.status(404).json({ ok: false, error: '該当データが見つかりません。' });
    }

    return res.status(200).json({ ok: true, contact: data });
  }

  return res.status(405).json({ ok: false, error: '不正なリクエストです。' });
}
