-- 식단표에 보일 끼니(아침·점심·저녁·간식·야식)를 기기마다가 아니라 집 단위로 함께 쓴다.
-- 비어 있으면(null) 기본값(아침·점심·저녁)으로 보이고, 기존 기기에 저장돼 있던 설정은 앱이 처음 열릴 때 한 번 여기로 옮긴다.
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요. 여러 번 실행해도 됩니다.

alter table households add column if not exists meal_slots text[];

-- 다른 기기에서 바꾸면 바로 반영되게
do $$
begin
  alter publication supabase_realtime add table households;
exception when duplicate_object then null;
end $$;

-- 확인: 컬럼 한 줄이 보이면 정상
select column_name from information_schema.columns
where table_name = 'households' and column_name = 'meal_slots';
