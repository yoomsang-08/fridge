import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { toDateString, today } from '../lib/expiry'
import { hasEgg, MEAL_LABEL, MEAL_SLOTS } from '../lib/meals'
import type { MealPlan, MealSlot } from '../lib/types'
import { cx } from '../lib/cx'
import { Card, SunnyEgg } from './ui'

/** 하루 순서대로 (아침 → 야식). 적어 둔 끼니만 보인다 */
const SLOTS: MealSlot[] = MEAL_SLOTS.map((s) => s.id)

interface Props {
  meals: MealPlan[]
  /** 식단표 탭으로 */
  onOpen: () => void
}

/**
 * 재고 화면 맨 위: 오늘 식단표. 적어 둔 끼니(아침~야식)만 한 줄에 둘씩, 하나도 없으면 안내 한 줄.
 * 어른/아이 메뉴 칩은 `MealLine` 안에 들어갈 자리.
 */
export function TodayMeals({ meals, onOpen }: Props) {
  const todayStr = toDateString(today())
  const filled = useMemo(
    () =>
      SLOTS.map((slot) => ({
        slot,
        menu: meals.find((m) => m.plan_date === todayStr && m.slot === slot)?.menu.trim() ?? '',
      })).filter((m) => m.menu),
    [meals, todayStr],
  )

  return (
    <section className="flex flex-col gap-2.5" aria-label="오늘 식단표">
      <h2 className="px-1 text-[15px] font-extrabold">오늘 식단표</h2>
      <Card className="overflow-hidden">
        <button
          onClick={onOpen}
          className={cx(
            'flex w-full items-stretch text-left transition active:bg-sunken/60',
            filled.length === 0 && 'items-center gap-3.5 p-5',
          )}
        >
          {filled.length === 0 ? (
            <>
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sunken" aria-hidden>
                <SunnyEgg size={30} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold">오늘 식단표가 작성되지 않았어요</span>
                <span className="block text-[13px] text-muted">눌러서 오늘 뭐 먹을지 적어 보세요</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-faint" />
            </>
          ) : (
            // 한 줄에 둘씩. 셋 이상이면 다음 줄로 내려가고, 홀수 개의 마지막 칸은 전체 폭
            <ul className="grid min-w-0 flex-1 grid-cols-2 gap-px bg-line">
              {filled.map((m, i) => (
                <MealLine
                  key={m.slot}
                  slot={m.slot}
                  menu={m.menu}
                  wide={filled.length === 1 || (filled.length % 2 === 1 && i === filled.length - 1)}
                />
              ))}
            </ul>
          )}
        </button>
      </Card>
    </section>
  )
}

/** 끼니 하나: 끼니 이름 + 메뉴 */
function MealLine({ slot, menu, wide }: { slot: MealSlot; menu: string; wide: boolean }) {
  return (
    <li className={cx('min-w-0 bg-surface px-4 py-4', wide && 'col-span-2')}>
      <span className="flex items-center gap-1.5 text-sm font-bold text-accent">
        {MEAL_LABEL[slot]}
        {hasEgg(menu) && <SunnyEgg size={18} />}
      </span>
      <span className="mt-1 block text-[21px] leading-snug font-extrabold break-keep [overflow-wrap:anywhere]">{menu}</span>
    </li>
  )
}
