-- 로그인 화면 없이 "우리 집 코드"로 접속
-- 각 기기는 익명 로그인(Anonymous sign-in)으로 자동 접속하고, 처음 한 번 집 코드를 넣어 우리 집에 합류합니다.
-- 코드가 곧 비밀번호 역할이라 12자리(48비트)로 늘립니다.

alter table households
  alter column invite_code set default upper(substr(md5(gen_random_uuid()::text), 1, 12));

update households
  set invite_code = upper(substr(md5(gen_random_uuid()::text), 1, 12))
  where length(invite_code) < 12;

-- 하이픈이나 공백을 섞어 입력해도 합류되도록
create or replace function join_household(p_code text, p_display_name text)
  returns uuid language plpgsql security definer set search_path = public as $$
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
  insert into household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), p_display_name)
    on conflict do nothing;
  return hid;
end $$;

-- 기기 연결 해제: 내 멤버십만 삭제
create policy "leave household" on household_members
  for delete using (user_id = auth.uid());
