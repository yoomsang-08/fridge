-- 점검 후 보완 (0008 과 순서 상관없이 실행해도 됩니다. 여러 번 실행해도 안전합니다)

-- 1) 식구 정보는 '내 이름'만 바꿀 수 있게.
--    지금 정책은 내 줄이면 household_id 까지 바꿀 수 있어서, 다른 집 id 를 알면 코드 없이 들어갈 수 있었다.
revoke update on household_members from anon, authenticated;
grant update (display_name) on household_members to authenticated;

-- 2) 기본 분류 채우기는 새 집을 만들 때(트리거)만. 앱에서 다른 집 id 로 부르지 못하게
revoke execute on function seed_categories(uuid) from public, anon, authenticated;

-- 3) 아침 알림 예약을 Supabase 안에서 (매시 정각)
--    GitHub 예약 실행은 늦거나 건너뛰고, 60일간 저장소 변경이 없으면 멈춘다.
--    확인값은 여기서 무작위로 만들어 이 테이블에만 둔다(정책이 없어 앱에서는 못 읽음).
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists cron_config (
  id int primary key default 1 check (id = 1),
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
alter table cron_config enable row level security;
insert into cron_config (id) values (1) on conflict do nothing;

select cron.unschedule(jobid) from cron.job where jobname = 'expiry-digest';
select cron.schedule(
  'expiry-digest',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://aiwqfqfswuehxqferrpn.supabase.co/functions/v1/expiry-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select secret from public.cron_config where id = 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
