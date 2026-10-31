-- 주 1회 자동 백업 (Supabase 무료 요금제는 자동 백업이 없다)
-- 매주 월요일 새벽 3시(한국 시간)에 집마다 데이터 전체를 JSON 한 줄로 남기고, 최근 8개만 둔다.
-- 앱 설정 → 백업에서 마지막 백업을 보고 파일로 받을 수 있다. 0009 다음에 실행하세요. 여러 번 실행해도 안전합니다.

create table if not exists backups (
  id bigint generated always as identity primary key,
  household_id uuid not null references households on delete cascade,
  taken_at timestamptz not null default now(),
  data jsonb not null
);

create index if not exists backups_household_idx on backups (household_id, taken_at desc);

alter table backups enable row level security;
-- 식구는 읽기만. 만들고 지우는 건 아래 함수(예약 작업)만
drop policy if exists "members read backups" on backups;
create policy "members read backups" on backups for select using (is_member(household_id));

create or replace function take_backups(keep int default 8) returns int
  language plpgsql security definer set search_path = public as $$
declare
  h record;
  n int := 0;
begin
  for h in select * from households loop
    insert into backups (household_id, data) values (h.id, jsonb_build_object(
      'version', 1,
      'household', jsonb_build_object('id', h.id, 'name', h.name),
      'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'display_name', m.display_name)), '[]') from household_members m where m.household_id = h.id),
      'fridges', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from fridges f where f.household_id = h.id),
      'compartments', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from compartments c where c.household_id = h.id),
      'items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from items i where i.household_id = h.id),
      'categories', (select coalesce(jsonb_agg(to_jsonb(k)), '[]') from categories k where k.household_id = h.id),
      'notes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from notes t where t.household_id = h.id)
    ));
    n := n + 1;
    delete from backups where household_id = h.id and id not in (
      select id from backups where household_id = h.id order by taken_at desc limit keep
    );
  end loop;
  return n;
end $$;

revoke execute on function take_backups(int) from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'weekly-backup';
select cron.schedule('weekly-backup', '0 18 * * 0', $$ select public.take_backups() $$);

-- 첫 백업은 지금 바로
select take_backups();
