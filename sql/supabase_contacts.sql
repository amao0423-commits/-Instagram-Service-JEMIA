-- Supabase SQL Editor で実行してください。
-- contacts: お問い合わせの保存・管理用

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  type text,
  industry text not null,
  message text not null,
  status text not null default '未対応'
    check (status in ('未対応', '配布済', '契約', '失注')),
  admin_memo text not null default ''
);

create index if not exists contacts_created_at_idx on public.contacts (created_at desc);
create index if not exists contacts_status_idx on public.contacts (status);

alter table public.contacts enable row level security;

-- クライアント（anon）からの直接アクセスは不可。サーバー（service_role）のみ API 経由で操作します。

comment on table public.contacts is 'お問い合わせフォーム送信内容（管理画面用）';
