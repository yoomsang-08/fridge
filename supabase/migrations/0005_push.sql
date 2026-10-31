-- 웹 푸시 알림 구독
-- 기기(브라우저)마다 한 줄. 앱에서는 내 구독만 넣고 지울 수 있고, 보내는 일은 Edge Function(service role)이 합니다.

create table push_subscriptions (
  endpoint text primary key,
  household_id uuid not null references households on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  /** 매일 아침 기한 임박 알림을 받을지 */
  expiry_digest boolean not null default true,
  created_at timestamptz not null default now()
);

create index push_subscriptions_household_idx on push_subscriptions (household_id);

alter table push_subscriptions enable row level security;

create policy "own push subscriptions" on push_subscriptions
  for all using (user_id = auth.uid() and is_member(household_id))
  with check (user_id = auth.uid() and is_member(household_id));
