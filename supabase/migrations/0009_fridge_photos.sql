-- 냉장고 문 사진
-- 냉장고 문에 자석으로 사진을 붙이듯, 집마다 사진을 몇 장(최대 10장) 붙여 둘 수 있게 합니다.
-- 사진은 앱이 긴 변 1600px, 장당 약 300KB 로 줄여서 올립니다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요. (0008 다음에)

-- 사진 파일: 비공개 버킷. 경로는 '<household_id>/<파일>' 이고, 같은 집 식구만 보고 올리고 지운다
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fridge-photos', 'fridge-photos', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "members read fridge photos" on storage.objects
  for select using (bucket_id = 'fridge-photos' and is_member(((storage.foldername(name))[1])::uuid));
create policy "members upload fridge photos" on storage.objects
  for insert with check (bucket_id = 'fridge-photos' and is_member(((storage.foldername(name))[1])::uuid));
create policy "members delete fridge photos" on storage.objects
  for delete using (bucket_id = 'fridge-photos' and is_member(((storage.foldername(name))[1])::uuid));

-- 붙어 있는 사진 목록
create table fridge_photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  path text not null unique,
  width int not null check (width between 1 and 4096),
  height int not null check (height between 1 and 4096),
  author_id uuid default auth.uid() references auth.users on delete set null,
  author_name text,
  created_at timestamptz not null default now(),
  -- 다른 집 폴더의 파일을 가리키지 못하게
  check (path like household_id::text || '/%')
);

create index fridge_photos_household_idx on fridge_photos (household_id, created_at desc);

alter table fridge_photos enable row level security;

create policy "members all fridge photos" on fridge_photos
  for all using (is_member(household_id)) with check (is_member(household_id));

-- 집마다 10장까지
create function fridge_photos_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from fridge_photos where household_id = new.household_id) >= 10 then
    raise exception 'fridge_photos_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger fridge_photos_limit before insert on fridge_photos
  for each row execute function fridge_photos_limit();

alter publication supabase_realtime add table fridge_photos;
