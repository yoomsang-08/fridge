-- 식단표: 이번 주를 포함한 2주치 식단을 집 식구가 함께 적는다.
-- 한 날짜의 한 끼니(아침·점심·저녁·간식·야식)에 메뉴 한 줄. 같은 칸에 다시 적으면 덮어쓴다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요. 여러 번 실행해도 됩니다.

create table if not exists meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  plan_date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack', 'late')),
  menu text not null check (char_length(menu) between 1 and 100),
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, plan_date, slot)
);

create index if not exists meal_plans_household_idx on meal_plans (household_id, plan_date);

alter table meal_plans enable row level security;

drop policy if exists "members all meal_plans" on meal_plans;
create policy "members all meal_plans" on meal_plans
  for all using (is_member(household_id)) with check (is_member(household_id));

do $$
begin
  alter publication supabase_realtime add table meal_plans;
exception when duplicate_object then null;
end $$;

-- 확인: 0 줄이면 정상 (아직 적은 식단이 없음)
select count(*) from meal_plans;
