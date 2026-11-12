import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { toDateString, today } from '../lib/expiry'
import { hasEgg, MEAL_LABEL } from '../lib/meals'
import type { MealPlan, MealSlot } from '../lib/types'
import { cx } from '../lib/cx'
import { Card, SunnyEgg } from './ui'

/** 오늘 식단표에는 점심·저녁만 보여 준다 */
const SLOTS: MealSlot[] = ['lunch', 'dinner']

interface Props {
  meals: MealPlan[]
  /** 식단표 탭으로 */
  onOpen: () => void
}

/**
 * 재고 화면 맨 위: 오늘 식단표. 적어 둔 끼니(점심·저녁)만 가로로 나란히, 하나도 없으면 안내 한 줄.
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
            filled.length === 0 && 'items-center gap-3 p-4',
          )}
        >
          {filled.length === 0 ? (
            <>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sunken" aria-hidden>
                <SunnyEgg size={26} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">오늘 식단표가 작성되지 않았어요</span>
                <span className="block text-[13px] text-muted">눌러서 오늘 뭐 먹을지 적어 보세요</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-faint" />
            </>
          ) : (
            <ul className={cx('grid min-w-0 flex-1 divide-x divide-line', filled.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
              {filled.map((m) => (
                <MealLine key={m.slot} slot={m.slot} menu={m.menu} />
              ))}
            </ul>
          )}
        </button>
      </Card>
    </section>
  )
}

/** 끼니 하나: 끼니 이름 + 메뉴 */
function MealLine({ slot, menu }: { slot: MealSlot; menu: string }) {
  return (
    <li className="min-w-0 px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-[13px] font-bold text-accent">
        {MEAL_LABEL[slot]}
        {hasEgg(menu) && <SunnyEgg size={16} />}
      </span>
      <span className="mt-1 block text-[17px] leading-snug font-extrabold break-keep [overflow-wrap:anywhere]">{menu}</span>
    </li>
  )
}
