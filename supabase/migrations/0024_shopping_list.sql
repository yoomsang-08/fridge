-- 장보기 리스트 (메모 탭 > 장보기)
-- 집 식구가 함께 적고 체크하는 장보기 목록. 누가 담고 누가 체크했는지 이름을 남깁니다.
-- 새 테이블 하나만 만들고 기존 것은 건드리지 않습니다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  qty text check (qty is null or char_length(qty) <= 20),      -- '1통', '2개' 같은 말
  category text,                                                -- 분류 id (자동으로 고른 것)
  source text not null default 'manual'
    check (source in ('manual', 'meal', 'recipe', 'eaten')),    -- 2단계에서 식단표·요리 추천 연동
  source_note text,                                             -- '목 저녁 · 두부조림' 같은 한 줄
  checked boolean not null default false,
  checked_by text,
  checked_at timestamptz,
  added_by text,
  created_at timestamptz not null default now()
);

create index if not exists shopping_items_household_idx on shopping_items (household_id, checked, created_at desc);

alter table shopping_items enable row level security;

drop policy if exists "members all shopping_items" on shopping_items;
create policy "members all shopping_items" on shopping_items
  for all using (is_member(household_id)) with check (is_member(household_id));

do $$
begin
  alter publication supabase_realtime add table shopping_items;
exception when duplicate_object then null;
end $$;

-- 확인: 0 줄이면 정상 (아직 담은 것이 없음)
select count(*) from shopping_items;
