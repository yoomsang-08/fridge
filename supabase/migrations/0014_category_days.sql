-- 분류별 자동 기한 (일). 유통기한이 안 찍힌 재료는 '넣은 날 + 이 일수'로 기한을 채운다.
-- null 이면 그 보관 위치에서는 자동으로 채우지 않는다. 설정 > 자동 기한에서 집마다 바꿀 수 있다.
-- 냉동 기본값은 지선님 기준: 생선·해산물 6개월, 육류 3개월, 채소 1년.
-- 산 게 아닌 음식용 분류 5종(밥·면, 국·찌개, 남은 음식, 손질 재료, 이유식)도 함께 넣는다.
-- 여러 번 실행해도 된다. 이미 값을 바꾼 분류는 건드리지 않는다.

alter table categories add column if not exists fridge_days int check (fridge_days between 1 and 3650);
alter table categories add column if not exists freezer_days int check (freezer_days between 1 and 3650);
alter table categories add column if not exists pantry_days int check (pantry_days between 1 and 3650);
alter table categories add column if not exists days_set boolean not null default false;

-- 기본값 (src/lib/categories.ts 의 DEFAULT_CATEGORIES 와 같다)
create or replace function category_default_days(cid text, out fridge int, out freezer int, out pantry int)
  language sql immutable as $$
  select d.fridge, d.freezer, d.pantry from (values
    ('vegetable', 7, 365, 7),
    ('fruit', 7, 180, 5),
    ('meat', 3, 90, null),
    ('seafood', 2, 180, null),
    ('dairy', 7, 90, null),
    ('egg', 21, null, 14),
    ('side', 5, 30, null),
    ('sauce', 180, null, 180),
    ('drink', 14, null, 180),
    ('frozen', null, 180, null),
    ('processed', 30, 180, 90),
    ('etc', 14, 90, 30),
    ('rice', 2, 30, null),
    ('soup', 3, 90, null),
    ('leftover', 3, 30, null),
    ('prep', 3, 90, null),
    ('babyfood', 2, 14, null)
  ) as d(id, fridge, freezer, pantry)
  where d.id = cid
$$;

-- 산 게 아닌 음식용 분류 5종. '기타'는 맨 뒤로
create or replace function seed_home_categories(hid uuid) returns void
  language sql security definer set search_path = public as $$
  insert into categories (household_id, id, label, emoji, tint, sort_order) values
    (hid, 'rice', '밥·면', '🍚', '#f5f1e6', 12),
    (hid, 'soup', '국·찌개', '🍲', '#fbeee6', 13),
    (hid, 'leftover', '남은 음식', '🍱', '#eef1f6', 14),
    (hid, 'prep', '손질 재료', '🧄', '#f1f3e8', 15),
    (hid, 'babyfood', '이유식', '🍼', '#fdf0f3', 16)
  on conflict do nothing;
  update categories set sort_order = 20 where household_id = hid and id = 'etc' and sort_order = 11;
$$;

-- 새로 만드는 집: 기본 12종(0007) 다음에 이것도
create or replace function seed_categories_on_household() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform seed_categories(new.id);
  perform seed_home_categories(new.id);
  return new;
end $$;

-- 이미 있는 분류: 아직 손대지 않은 것만 기본값으로
update categories c set
  fridge_days = d.fridge, freezer_days = d.freezer, pantry_days = d.pantry, days_set = true
from (select id, (category_default_days(id)).* from (select distinct id from categories) x) d
where c.id = d.id and not c.days_set;

-- 새로 만드는 집의 분류에도 기본값을 채운다 (아래 트리거)
create or replace function categories_fill_days() returns trigger
  language plpgsql as $$
declare
  d record;
begin
  if not new.days_set then
    select * into d from category_default_days(new.id);
    new.fridge_days := coalesce(new.fridge_days, d.fridge);
    new.freezer_days := coalesce(new.freezer_days, d.freezer);
    new.pantry_days := coalesce(new.pantry_days, d.pantry);
    new.days_set := true;
  end if;
  return new;
end $$;

drop trigger if exists categories_fill_days on categories;
create trigger categories_fill_days before insert on categories
  for each row execute function categories_fill_days();

-- 이미 있는 집에 새 분류 5종 (트리거가 일수를 채운다)
select seed_home_categories(id) from households;

-- 확인: 집마다 3줄 — 해산물 냉동 180 / 육류 냉동 90 / 채소 냉동 365
select household_id, id, fridge_days, freezer_days, pantry_days
from categories where id in ('seafood', 'meat', 'vegetable') order by 1, 2;
