import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cx } from '../lib/cx'
import { expiryLabel, LEVEL_TEXT, expiryLevel } from '../lib/expiry'
import { hasEgg } from '../lib/meals'
import { KIND_LABEL, soonItems, suggestRecipes, type Suggestion } from '../lib/recipes'
import type { Item } from '../lib/types'
import { Chip, Field, SunnyEgg } from './ui'

/** 식단표 적기 창: 일주일 안에 기한이 오는 재료로 만들 수 있는 요리. 누르면 메뉴에 이름이 들어가고, 쓰는 재료는 '사용예정'으로 골라진다 */
export function RecipePicks({
  items,
  menuText,
  onPick,
}: {
  items: Item[]
  /** 지금 적혀 있는 메뉴(어른+아이). 이미 적은 요리는 '적었어요'로 */
  menuText: string
  onPick: (s: Suggestion) => void
}) {
  const [focus, setFocus] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  /** 조리 순서는 펼칠 때 처음 한 번만 따로 불러온다 */
  const [steps, setSteps] = useState<Record<string, string[]> | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    if (open && !steps) import('../lib/recipeSteps').then((m) => setSteps(m.STEPS)).catch(() => setSteps({}))
  }, [open, steps])
  const soon = useMemo(() => soonItems(items), [items])
  const all = useMemo(() => suggestRecipes(items, { focusId: focus }), [items, focus])
  if (soon.length === 0) return null
  const shown = all.slice(0, more ? 15 : 5)

  return (
    <Field
      label="임박 재료로 만들 수 있는 요리"
      aside={
        all.length > 5 && (
          <button className="min-h-9 px-1 text-[13px] font-bold text-accent sm:min-h-11" onClick={() => setMore(!more)}>
            {more ? '접기' : '더 보기'}
          </button>
        )
      }
    >
      <p className="mb-2 text-xs break-keep text-muted">
        재료를 누르면 그 재료로 만들 요리만 보여요. 소금·간장·기름·양파·대파·계란 같은 기본 재료는 늘 있다고 봐요.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {soon.slice(0, 8).map(({ item }) => {
          const on = focus === item.id
          return (
            <Chip
              key={item.id}
              active={on}
              aria-pressed={on}
              onClick={() => setFocus(on ? null : item.id)}
            >
              {item.name}
              <span className={cx('text-xs font-semibold', on ? 'text-white/80' : LEVEL_TEXT[expiryLevel(item.expiry_date)])}>
                {expiryLabel(item.expiry_date)}
              </span>
            </Chip>
          )
        })}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl bg-sunken p-3 text-sm break-keep text-muted">
          이 재료로 만들 요리를 아직 못 찾았어요. 다른 재료를 눌러 보세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((s) => {
            const added = menuText.includes(s.recipe.name)
            return (
              <li key={s.recipe.name}>
                <div className="rounded-2xl border border-line bg-surface">
                <button
                  type="button"
                  disabled={added}
                  onClick={() => onPick(s)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition active:bg-sunken"
                >
                  <span className={cx('min-w-0 flex-1', added && 'opacity-60')}>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[15px] font-bold break-keep text-ink">{s.recipe.name}</span>
                      {hasEgg(s.recipe.name) && <SunnyEgg size={16} />}
                      <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[11px] font-bold text-muted">
                        {KIND_LABEL[s.recipe.kind]}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs break-keep text-muted">
                      {s.used.map((u) => u.item.name).join(' · ')} 써요
                      {s.missing.length > 0 ? ` · ${s.missing[0]}만 더 있으면 돼요` : ' · 지금 있는 재료로 돼요'}
                    </span>
                  </span>
                  {added ? (
                    <span className="shrink-0 text-xs font-bold text-accent">적었어요</span>
                  ) : (
                    <Plus size={18} className="shrink-0 text-accent" aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  aria-expanded={open === s.recipe.name}
                  onClick={() => setOpen(open === s.recipe.name ? null : s.recipe.name)}
                  className="flex min-h-11 w-full items-center gap-1 px-3.5 text-[13px] font-bold text-accent"
                >
                  만드는 법
                  <ChevronDown size={14} className={cx('transition motion-reduce:transition-none', open === s.recipe.name && 'rotate-180')} aria-hidden />
                </button>
                {open === s.recipe.name && (
                  <div className="border-t border-line px-3.5 py-3">
                    {!steps ? (
                      <p className="text-xs text-muted">불러오고 있어요</p>
                    ) : steps[s.recipe.name] ? (
                      <ol className="flex flex-col gap-1.5 text-sm break-keep text-ink">
                        {steps[s.recipe.name].map((t, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="w-4 shrink-0 font-bold text-accent">{i + 1}</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs break-keep text-muted">이 요리의 만드는 법은 아직 준비 중이에요.</p>
                    )}
                  </div>
                )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Field>
  )
}
