-- 점검 후 보완 (0008 과 순서 상관없이 실행해도 됩니다. 여러 번 실행해도 안전합니다)

-- 1) 식구 정보는 '내 이름'만 바꿀 수 있게.
--    지금 정책은 내 줄이면 household_id 까지 바꿀 수 있어서, 다른 집 id 를 알면 코드 없이 들어갈 수 있었다.
revoke update on household_members from anon, authenticated;
grant update (display_name) on household_members to authenticated;

-- 2) 기본 분류 채우기는 새 집을 만들 때(트리거)만. 앱에서 다른 집 id 로 부르지 못하게
revoke execute on function seed_categories(uuid) from public, anon, authenticated;
