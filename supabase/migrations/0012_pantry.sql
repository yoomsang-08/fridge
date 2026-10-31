-- 이미 쓰고 있는 집에 팬트리(실온 보관 공간)를 한 번 넣어 준다.
-- 새로 시작하는 집은 첫 화면에서 템플릿으로 함께 만들어진다 (src/lib/templates.ts 의 'pantry' 와 같은 구성).
-- 팬트리가 이미 있는 집은 건너뛰므로 여러 번 실행해도 된다. 0007 이 먼저 실행돼 있어야 한다 (zone 'pantry').

do $$
declare
  h record;
  fid uuid;
begin
  for h in
    select id from households hh
    where not exists (select 1 from fridges f where f.household_id = hh.id and f.template = 'pantry')
  loop
    insert into fridges (household_id, name, model, template, width_mm, height_mm, depth_mm, sort_order)
    values (h.id, '팬트리', null, 'pantry', 800, 1800, 400,
            (select coalesce(max(sort_order), 0) + 1 from fridges where household_id = h.id))
    returning id into fid;

    insert into compartments (household_id, fridge_id, name, zone, section, layout, sort_order) values
      (h.id, fid, '선반 1단', 'pantry', 'shelf', '{"x":0.04,"y":0.02,"w":0.92,"h":0.18}', 0),
      (h.id, fid, '선반 2단', 'pantry', 'shelf', '{"x":0.04,"y":0.22,"w":0.92,"h":0.18}', 1),
      (h.id, fid, '선반 3단', 'pantry', 'shelf', '{"x":0.04,"y":0.42,"w":0.92,"h":0.18}', 2),
      (h.id, fid, '선반 4단', 'pantry', 'shelf', '{"x":0.04,"y":0.62,"w":0.92,"h":0.18}', 3),
      (h.id, fid, '왼쪽 바구니', 'pantry', 'basket', '{"x":0.04,"y":0.82,"w":0.44,"h":0.16}', 4),
      (h.id, fid, '오른쪽 바구니', 'pantry', 'basket', '{"x":0.52,"y":0.82,"w":0.44,"h":0.16}', 5);
  end loop;
end $$;

-- 확인: 집마다 팬트리 1개, 칸 6개
select f.household_id, f.name, count(c.id) as compartments
from fridges f left join compartments c on c.fridge_id = f.id
where f.template = 'pantry'
group by 1, 2;
