-- 식단표 어른·아이 메뉴 구분: 한 칸(날짜+끼니)에 어른 메뉴(menu)와 아이 메뉴(kid_menu)를 따로 적는다.
-- 예전에 적은 식단은 그대로 어른 메뉴가 된다. 아이 메뉴만 적은 칸은 menu 가 빈 문자열이다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요. 여러 번 실행해도 됩니다.

alter table meal_plans add column if not exists kid_menu text
  check (kid_menu is null or char_length(kid_menu) between 1 and 100);

-- 어른 메뉴는 비어 있어도 된다(아이 메뉴만 적는 경우). 길이 제한은 100자 그대로.
alter table meal_plans drop constraint if exists meal_plans_menu_check;
alter table meal_plans add constraint meal_plans_menu_check check (char_length(menu) <= 100);

-- 확인: 컬럼 한 줄이 보이면 정상
select column_name from information_schema.columns
where table_name = 'meal_plans' and column_name = 'kid_menu';
