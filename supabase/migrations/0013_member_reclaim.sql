-- 다시 접속할 때 '기존 식구'로 이어 쓰기
-- 앱을 지웠다 다시 깔거나 로그인 정보가 사라지면 이 기기는 새 익명 계정이 된다.
-- 집 코드를 넣은 뒤 이미 있는 이름(민상, 지선)을 고르면 같은 사람으로 이어진다.
-- (메모 읽음, #이름 알림, '내 메모' 표시는 모두 이름 기준이라 그대로 이어진다)
-- 여러 번 실행해도 안전합니다.

-- 집 코드로 그 집 식구 이름 목록 (코드가 틀리면 오류). 먼저 합류한 순서
create or replace function household_member_names(p_code text)
  returns table (name text) language plpgsql stable security definer set search_path = public as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select id into hid from households
    where invite_code = upper(regexp_replace(p_code, '[^0-9A-Za-z]', '', 'g'));
  if hid is null then
    raise exception 'invalid invite code';
  end if;
  return query
    select trim(m.display_name) as name
    from household_members m
    where m.household_id = hid and coalesce(trim(m.display_name), '') <> ''
    group by trim(m.display_name)
    order by min(m.created_at);
end $$;

revoke execute on function household_member_names(text) from public, anon;
grant execute on function household_member_names(text) to authenticated;

-- 이미 생긴 '이름 없음' 줄 정리: 같은 집에 이름 있는 식구가 있고, 그 계정이 남긴 식품·메모·알림 구독이 없을 때만 지운다
-- (아무 데이터도 가리키지 않는 줄이라 지워도 잃는 것이 없다)
delete from household_members m
where coalesce(trim(m.display_name), '') = ''
  and exists (select 1 from household_members o where o.household_id = m.household_id and coalesce(trim(o.display_name), '') <> '')
  and not exists (select 1 from items i where i.created_by = m.user_id)
  and not exists (select 1 from notes n where n.author_id = m.user_id)
  and not exists (select 1 from push_subscriptions p where p.user_id = m.user_id);

-- 이름 앞뒤 공백 정리 (같은 이름으로 묶이게)
update household_members set display_name = trim(display_name) where display_name <> trim(display_name);
