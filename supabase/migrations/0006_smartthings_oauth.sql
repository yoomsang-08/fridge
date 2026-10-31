-- 스마트싱스 삼성 계정 연결(OAuth): 토큰을 서버가 알아서 갱신해 매일 새로 넣지 않아도 됩니다.
-- 0004_smartthings.sql 다음에 실행하세요.

alter table smartthings_links
  add column refresh_token text,
  add column expires_at timestamptz;

-- 로그인 시작 → 돌아올 때까지 잠깐 보관하는 일회용 값. 앱에서는 읽을 수 없습니다.
create table smartthings_oauth_states (
  state text primary key,
  household_id uuid not null references households on delete cascade,
  created_at timestamptz not null default now()
);

alter table smartthings_oauth_states enable row level security;
