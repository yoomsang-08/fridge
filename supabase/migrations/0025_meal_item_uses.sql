-- 식단표 '냉장고 재료 쓰기': 끼니마다 식품별로 쓸 양을 적어 둔다 (예: 달걀 2개).
-- 한 식품을 여러 끼니에 걸 수 있고, 양의 합이 재고를 넘으면 식단 시트에서 안내한다.
-- 형식: { "<items.id>": 숫자 }. 양을 안 정한 식품은 들어 있지 않다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요. 여러 번 실행해도 됩니다.

alter table meal_plans add column if not exists item_uses jsonb not null default '{}'::jsonb;

-- 확인: 컬럼 한 줄이 보이면 정상
select column_name from information_schema.columns
where table_name = 'meal_plans' and column_name = 'item_uses';
