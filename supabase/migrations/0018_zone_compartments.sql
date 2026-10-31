-- 냉장고 칸을 큰 구역(냉장실·냉동실·김치냉장실)으로 합친다.
-- 삼성 비스포크 4도어: 냉장실 / 냉동실 / 김치냉장실(맞춤보관실), 쿠쿠 냉동고: 냉동실 하나.
-- 같은 구역(zone)에 있던 선반·서랍·문 포켓 칸의 식품을 새 구역 칸으로 먼저 옮기고 나서 예전 칸을 지운다
-- (items.compartment_id 는 on delete cascade 라 순서가 중요하다). 그림 속 선반·서랍 위치는 앱이 알아서 나눠 그린다.
-- 이미 합쳐진 냉장고(모든 칸이 section 'zone')는 건너뛰므로 여러 번 실행해도 된다. 팬트리와 직접 구성 냉장고는 그대로.

do $$
declare
  f record;
  z record;
  new_id uuid;
begin
  for f in
    select fr.* from fridges fr
    where fr.template in ('samsung-rf85-4door', 'cuckoo-upright-freezer-133')
      and exists (select 1 from compartments c where c.fridge_id = fr.id and c.section <> 'zone')
  loop
    for z in
      select * from (values
        ('samsung-rf85-4door', 'fridge', '냉장실', '{"x":0,"y":0,"w":1,"h":0.55}'::jsonb, 0),
        ('samsung-rf85-4door', 'freezer', '냉동실', '{"x":0,"y":0.555,"w":0.5,"h":0.445}'::jsonb, 1),
        ('samsung-rf85-4door', 'flex', '김치냉장실', '{"x":0.5,"y":0.555,"w":0.5,"h":0.445}'::jsonb, 2),
        ('cuckoo-upright-freezer-133', 'freezer', '냉동실', '{"x":0,"y":0,"w":1,"h":1}'::jsonb, 0)
      ) as t(template, zone, name, layout, sort_order)
      where t.template = f.template
    loop
      insert into compartments (household_id, fridge_id, name, zone, section, layout, sort_order)
      values (f.household_id, f.id, z.name, z.zone, 'zone', z.layout, z.sort_order)
      returning id into new_id;

      update items set compartment_id = new_id
      where compartment_id in (select id from compartments where fridge_id = f.id and zone = z.zone and id <> new_id);

      delete from compartments where fridge_id = f.id and zone = z.zone and id <> new_id;
    end loop;
  end loop;
end $$;

-- 확인: 냉장고마다 구역 칸과 그 안의 (남아 있는) 식품 수 (삼성 3칸, 쿠쿠 1칸)
select fr.name as fridge, c.name as compartment, c.zone, count(i.id) as items
from fridges fr
join compartments c on c.fridge_id = fr.id
left join items i on i.compartment_id = c.id and i.status = 'active'
where fr.template in ('samsung-rf85-4door', 'cuckoo-upright-freezer-133')
group by fr.name, c.name, c.zone, c.sort_order
order by fr.name, c.sort_order;
