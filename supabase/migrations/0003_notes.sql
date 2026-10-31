-- 냉장고 문 메모(포스트잇)
-- 부부가 냉장고 문에 붙이듯 짧은 메모를 남기고, 상대가 열어 보면 '읽음'으로 바뀝니다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

create table notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  color text not null default 'yellow' check (color in ('yellow', 'pink', 'mint', 'sky')),
  author_id uuid default auth.uid() references auth.users on delete set null,
  -- 한 사람이 폰·PC 처럼 기기를 여러 개 쓰면 기기마다 계정이 달라서, 이름도 함께 남겨 '내 메모'를 알아본다
  author_name text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notes_household_idx on notes (household_id, created_at desc);

alter table notes enable row level security;

create policy "members all notes" on notes
  for all using (is_member(household_id)) with check (is_member(household_id));

alter publication supabase_realtime add table notes;
