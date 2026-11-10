import { MEAL_SLOTS, setMealSlots, useMealSlots } from '../lib/meals'
import type { Repo } from '../lib/repo'
import { Card, Switch } from './ui'

/** 식단표에 보여 줄 끼니 고르기. 집 식구 모두에게 같게 보여요 */
export function MealSlotSettings({ repo, onChanged, onError }: { repo: Repo; onChanged: () => void; onError: (m: string | null) => void }) {
  const on = useMealSlots()
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-extrabold">식단표 끼니</h2>
      <p className="mt-1 text-sm text-muted">
        식단표에 보일 끼니를 골라요. 하나는 꼭 켜 둬야 해요. 바꾸면 모든 기기에 똑같이 보여요.
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
                  onChange={(v) => {
                    const next = MEAL_SLOTS.map((x) => x.id).filter((id) => (id === s.id ? v : on.includes(id)))
                    setMealSlots(next)
                    repo.setMealSlots(next).then(onChanged, () => onError('끼니 설정을 저장하지 못했어요. 잠시 뒤에 다시 해 주세요.'))
                  }}
                />
              </label>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
