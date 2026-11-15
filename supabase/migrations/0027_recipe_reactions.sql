-- 요리 추천 좋아요·싫어요 (식단표 > 곧 기한이 되는 재료로 만들 요리)
-- 집 식구가 함께 쓰는 표시입니다. 한 요리에 집마다 하나만 남고(좋아요 또는 싫어요), 다시 누르면 지워집니다.
-- 싫어요한 요리는 추천에서 빠지고, 나중에 요리 데이터를 갱신할 때 목록에서 빼서 다른 요리로 바꿉니다.
-- 새 테이블 하나만 만들고 기존 것은 건드리지 않습니다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

create table if not exists recipe_reactions (
  household_id uuid not null references households on delete cascade,
  recipe_name text not null check (char_length(recipe_name) between 1 and 60),
  reaction text not null check (reaction in ('up', 'down')),
  by_name text,
  created_at timestamptz not null default now(),
  primary key (household_id, recipe_name)
);

alter table recipe_reactions enable row level security;

drop policy if exists "members all recipe_reactions" on recipe_reactions;
create policy "members all recipe_reactions" on recipe_reactions
  for all using (is_member(household_id)) with check (is_member(household_id));

do $$
begin
  alter publication supabase_realtime add table recipe_reactions;
exception when duplicate_object then null;
end $$;

-- 확인: 0 줄이면 정상 (아직 표시한 요리가 없음)
select count(*) from recipe_reactions;
