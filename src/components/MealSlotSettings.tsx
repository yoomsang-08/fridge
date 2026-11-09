import { MEAL_SLOTS, setMealSlots, useMealSlots } from '../lib/meals'
import { Card, Switch } from './ui'

/** 식단표에 보여 줄 끼니 고르기. 이 기기에만 저장돼요 */
export function MealSlotSettings() {
  const on = useMealSlots()
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-extrabold">식단표 끼니</h2>
      <p className="mt-1 text-sm text-muted">
        식단표에 보일 끼니를 골라요. 하나는 꼭 켜 둬야 해요. 이 기기에만 적용돼요.
      </p>
      <ul className="mt-3 flex flex-col">
        {MEAL_SLOTS.map((s) => {
          const checked = on.includes(s.id)
          return (
            <li key={s.id}>
              <label className="flex min-h-12 items-center justify-between gap-3 border-b border-line last:border-b-0">
                <span className="font-semibold">{s.label}</span>
                <Switch
                  checked={checked}
                  disabled={checked && on.length === 1}
                  aria-label={s.label}
                  onChange={(v) =>
                    setMealSlots(MEAL_SLOTS.map((x) => x.id).filter((id) => (id === s.id ? v : on.includes(id))))
                  }
                />
              </label>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
