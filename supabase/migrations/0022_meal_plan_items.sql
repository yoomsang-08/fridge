-- 식단표 '냉장고 재료 쓰기': 식단 한 칸에 쓸 냉장고 식품(items.id)을 함께 적어 둔다.
-- 앱 어디서나 그 식품에 '사용예정' 칩이 붙고, 누르면 언제 어떤 메뉴인지 보인다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요. 여러 번 실행해도 됩니다.

alter table meal_plans add column if not exists item_ids uuid[] not null default '{}';

-- 확인: 컬럼 한 줄이 보이면 정상
select column_name from information_schema.columns
where table_name = 'meal_plans' and column_name = 'item_ids';
