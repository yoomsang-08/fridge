import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { cx } from '../lib/cx'
import { expiryLabel, expiryLevel, LEVEL_TEXT } from '../lib/expiry'
import {
  frequentMenus,
  hasEgg,
  mealKey,
  mealMap,
  mealText,
  mealWeek,
  MEAL_AHEAD_WEEKS,
  MEAL_BACK_WEEKS,
  MEAL_LABEL,
  useMealSlots,
  weekName,
  WEEKDAYS,
  type MealDay,
} from '../lib/meals'
import type { Item, MealPlan as Meal, MealSlot } from '../lib/types'
import { Sheet } from './Sheet'
import { Button, Chip, Field, Segmented, SunnyEgg, TextInput } from './ui'

interface Props {
  meals: Meal[]
  items: Item[]
  onSave: (date: string, slot: MealSlot, menu: string, itemIds: string[], kidMenu: string) => Promise<void>
}

const weekRange = (days: MealDay[]) => {
  const a = days[0]
  const b = days[6]
  return `${a.month}월 ${a.day}일 – ${b.month}월 ${b.day}일`
}

/** 식단표 탭: 이번 주 + 다음 주, 화살표로 지난 주(8주 전까지)도 보고 고칠 수 있다. 폰은 한 주씩 카드, 넓은 화면(1024px~)은 두 주를 표로 */
export function MealPlanView({ meals, items, onSave }: Props) {
  // 이번 주 = 0, 지난 주 = -1 … 다음 주 = 1
  const [wk, setWk] = useState(0)
  // 두 주씩 보는 화면(옆으로 길게·넓은 화면)은 wk 부터 두 주. 다음 주가 아래에 오도록 마지막은 0부터
  const pair = Math.min(wk, 0)
  const weeks = useMemo(() => [pair, pair + 1].map((o) => mealWeek(o)), [pair])
  const one = useMemo(() => mealWeek(wk), [wk])
  const slots = useMealSlots()
  const map = useMemo(() => mealMap(meals), [meals])
  const [view, setViewState] = useState<'list' | 'strip'>(() => {
    try {
      return localStorage.getItem('fridge-meal-view') === 'strip' ? 'strip' : 'list'
    } catch {
      return 'list'
    }
  })
  const setView = (v: 'list' | 'strip') => {
    setViewState(v)
    try {
      localStorage.setItem('fridge-meal-view', v)
    } catch {
      /* 저장 못 해도 지금 화면은 바뀐다 */
    }
  }
  const [editing, setEditing] = useState<{ date: string; slot: MealSlot } | null>(null)

  const filled = (days: MealDay[]) =>
    days.reduce((n, d) => n + slots.filter((s) => map.has(mealKey(d.date, s))).length, 0)
  const total = slots.length * 7

  const open = (date: string, slot: MealSlot) => setEditing({ date, slot })
  const menuOf = (date: string, slot: MealSlot) => mealText(map.get(mealKey(date, slot)))

  return (
    <div className="pb-6">
      <h2 className="text-2xl font-extrabold tracking-tight">식단표</h2>
      <p className="mt-1 text-sm text-muted">뭘 먹을지 적어 두세요. 지난 주 식단도 다시 보고 고칠 수 있어요.</p>
      <WeekPager wk={wk} onChange={setWk} />

      {/* 폰·태블릿 세로: 한 주씩 */}
      <div className="lg:hidden">
        <Segmented
          className="mt-4 [&>button]:flex-1"
          value={view}
          options={[
            ['list', '목록'],
            ['strip', '옆으로 길게'],
          ]}
          onChange={setView}
        />
        {view === 'strip' ? (
          <Strip weeks={weeks} start={pair} slots={slots} menuOf={menuOf} open={open} />
        ) : (
          <>
            <WeekHead days={one} done={filled(one)} total={total} />
            <div className="flex flex-col gap-2.5">
              {one.map((d) => {
                return (
                  <section key={d.date} className="rounded-card bg-surface px-3.5 pt-3 pb-1.5 shadow-card">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-extrabold">{WEEKDAYS[d.dow]}요일</h3>
                      <span className="text-[13px] text-muted">
                        {d.month}월 {d.day}일
                      </span>
                      {d.isToday && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
                          오늘
                        </span>
                      )}
                    </div>
                    <ul>
                      {slots.map((s) => {
                        const text = menuOf(d.date, s)
                        const has = text.adult || text.kid
                        return (
                          <li key={s} className="border-t border-line first:border-t-0">
                            <button
                              onClick={() => open(d.date, s)}
                              className="flex min-h-11 w-full items-center gap-2.5 py-1 text-left transition active:opacity-70"
                            >
                              <span className="w-[38px] shrink-0 rounded-lg bg-sunken py-1 text-center text-xs font-bold text-muted">
                                {MEAL_LABEL[s]}
                              </span>
                              {has ? (
                                <MenuLines text={text} className="min-w-0 flex-1 py-1.5 text-[15px]" />
                              ) : (
                                <>
                                  <span className="flex-1 text-[15px] text-faint">눌러서 적기</span>
                                  <Plus size={16} className="text-faint" />
                                </>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 넓은 화면: 두 주를 위아래 표로 */}
      <div className="hidden lg:block">
        {weeks.map((days, w) => (
          <div key={w}>
            <div className="mt-5 mb-2.5 flex items-baseline gap-2.5 px-0.5">
              <h3 className="text-lg font-extrabold">{weekName(pair + w)}</h3>
              <span className="text-[13px] text-muted">
                {weekRange(days)} · {total}끼 중 {filled(days)}끼 적었어요
              </span>
            </div>
            <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1.5">
              <span />
              {days.map((d) => (
                <div
                  key={d.date}
                  className={cx(
                    'flex flex-col items-center rounded-2xl py-2 shadow-card',
                    d.isToday ? 'bg-accent-soft text-accent' : 'bg-surface',
                  )}
                >
                  <b className="text-[15px] font-extrabold">{WEEKDAYS[d.dow]}</b>
                  <span className={cx('text-xs', d.isToday ? 'text-accent' : 'text-muted')}>
                    {d.month}/{d.day}
                    {d.isToday && ' 오늘'}
                  </span>
                </div>
              ))}
              {slots.map((s) => (
                <Row key={s} label={MEAL_LABEL[s]}>
                  {days.map((d) => {
                    const text = menuOf(d.date, s)
                    const menu = text.adult || text.kid
                    return (
                      <button
                        key={d.date}
                        onClick={() => open(d.date, s)}
                        aria-label={`${d.month}월 ${d.day}일 ${MEAL_LABEL[s]}${menu ? ` ${labelOf(text)}` : ' 적기'}`}
                        className={cx(
                          'flex min-h-16 gap-1 rounded-2xl p-2.5 text-left text-sm leading-snug transition active:opacity-70',
                          menu
                            ? 'items-start bg-surface font-semibold shadow-card'
                            : 'items-center justify-center border border-dashed border-line text-faint',
                        )}
                      >
                        {menu ? (
                          <MenuLines text={text} cell className="min-w-0 flex-1" />
                        ) : (
                          <Plus size={18} />
                        )}
                      </button>
                    )
                  })}
                </Row>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <MealSheet
          date={editing.date}
          slot={editing.slot}
          slots={slots}
          meals={meals}
          items={items}
          current={(d, s) => menuOf(d, s)}
          idsOf={(d, s) => map.get(mealKey(d, s))?.item_ids ?? []}
          onClose={() => setEditing(null)}
          onSave={async (slot, menu, ids, kid) => {
            await onSave(editing.date, slot, menu, ids, kid)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

/** 폰·태블릿용 옆으로 길게 보기: PC처럼 이번 주(위)와 다음 주(아래)를 두 줄로 놓고, 요일 7열은 좌우로 민다. 끼니 이름은 왼쪽에 고정 */
function Strip({
  weeks,
  start,
  slots,
  menuOf,
  open,
}: {
  weeks: MealDay[][]
  start: number
  slots: MealSlot[]
  menuOf: (date: string, slot: MealSlot) => Menu
  open: (date: string, slot: MealSlot) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // 처음 열 때 오늘이 왼쪽 끝 가까이 오게
  useEffect(() => {
    const el = ref.current
    const t = el?.querySelector<HTMLElement>('[data-today]')
    const label = el?.querySelector<HTMLElement>('.sticky')
    if (el && t && label) el.scrollLeft += t.getBoundingClientRect().left - label.getBoundingClientRect().right - 6
  }, [])
  return (
    <div className="mt-3">
      <p className="mb-2 px-0.5 text-[13px] text-muted">좌우로 밀면 요일을 더 볼 수 있어요. 위쪽 주가 먼저, 아래쪽 주가 그다음이에요.</p>
      <div ref={ref} className="-mx-4 overflow-x-auto pb-2 sm:-mx-6">
        <div className="grid w-max grid-cols-[4.25rem_repeat(7,5.5rem)] gap-1.5 pr-4 sm:grid-cols-[5rem_repeat(7,5.5rem)] sm:pr-6">
          {weeks.map((days, w) => (
            <Fragment key={w}>
              <div className={cx('sticky left-0 z-10 col-span-8 w-screen bg-bg pr-4 pl-4 sm:pl-6', w ? 'mt-3' : false)}>
                <span className="text-[15px] font-extrabold">{weekName(start + w)}</span>
                <span className="ml-2 text-[13px] text-muted">{weekRange(days)}</span>
              </div>
              <span className="sticky left-0 z-10 bg-bg" />
              {days.map((d) => (
                <div
                  key={d.date}
                  data-today={d.isToday ? '' : undefined}
                  className={cx(
                    'flex flex-col items-center rounded-2xl py-2 shadow-card',
                    d.isToday ? 'bg-accent-soft text-accent' : 'bg-surface',
                  )}
                >
                  <b className="text-[15px] font-extrabold">{WEEKDAYS[d.dow]}</b>
                  <span className={cx('text-xs', d.isToday ? 'text-accent' : 'text-muted')}>
                    {d.month}/{d.day}
                    {d.isToday && ' 오늘'}
                  </span>
                </div>
              ))}
              {slots.map((s) => (
                <Fragment key={s}>
                  <span className="sticky left-0 z-10 flex items-center bg-bg pr-1.5 pl-4 sm:pl-6">
                    <span className="w-full rounded-lg bg-sunken py-1.5 text-center text-xs font-bold text-muted">
                      {MEAL_LABEL[s]}
                    </span>
                  </span>
                  {days.map((d) => {
                    const text = menuOf(d.date, s)
                    const menu = text.adult || text.kid
                    return (
                      <button
                        key={d.date}
                        onClick={() => open(d.date, s)}
                        aria-label={`${d.month}월 ${d.day}일 ${MEAL_LABEL[s]}${menu ? ` ${labelOf(text)}` : ' 적기'}`}
                        className={cx(
                          'flex min-h-16 gap-1 rounded-2xl p-2.5 text-left text-sm leading-snug transition active:opacity-70',
                          menu
                            ? 'items-start bg-surface font-semibold shadow-card'
                            : 'items-center justify-center border border-dashed border-line text-faint',
                        )}
                      >
                        {menu ? (
                          <MenuLines text={text} cell className="min-w-0 flex-1" />
                        ) : (
                          <Plus size={18} />
                        )}
                      </button>
                    )
                  })}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 이전 주 / 이번 주로 / 다음 주 */
function WeekPager({ wk, onChange }: { wk: number; onChange: (n: number) => void }) {
  const btn = 'flex min-h-11 items-center justify-center gap-1 rounded-xl bg-sunken px-3 text-sm font-bold transition active:opacity-70 disabled:opacity-35'
  return (
    <div className="mt-4 flex items-center gap-2">
      <button className={btn} disabled={wk <= -MEAL_BACK_WEEKS} onClick={() => onChange(wk - 1)} aria-label="이전 주">
        <ChevronLeft size={18} />
        이전 주
      </button>
      <button
        className={cx(btn, 'flex-1', wk === 0 ? 'text-accent' : 'text-ink')}
        disabled={wk === 0}
        onClick={() => onChange(0)}
      >
        {wk === 0 ? '이번 주' : `${weekName(wk)} · 이번 주로`}
      </button>
      <button className={btn} disabled={wk >= MEAL_AHEAD_WEEKS} onClick={() => onChange(wk + 1)} aria-label="다음 주">
        다음 주
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="self-center rounded-lg bg-sunken py-1.5 text-center text-xs font-bold text-muted">{label}</span>
      {children}
    </>
  )
}

function WeekHead({ days, done, total }: { days: MealDay[]; done: number; total: number }) {
  return (
    <>
      <div className="mt-3.5 mb-2.5 flex items-baseline justify-between gap-2 px-0.5 text-[13px] text-muted">
        <b className="text-[15px] font-bold text-ink">{weekRange(days)}</b>
        <span>
          {total}끼 중 {done}끼 적었어요
        </span>
      </div>
      <div className="mx-0.5 mb-3 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </>
  )
}

type Menu = { adult: string; kid: string }
const labelOf = ({ adult, kid }: Menu) => [adult && (kid ? `어른 ${adult}` : adult), kid && `아이 ${kid}`].filter(Boolean).join(', ')

/** '어른' / '아이' 작은 태그. 어른은 무채색, 아이는 포인트 색 */
function WhoTag({ who }: { who: 'adult' | 'kid' }) {
  return (
    <span
      className={cx(
        'shrink-0 rounded-full px-1.5 py-px text-[11px] leading-4 font-bold',
        who === 'kid' ? 'bg-accent-soft text-accent' : 'bg-sunken text-muted',
      )}
    >
      {who === 'kid' ? '아이' : '어른'}
    </span>
  )
}

/** 한 칸의 메뉴. 아이 메뉴가 있으면 어른·아이를 태그로 나눠 보여 주고, 어른 메뉴만 있으면 예전처럼 메뉴만 보인다 */
function MenuLines({ text, cell = false, className }: { text: Menu; cell?: boolean; className?: string }) {
  const both = Boolean(text.kid)
  const lines: ['adult' | 'kid', string][] = [['adult', text.adult], ['kid', text.kid]]
  return (
    <span className={cx('flex flex-col', cell ? 'gap-1 font-semibold' : 'gap-1 font-semibold', className)}>
      {lines
        .filter(([, v]) => v)
        .map(([who, v]) => (
          <span key={who} className={cx('flex gap-1.5', cell ? 'flex-col items-start gap-0.5' : 'items-baseline')}>
            {both && <WhoTag who={who} />}
            <span className="flex min-w-0 items-start gap-1">
              <span className="min-w-0 break-keep [overflow-wrap:anywhere]">{v}</span>
              {hasEgg(v) && <EggMark />}
            </span>
          </span>
        ))}
    </span>
  )
}

/** 메뉴에 달걀이 있을 때 붙는 작은 반숙 달걀 (이스터에그) */
function EggMark() {
  return (
    <span className="shrink-0" aria-hidden>
      <SunnyEgg size={18} />
    </span>
  )
}

function MealSheet({
  date,
  slot: initial,
  slots,
  meals,
  items,
  current,
  idsOf,
  onClose,
  onSave,
}: {
  date: string
  slot: MealSlot
  slots: MealSlot[]
  meals: Meal[]
  items: Item[]
  current: (date: string, slot: MealSlot) => Menu
  idsOf: (date: string, slot: MealSlot) => string[]
  onClose: () => void
  onSave: (slot: MealSlot, menu: string, itemIds: string[], kidMenu: string) => Promise<void>
}) {
  const [slot, setSlot] = useState(initial)
  const [menu, setMenu] = useState(current(date, initial).adult)
  const [kid, setKid] = useState(current(date, initial).kid)
  /** 자주 적은 메뉴 칩이 들어갈 칸 */
  const [target, setTarget] = useState<'adult' | 'kid'>('adult')
  /** 이 끼니에 쓰려고 고른 냉장고 식품 */
  const [picked, setPicked] = useState<string[]>(() => idsOf(date, initial))
  const [more, setMore] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [y, m, d] = date.split('-').map(Number)
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7
  const frequent = useMemo(() => frequentMenus(meals), [meals])
  // 기한이 가까운 식품부터 4개. 눌러서 사용예정으로 연결한다
  const soonest = useMemo(
    () =>
      items
        .filter((i) => i.expiry_date && expiryLevel(i.expiry_date) !== 'ok')
        .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
        .slice(0, 4),
    [items],
  )

  // 이미 고른 식품은 기한이 넉넉해도 칩으로 계속 보인다
  const extra = useMemo(() => items.filter((i) => picked.includes(i.id)), [items, picked])

  const pick = (s: MealSlot) => {
    setSlot(s)
    setMenu(current(date, s).adult)
    setKid(current(date, s).kid)
    setPicked(idsOf(date, s))
  }
  const add = (text: string) =>
    (target === 'kid' ? setKid : setMenu)((v) => (v.trim() ? `${v.trim()}, ${text}` : text))
  /** 냉장고 식품 고르기/빼기: 사용예정 연결만 바꾸고, 메뉴명은 건드리지 않는다 */
  const toggleItem = (i: Item) => setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await onSave(slot, menu, picked, kid)
    } catch {
      setError('저장하지 못했어요. 잠시 뒤에 다시 해 주세요.')
      setBusy(false)
    }
  }
  const savedText = current(date, slot)
  const saved = savedText.adult || savedText.kid
  const canSave = Boolean(menu.trim() || kid.trim())

  return (
    <Sheet
      title={`${WEEKDAYS[dow]}요일 ${m}월 ${d}일 식단`}
      onClose={onClose}
      footer={
        <>
          {saved && (
            <Button
              variant="ghost"
              className="px-4"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await onSave(slot, '', [], '').catch(() => setBusy(false))
              }}
            >
              비우기
            </Button>
          )}
          <Button className="flex-1" disabled={busy || !canSave} onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="끼니">
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <Chip key={s} active={slot === s} onClick={() => pick(s)}>
                {MEAL_LABEL[s]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="어른 메뉴">
          <div className="relative">
            <TextInput
              autoFocus
              value={menu}
              maxLength={100}
              placeholder="예: 김치찌개와 계란말이"
              className={hasEgg(menu) ? 'pr-12' : undefined}
              onFocus={() => setTarget('adult')}
              onChange={(e) => setMenu(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canSave && !busy && save()}
            />
            {hasEgg(menu) && (
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2">
                <EggMark />
              </span>
            )}
          </div>
        </Field>
        <Field label="아이 메뉴 (따로 먹을 때만)">
          <div className="relative">
            <TextInput
              value={kid}
              maxLength={100}
              placeholder="예: 순한 계란찜"
              className={hasEgg(kid) ? 'pr-12' : undefined}
              onFocus={() => setTarget('kid')}
              onChange={(e) => setKid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canSave && !busy && save()}
            />
            {hasEgg(kid) && (
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2">
                <EggMark />
              </span>
            )}
          </div>
          {picked.length > 0 && !canSave && (
            <p className="mt-2 text-xs break-keep text-muted">먹을 메뉴 이름을 적어 주세요</p>
          )}
        </Field>
        {frequent.length > 0 && (
          <Field label={`자주 적은 메뉴 (${target === 'kid' ? '아이' : '어른'} 칸에 들어가요)`}>
            <div className="flex flex-wrap gap-2">
              {frequent.map((f) => (
                <Chip key={f} tone="suggest" onClick={() => add(f)}>
                  {f}
                </Chip>
              ))}
            </div>
          </Field>
        )}
        {items.length > 0 && (
          <Field
            label="냉장고 재료 쓰기"
            aside={
              items.length > soonest.length && (
                <button className="min-h-9 px-1 text-[13px] font-bold text-accent sm:min-h-11" onClick={() => setMore(!more)}>
                  {more ? '접기' : '다른 재료 고르기'}
                </button>
              )
            }
          >
            <p className="mb-2 text-xs break-keep text-muted">고르면 재고에 ‘사용예정’ 표시가 붙어요. 식단표에는 위에 적은 메뉴명만 보여요.</p>
            <div className="flex flex-wrap gap-2">
              {[...soonest, ...extra.filter((e) => !soonest.some((s) => s.id === e.id))].map((i) => {
                const on = picked.includes(i.id)
                return (
                  <Chip key={i.id} active={on} tone={on ? 'default' : 'suggest'} aria-pressed={on} onClick={() => toggleItem(i)}>
                    {i.name}
                    <span className={cx('text-xs font-semibold', on ? 'text-white/80' : LEVEL_TEXT[expiryLevel(i.expiry_date)])}>
                      {expiryLabel(i.expiry_date)}
                    </span>
                  </Chip>
                )
              })}
            </div>
            {more && (
              <div className="mt-3 flex flex-col gap-2">
                <TextInput value={q} placeholder="식품 이름 찾기" onChange={(e) => setQ(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {items
                    .filter((i) => !soonest.some((s) => s.id === i.id) && !picked.includes(i.id) && i.name.includes(q.trim()))
                    .slice(0, 12)
                    .map((i) => (
                      <Chip key={i.id} onClick={() => toggleItem(i)}>
                        {i.name}
                      </Chip>
                    ))}
                </div>
              </div>
            )}
          </Field>
        )}
        {error && <p className="rounded-2xl bg-expired-soft p-3 text-sm text-expired">{error}</p>}
      </div>
    </Sheet>
  )
}
