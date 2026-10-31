-- 메모 댓글
-- 냉장고 문 메모에 짧게 댓글을 달 수 있게 합니다. 메모를 떼면 댓글도 함께 사라져요.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

create table note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes on delete cascade,
  household_id uuid not null references households on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  author_id uuid default auth.uid() references auth.users on delete set null,
  -- 기기마다 계정이 달라도 '내 댓글'을 알아보도록 이름도 남긴다 (notes 와 같은 방식)
  author_name text,
  created_at timestamptz not null default now()
);

create index note_comments_note_idx on note_comments (note_id, created_at);
create index note_comments_household_idx on note_comments (household_id, created_at desc);

alter table note_comments enable row level security;

-- 우리 집 식구만 보고 쓰고, 지우기는 내가 쓴 댓글만
create policy "members read comments" on note_comments
  for select using (is_member(household_id));
create policy "members add comments" on note_comments
  for insert with check (is_member(household_id) and author_id = auth.uid());
create policy "authors delete comments" on note_comments
  for delete using (is_member(household_id) and author_id = auth.uid());

alter publication supabase_realtime add table note_comments;
