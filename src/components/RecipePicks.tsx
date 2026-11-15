import { ChevronDown, Plus, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cx } from '../lib/cx'
import { expiryLabel, LEVEL_TEXT, expiryLevel } from '../lib/expiry'
import { hasEgg } from '../lib/meals'
import { KIND_LABEL, soonItems, suggestRecipes, type Suggestion } from '../lib/recipes'
import { reactionMap } from '../lib/recipeReactions'
import type { Item, RecipeReaction } from '../lib/types'
import { RecipeReactionList } from './RecipeReactionList'
import { Chip, Field, SunnyEgg } from './ui'

const NO_OVERLAY: Record<string, 'up' | 'down' | null> = {}

/** 식단표 적기 창: 일주일 안에 기한이 오는 재료로 만들 수 있는 요리. 누르면 메뉴에 이름이 들어가고, 쓰는 재료는 '사용예정'으로 골라진다 */
export function RecipePicks({
  items,
  menuText,
  target,
  onPick,
  onUndo,
  reactions,
  onReact,
}: {
  items: Item[]
  /** 지금 적혀 있는 메뉴(어른+아이). 이미 적은 요리는 '적었어요'로 */
  menuText: string
  /** 지금 이름이 들어갈 칸 */
  target: '어른' | '아이'
  onPick: (s: Suggestion) => number | void
  /** '적었어요'를 다시 누르면: 메뉴에서 이름을 빼고 그 요리 때문에 고른 재료를 푼다 */
  onUndo: (s: Suggestion) => void
  /** 집 식구가 표시한 좋아요·싫어요 */
  reactions: RecipeReaction[]
  /** 표시하기. null 이면 지운다(되돌리기) */
  onReact: (name: string, reaction: 'up' | 'down' | null) => Promise<void> | void
}) {
  const [focus, setFocus] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [allChips, setAllChips] = useState(false)
  /** 누른 결과를 3초 동안 알려 주는 한 줄 */
  const [note, setNote] = useState<{ text: string; undo?: () => void } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** undo 가 있으면 누를 시간을 주려고 6초 */
  const say = (text: string, undo?: () => void) => {
    setNote({ text, undo })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setNote(null), undo ? 6000 : 3000)
  }
  // 누르자마자 보이게 먼저 반영해 두고, 저장된 값이 들어오면 거기에 맡긴다
  const [overlay, setOverlay] = useState<{ base: RecipeReaction[]; map: Record<string, 'up' | 'down' | null> }>({ base: reactions, map: {} })
  const mine = overlay.base === reactions ? overlay.map : NO_OVERLAY
  const setMine = (fn: (m: Record<string, 'up' | 'down' | null>) => Record<string, 'up' | 'down' | null>) =>
    setOverlay((o) => ({ base: reactions, map: fn(o.base === reactions ? o.map : {}) }))
  const [listOpen, setListOpen] = useState(false)
  const merged = useMemo(() => {
    const m = reactionMap(reactions)
    for (const [k, v] of Object.entries(mine)) {
      if (v) m.set(k, v)
      else m.delete(k)
    }
    return m
  }, [reactions, mine])
  const react = (name: string, next: 'up' | 'down' | null) => {
    setMine((m) => ({ ...m, [name]: next }))
    Promise.resolve(onReact(name, next)).catch(() => {
      setMine((m) => {
        const { [name]: _x, ...rest } = m
        return rest
      })
      say('저장하지 못했어요. 잠시 뒤에 다시 눌러 주세요')
    })
  }
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  /** 조리 순서는 펼칠 때 처음 한 번만 따로 불러온다 */
  const [steps, setSteps] = useState<Record<string, string[]> | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    if (open && !steps) import('../lib/recipeSteps').then((m) => setSteps(m.STEPS)).catch(() => setSteps({}))
  }, [open, steps])
  const soon = useMemo(() => soonItems(items), [items])
  const all = useMemo(() => suggestRecipes(items, { focusId: focus, reactions: merged }), [items, focus, merged])
  if (soon.length === 0) return null
  const shown = all.slice(0, more ? 15 : 5)

  return (
    <Field
      label="곧 기한이 되는 재료로 만들 요리"
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
        {soon.slice(0, allChips ? soon.length : 8).map(({ item }) => {
          const on = focus === item.id
          return (
            <Chip
              key={item.id}
              active={on}
              aria-pressed={on}
              className="max-w-full"
              onClick={() => setFocus(on ? null : item.id)}
            >
              <span className="min-w-0 truncate">{item.name}</span>
              <span className={cx('shrink-0 text-[13px] font-bold', on ? 'text-white/80' : LEVEL_TEXT[expiryLevel(item.expiry_date)])}>
                {expiryLabel(item.expiry_date)}
              </span>
            </Chip>
          )
        })}
        {soon.length > 8 && (
          <Chip onClick={() => setAllChips(!allChips)}>{allChips ? '접기' : `재료 ${soon.length - 8}개 더 보기`}</Chip>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl bg-sunken p-3 text-sm break-keep text-muted">
          {focus ? '이 재료로 만들 요리를 아직 못 찾았어요. 다른 재료를 눌러 보세요.' : '이 재료로는 추천할 요리가 없어요. 메뉴는 직접 적어 주세요.'}
        </p>
      ) : (
        <>
        {/* 안내 자리는 늘 같은 높이: 누르면 3초 동안 결과로 바뀌어도 아래 목록이 밀리지 않는다 */}
        <div className="mb-2 flex min-h-11 items-center">
          {note ? (
            <p role="status" className="flex w-full items-center justify-between rounded-2xl bg-accent-soft px-3.5 py-1.5 text-[13px] font-bold break-keep text-accent">
              {note.text}
              {note.undo && (
                <button type="button" className="ml-2 min-h-11 px-2 font-extrabold underline" onClick={() => { note.undo?.(); setNote(null) }}>
                  되돌리기
                </button>
              )}
            </p>
          ) : (
            <p className="px-1 text-xs break-keep text-muted">요리를 누르면 메뉴에 적히고, 쓰는 재료는 ‘사용예정’으로 골라져요. 다시 누르면 빼요.</p>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {shown.map((s) => {
            const added = menuText.includes(s.recipe.name)
            const mood = merged.get(s.recipe.name)
            return (
              <li key={s.recipe.name}>
                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex items-stretch">
                <button
                  type="button"
                  aria-pressed={added}
                  onClick={() => {
                    if (added) {
                      onUndo(s)
                      say("메뉴에서 뺐어요")
                    } else {
                      const n = onPick(s)
                      say(`${target} 메뉴에 적었어요${n ? ` · 사용예정 ${n}개 골랐어요` : ''}`)
                    }
                  }}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 text-left transition active:bg-sunken"
                >
                  <span className={cx('min-w-0 flex-1', added && 'opacity-60')}>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[15px] font-bold break-keep text-ink">{s.recipe.name}</span>
                      {hasEgg(s.recipe.name) && <SunnyEgg size={18} />}
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
                    <span className="shrink-0 text-xs font-bold text-accent">적었어요 · 빼기</span>
                  ) : (
                    <Plus size={18} className="shrink-0 text-accent" aria-hidden />
                  )}
                </button>
                </div>
                <div className="flex items-stretch border-t border-line">
                  <button
                    type="button"
                    aria-expanded={open === s.recipe.name}
                    onClick={() => setOpen(open === s.recipe.name ? null : s.recipe.name)}
                    className="flex min-h-11 flex-1 items-center gap-1 px-3.5 text-[12px] font-bold text-accent transition active:bg-sunken"
                  >
                    만드는 법
                    <ChevronDown size={14} className={cx('transition motion-reduce:transition-none', open === s.recipe.name && 'rotate-180')} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-pressed={mood === 'up'}
                    aria-label={`${s.recipe.name} 좋아요`}
                    onClick={() => {
                      const on = mood === 'up'
                      react(s.recipe.name, on ? null : 'up')
                      say(on ? '좋아요를 뺐어요' : '좋아요 했어요 · 비슷하면 먼저 보여 줄게요')
                    }}
                    className={cx('flex min-h-11 w-12 shrink-0 items-center justify-center border-l border-line transition active:bg-sunken', mood === 'up' ? 'bg-accent-soft text-accent' : 'text-muted')}
                  >
                    <ThumbsUp size={18} fill={mood === 'up' ? 'currentColor' : 'none'} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-pressed={false}
                    aria-label={`${s.recipe.name} 싫어요`}
                    onClick={() => {
                      const name = s.recipe.name
                      react(name, 'down')
                      say(`‘${name}’은 앞으로 추천하지 않아요`, () => react(name, null))
                    }}
                    className="flex min-h-11 w-12 shrink-0 items-center justify-center border-l border-line text-muted transition active:bg-sunken"
                  >
                    <ThumbsDown size={18} aria-hidden />
                  </button>
                </div>
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
        </>
      )}
      {reactions.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={listOpen}
            onClick={() => setListOpen(!listOpen)}
            className="flex min-h-11 w-full items-center justify-between rounded-2xl px-3 text-[13px] font-bold text-muted active:bg-sunken"
          >
            표시한 요리 {reactions.length}개 보기 · 되돌리기
            <ChevronDown size={14} className={cx('transition motion-reduce:transition-none', listOpen && 'rotate-180')} aria-hidden />
          </button>
          {listOpen && (
            <div className="rounded-2xl border border-line bg-surface px-3.5 py-3">
              <RecipeReactionList reactions={reactions} onUndo={(n) => react(n, null)} />
            </div>
          )}
        </div>
      )}
      {all.length > 5 && shown.length > 0 && (
        <button
          className="mt-2 min-h-11 w-full rounded-2xl text-[13px] font-bold text-accent active:bg-sunken"
          onClick={() => setMore(!more)}
        >
          {more ? '접기' : '요리 더 보기'}
        </button>
      )}
    </Field>
  )
}
