-- 메모 보관함
-- 지난 메모를 지우지 않고 보관함으로 옮겨 두고, 다시 냉장고 문에 붙일 수 있게 합니다.
-- 보관한 메모는 기한 없이 계속 남고, 댓글도 그대로입니다.
-- 0020 다음에 실행하세요. 여러 번 실행해도 안전합니다. Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

alter table notes add column if not exists archived_at timestamptz;

create index if not exists notes_archived_idx on notes (household_id, created_at desc) where archived_at is not null;
