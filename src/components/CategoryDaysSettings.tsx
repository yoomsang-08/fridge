import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { DAYS_OPTIONS, daysLabel, useCategories, type DaysKey } from '../lib/categories'
import { cx } from '../lib/cx'
import type { Repo } from '../lib/repo'
import { Card } from './ui'

const PLACES: [DaysKey, string][] = [
  ['fridge_days', '냉장'],
  ['freezer_days', '냉동'],
  ['pantry_days', '실온'],
]

/** 분류별 자동 기한: 유통기한이 안 찍힌 재료는 넣은 날 + 이 기간으로 기한을 채운다 */
export function CategoryDaysSettings({ repo, onError }: { repo: Repo; onError: (msg: string) => void }) {
  const categories = useCategories().filter((c) => !c.hidden)
  const [open, setOpen] = useState<string | null>(null)

  const change = async (id: string, key: DaysKey, value: string) => {
    try {
      await repo.setCategoryDays(id, { [key]: value ? Number(value) : null })
    } catch (e) {
      onError(e instanceof Error ? e.message : '저장하지 못했어요')
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-extrabold">자동 기한</h2>
      <p className="mt-1 text-sm text-muted">
        날짜가 안 찍힌 재료는 넣은 날에 이 기간을 더해 기한을 정해요. 포장에 날짜가 있으면 그 날짜를 넣어 주세요.
      </p>
      <ul className="mt-3 flex flex-col">
        {categories.map((c) => {
          const on = open === c.id
          return (
            <li key={c.id} className="border-b border-line last:border-b-0">
              <button
                className="flex min-h-12 w-full items-center gap-2.5 text-left"
                onClick={() => setOpen(on ? null : c.id)}
                aria-expanded={on}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                  style={{ backgroundColor: c.tint }}
                >
                  {c.emoji}
                </span>
                <span className="w-16 shrink-0 text-sm font-bold">{c.label}</span>
                <span className="tabular min-w-0 flex-1 truncate text-xs text-muted">
                  {PLACES.map(([k, l]) => `${l} ${daysLabel(c[k])}`).join(' · ')}
                </span>
                <ChevronDown size={16} className={cx('shrink-0 text-faint transition', on && 'rotate-180')} />
              </button>
              {on && (
                <div className="grid grid-cols-3 gap-2 pb-3">
                  {PLACES.map(([k, l]) => (
                    <label key={k} className="flex flex-col gap-1 text-xs font-semibold text-muted">
                      {l}
                      <select
                        value={c[k] ?? ''}
                        onChange={(e) => change(c.id, k, e.target.value)}
                        className="tabular h-10 rounded-xl border border-line bg-surface px-2 text-sm font-bold text-ink"
                      >
                        <option value="">안 함</option>
                        {/* 목록에 없는 값(직접 넣은 값)도 보이게 */}
                        {[...new Set([...DAYS_OPTIONS, ...(c[k] ? [c[k]!] : [])])]
                          .sort((a, b) => a - b)
                          .map((d) => (
                            <option key={d} value={d}>
                              {daysLabel(d)}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
