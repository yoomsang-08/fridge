-- 스마트싱스 냉장고 연동
-- 토큰은 이 테이블에만 저장하고, 앱(브라우저)에서는 읽을 수 없습니다.
-- 정책(policy)을 하나도 만들지 않아서 Edge Function 의 service role 만 읽고 씁니다.

create table smartthings_links (
  household_id uuid primary key references households on delete cascade,
  access_token text not null,
  device_id text not null,
  device_label text,
  updated_at timestamptz not null default now()
);

alter table smartthings_links enable row level security;
