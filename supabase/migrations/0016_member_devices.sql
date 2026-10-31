-- 기기 정리: 기기마다 마지막 사용 시각과 종류(아이폰, Mac 등)를 남기고, 안 쓰는 기기를 지운다.
-- 웹앱은 MAC 주소 같은 기기 고유 번호를 알 수 없어서, 앱을 다시 깔 때마다 새 계정(=새 기기 줄)이 생긴다.
-- 여러 번 실행해도 안전합니다.

alter table household_members add column if not exists last_seen_at timestamptz;
alter table household_members add column if not exists device text;

-- 앱을 열 때마다 내 줄에 기록 (식구 정보는 이름만 직접 수정할 수 있어서 함수로)
create or replace function touch_member(p_household uuid, p_device text)
  returns void language sql security definer set search_path = public as $$
  update household_members
    set last_seen_at = now(), device = left(p_device, 40)
    where household_id = p_household and user_id = auth.uid()
$$;

-- 기기 지우기: 같은 집 식구만. 그 기기의 알림 구독도 함께 지운다. 식품·메모 데이터는 그대로
create or replace function remove_member_devices(p_household uuid, p_users uuid[])
  returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not is_member(p_household) then
    raise exception 'forbidden';
  end if;
  delete from push_subscriptions where household_id = p_household and user_id = any(p_users) and user_id <> auth.uid();
  delete from household_members where household_id = p_household and user_id = any(p_users) and user_id <> auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function touch_member(uuid, text) from public, anon;
revoke execute on function remove_member_devices(uuid, uuid[]) from public, anon;
grant execute on function touch_member(uuid, text) to authenticated;
grant execute on function remove_member_devices(uuid, uuid[]) to authenticated;

-- 30일 넘게 안 쓴 기기는 매일 새벽 4시(한국 시간)에 자동으로 지운다.
-- 기록이 없는 옛 줄은 합류한 지 30일이 지나면 지운다. 집에 마지막 남은 한 줄은 지우지 않는다.
create or replace function prune_member_devices() returns int
  language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  with stale as (
    select m.household_id, m.user_id from household_members m
    where coalesce(m.last_seen_at, m.created_at) < now() - interval '30 days'
      and exists (
        select 1 from household_members o
        where o.household_id = m.household_id
          and coalesce(o.last_seen_at, o.created_at) >= now() - interval '30 days'
      )
  ), gone_subs as (
    delete from push_subscriptions p using stale s
      where p.household_id = s.household_id and p.user_id = s.user_id
  )
  delete from household_members m using stale s
    where m.household_id = s.household_id and m.user_id = s.user_id;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function prune_member_devices() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'prune-member-devices';
select cron.schedule('prune-member-devices', '0 19 * * *', $$ select public.prune_member_devices() $$);
