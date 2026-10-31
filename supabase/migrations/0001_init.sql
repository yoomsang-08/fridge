-- 냉장고를 부탁해: 초기 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

create extension if not exists pgcrypto;

-- 우리 집 (부부가 같은 household 를 공유)
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table fridges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  model text,
  template text,
  width_mm int,
  height_mm int,
  depth_mm int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 보관칸. layout 은 2D/3D 표현용 정면 좌표 (0~1 비율: x, y, w, h)
create table compartments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  fridge_id uuid not null references fridges on delete cascade,
  name text not null,
  zone text not null check (zone in ('fridge', 'freezer', 'flex')),
  section text not null default 'main',
  layout jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  compartment_id uuid not null references compartments on delete cascade,
  name text not null,
  category text not null default 'etc',
  quantity numeric not null default 1,
  unit text not null default '개',
  expiry_date date,
  expiry_type text not null default 'use_by' check (expiry_type in ('use_by', 'sell_by')),
  purchased_on date default current_date,
  opened boolean not null default false,
  memo text,
  barcode text,
  status text not null default 'active' check (status in ('active', 'consumed', 'discarded')),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_household_active_idx on items (household_id, status, expiry_date);

create table item_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  item_id uuid not null references items on delete cascade,
  action text not null check (action in ('add', 'use', 'consume', 'discard', 'edit')),
  quantity_delta numeric,
  user_id uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger items_touch before update on items
  for each row execute function touch_updated_at();

-- 권한: 같은 household 구성원만 읽고 쓸 수 있음
create or replace function is_member(hid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members where household_id = hid and user_id = auth.uid()
  )
$$;

alter table households enable row level security;
alter table household_members enable row level security;
alter table fridges enable row level security;
alter table compartments enable row level security;
alter table items enable row level security;
alter table item_logs enable row level security;

create policy "members read household" on households
  for select using (is_member(id));
create policy "members update household" on households
  for update using (is_member(id));

create policy "members read members" on household_members
  for select using (is_member(household_id));
create policy "update own membership" on household_members
  for update using (user_id = auth.uid());

create policy "members all fridges" on fridges
  for all using (is_member(household_id)) with check (is_member(household_id));
create policy "members all compartments" on compartments
  for all using (is_member(household_id)) with check (is_member(household_id));
create policy "members all items" on items
  for all using (is_member(household_id)) with check (is_member(household_id));
create policy "members all item_logs" on item_logs
  for all using (is_member(household_id)) with check (is_member(household_id));

-- 집 만들기 / 초대코드로 합류
create or replace function create_household(p_name text, p_display_name text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into households (name) values (p_name) returning id into hid;
  insert into household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), p_display_name);
  return hid;
end $$;

create or replace function join_household(p_code text, p_display_name text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select id into hid from households where invite_code = upper(trim(p_code));
  if hid is null then
    raise exception 'invalid invite code';
  end if;
  insert into household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), p_display_name)
    on conflict do nothing;
  return hid;
end $$;

-- 실시간 동기화
alter publication supabase_realtime add table fridges, compartments, items;
