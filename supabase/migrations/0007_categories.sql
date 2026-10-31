-- 분류를 코드가 아닌 DB 에서 관리하고, 3D 렌더링용 용기(container)와 식품안전나라 식품유형을 저장.
-- 실온 보관용 팬트리 칸(zone 'pantry')도 허용
-- SQL Editor 에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

-- 우리 집마다 분류 목록. items.category 는 이 id 를 가리킨다 (이름을 바꿔도 식품 데이터는 그대로)
create table if not exists categories (
  household_id uuid not null references households on delete cascade,
  id text not null,
  label text not null,
  emoji text not null default '📦',
  -- 이모지 뒤 연한 바탕색 (#rrggbb)
  tint text not null default '#eef0ee' check (tint ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int not null default 0,
  -- 숨기면 입력 화면에서만 빠지고, 이미 넣은 식품은 그대로 보인다
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (household_id, id)
);

alter table categories enable row level security;
drop policy if exists "members all categories" on categories;
create policy "members all categories" on categories
  for all using (is_member(household_id)) with check (is_member(household_id));

-- 기본 12종 (src/lib/categories.ts 의 DEFAULT_CATEGORIES 와 같다)
create or replace function seed_categories(hid uuid) returns void
  language sql security definer set search_path = public as $$
  insert into categories (household_id, id, label, emoji, tint, sort_order) values
    (hid, 'vegetable', '채소', '🥬', '#e8f3e6', 0),
    (hid, 'fruit', '과일', '🍎', '#fdecea', 1),
    (hid, 'meat', '육류', '🥩', '#fbe7e4', 2),
    (hid, 'seafood', '해산물', '🐟', '#e6f0f8', 3),
    (hid, 'dairy', '유제품', '🥛', '#edf1f8', 4),
    (hid, 'egg', '달걀', '🥚', '#fbf2e3', 5),
    (hid, 'side', '반찬', '🥢', '#eef3ea', 6),
    (hid, 'sauce', '소스·양념', '🧂', '#f6efe6', 7),
    (hid, 'drink', '음료', '🧃', '#fdf3e1', 8),
    (hid, 'frozen', '냉동식품', '🧊', '#e7f2f6', 9),
    (hid, 'processed', '가공식품', '🥫', '#f3ede8', 10),
    (hid, 'etc', '기타', '📦', '#eef0ee', 11)
  on conflict do nothing
$$;

-- 이미 있는 집
select seed_categories(id) from households;

-- 새로 만드는 집
create or replace function seed_categories_on_household() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform seed_categories(new.id);
  return new;
end $$;

drop trigger if exists households_seed_categories on households;
create trigger households_seed_categories after insert on households
  for each row execute function seed_categories_on_household();

-- 용기: 3D 에서 모양을 고르는 데 쓴다. 비어 있으면 단위와 분류로 추정
alter table items add column if not exists container text
  check (container in ('bottle', 'jar', 'carton', 'can', 'tub', 'box', 'bag', 'tray', 'loose'));
-- 식품안전나라에서 고른 경우 식품유형 원문 (예: 유탕면, 발효유). 나중에 일괄 재분류의 근거
alter table items add column if not exists food_type text;

-- 실온 보관 (가상 팬트리). 팬트리는 fridges 행 하나(template 'pantry')와 zone 'pantry' 칸으로 만든다
alter table compartments drop constraint if exists compartments_zone_check;
alter table compartments add constraint compartments_zone_check
  check (zone in ('fridge', 'freezer', 'flex', 'pantry'));
