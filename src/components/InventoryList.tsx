import { Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { categoryOf } from '../lib/categories'
import { daysLeft, expiryLabel, expiryLevel, LEVEL_DOT, LEVEL_GROUP, LEVEL_TEXT, type ExpiryLevel } from '../lib/expiry'
import { ZONE_LABEL } from '../lib/templates'
import type { Compartment, Fridge, Item } from '../lib/types'
import { cx } from '../lib/cx'
import { Card, Chip, Segmented } from './ui'

type View = 'expiry' | 'compartment'
type LevelFilter = 'all' | 'expired' | 'urgent' | 'soon'

const LEVEL_FILTERS: { id: Exclude<LevelFilter, 'all'>; label: string; on: string }[] = [
  { id: 'expired', label: '기한 지남', on: 'bg-expired-soft text-expired' },
  { id: 'urgent', label: '3일 이내', on: 'bg-urgent-soft text-urgent' },
  { id: 'soon', label: '7일 이내', on: 'bg-soon-soft text-soon' },
]

const GROUP_ORDER: ExpiryLevel[] = ['expired', 'urgent', 'soon', 'ok', 'none']

interface Props {
  fridges: Fridge[]
  compartments: Compartment[]
  items: Item[]
  onOpen: (item: Item) => void
  onUseOne: (item: Item) => void
  onAddTo: (compartmentId: string) => void
}

/** 기한이 가까운 순, 기한 없는 건 맨 뒤 */
function byExpiry(a: Item, b: Item) {
  const da = daysLeft(a.expiry_date) ?? Infinity
  const db = daysLeft(b.expiry_date) ?? Infinity
  return da - db || a.name.localeCompare(b.name, 'ko')
}

const todayLabel = () => new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })

export function InventoryList({ fridges, compartments, items, onOpen, onUseOne, onAddTo }: Props) {
  const [view, setView] = useState<View>('expiry')
  const [fridgeId, setFridgeId] = useState<string>('all')
  const [level, setLevel] = useState<LevelFilter>('all')
  const [query, setQuery] = useState('')

  const compById = useMemo(() => new Map(compartments.map((c) => [c.id, c])), [compartments])
  const fridgeById = useMemo(() => new Map(fridges.map((f) => [f.id, f])), [fridges])

  const counts = useMemo(() => {
    const c: Record<ExpiryLevel, number> = { expired: 0, urgent: 0, soon: 0, ok: 0, none: 0 }
    for (const i of items) c[expiryLevel(i.expiry_date)]++
    return c
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim()
    return items
      .filter((i) => fridgeId === 'all' || compById.get(i.compartment_id)?.fridge_id === fridgeId)
      .filter((i) => level === 'all' || expiryLevel(i.expiry_date) === level)
      .filter((i) => !q || i.name.includes(q) || (i.memo ?? '').includes(q))
      .sort(byExpiry)
  }, [items, fridgeId, level, query, compById])

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((lv) => ({ lv, items: filtered.filter((i) => expiryLevel(i.expiry_date) === lv) })).filter(
        (g) => g.items.length > 0,
      ),
    [filtered],
  )

  const locationOf = (i: Item) => {
    const c = compById.get(i.compartment_id)
    if (!c) return ''
    const f = fridgeById.get(c.fridge_id)
    return fridges.length > 1 && f ? `${f.name} · ${c.name}` : c.name
  }

  const row = (i: Item, showLocation: boolean) => {
    const lv = expiryLevel(i.expiry_date)
    const cat = categoryOf(i.category)
    return (
      <li key={i.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpen(i)}>
          <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[22px]', cat.tint)}>
            {cat.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-bold">{i.name}</span>
              {i.opened && (
                <span className="shrink-0 rounded-md bg-sunken px-1.5 py-px text-[11px] font-semibold text-muted">
                  개봉
                </span>
              )}
            </span>
            <span className="tabular block truncate text-xs text-muted">
              {i.quantity}
              {i.unit}
              {showLocation && ` · ${locationOf(i)}`}
            </span>
          </span>
          <span className="tabular shrink-0 text-right">
            <span className={cx('block text-[13px] font-extrabold', LEVEL_TEXT[lv], lv === 'ok' && 'font-semibold')}>
              {expiryLabel(i.expiry_date)}
            </span>
            {i.expiry_date && (
              <span className="block text-[11px] text-muted">
                {i.expiry_type === 'use_by' ? '소비' : '유통'} {i.expiry_date.slice(5).replace('-', '/')}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => onUseOne(i)}
          className="h-9 min-w-12 shrink-0 rounded-xl bg-sunken px-2.5 text-xs font-bold text-ink transition active:brightness-95"
          title={i.quantity > 1 ? '1개 사용' : '다 먹음'}
        >
          {i.quantity > 1 ? '−1' : '다 먹음'}
        </button>
      </li>
    )
  }

  const visibleFridges = fridges.filter((f) => fridgeId === 'all' || f.id === fridgeId)
  const empty = (
    <p className="py-14 text-center text-sm text-muted">
      {items.length ? '조건에 맞는 식품이 없어요' : '아직 넣은 식품이 없어요. 식품 넣기를 눌러 시작해 보세요'}
    </p>
  )

  return (
    <div className="flex flex-col gap-3.5">
      {/* 먼저 챙길 식품 */}
      <Card className="p-3.5">
        <div className="mb-2.5 flex items-baseline justify-between px-0.5">
          <h2 className="text-[15px] font-bold">먼저 챙길 식품</h2>
          <span className="text-xs text-muted">{todayLabel()}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {LEVEL_FILTERS.map((l) => {
            const n = counts[l.id]
            const selected = level === l.id
            return (
              <button
                key={l.id}
                onClick={() => setLevel(selected ? 'all' : l.id)}
                aria-pressed={selected}
                className={cx(
                  'rounded-xl px-3 py-2 text-left ring-2 ring-inset transition',
                  n > 0 ? l.on : 'bg-sunken/60 text-faint',
                  selected ? 'ring-current' : 'ring-transparent',
                )}
              >
                <span className="block text-[11px] font-semibold">{l.label}</span>
                <span className="tabular block text-[22px] leading-tight font-extrabold">{n}</span>
              </button>
            )
          })}
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
          <Search size={17} className="shrink-0 text-faint" strokeWidth={2.2} />
          <input
            id="item-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="식품 검색"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="검색어 지우기" className="text-faint">
              <X size={16} />
            </button>
          )}
        </label>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            ['expiry', '기한순'],
            ['compartment', '칸별'],
          ]}
        />
      </div>

      {fridges.length > 1 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[{ id: 'all', name: '전체' }, ...fridges].map((f) => (
            <Chip key={f.id} active={fridgeId === f.id} onClick={() => setFridgeId(f.id)}>
              {f.name}
            </Chip>
          ))}
        </div>
      )}

      {view === 'expiry'
        ? groups.length
          ? groups.map((g) => (
              <section key={g.lv} className="flex flex-col gap-1.5">
                <h3 className="flex items-center gap-1.5 px-1 text-xs font-bold text-muted">
                  <span className={cx('h-1.5 w-1.5 rounded-full', LEVEL_DOT[g.lv])} />
                  {LEVEL_GROUP[g.lv]}
                  <span className="tabular font-semibold text-faint">{g.items.length}</span>
                </h3>
                <Card className="overflow-hidden">
                  <ul className="divide-y divide-line">{g.items.map((i) => row(i, true))}</ul>
                </Card>
              </section>
            ))
          : empty
        : visibleFridges.map((f) => (
            <section key={f.id} className="flex flex-col gap-2">
              {fridges.length > 1 && <h2 className="mt-2 px-1 text-[15px] font-extrabold">{f.name}</h2>}
              {compartments
                .filter((c) => c.fridge_id === f.id)
                .map((c) => {
                  const inside = filtered.filter((i) => i.compartment_id === c.id)
                  if (!inside.length && (query || level !== 'all')) return null
                  return (
                    <Card key={c.id} className="overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
                        <span className="rounded-md bg-sunken px-1.5 py-px text-[11px] font-semibold text-muted">
                          {ZONE_LABEL[c.zone]}
                        </span>
                        <span className="text-sm font-bold">{c.name}</span>
                        <span className="tabular text-sm text-faint">{inside.length}</span>
                        <button
                          onClick={() => onAddTo(c.id)}
                          className="ml-auto flex h-8 items-center gap-0.5 rounded-lg px-2 text-sm font-semibold text-accent active:bg-accent-soft"
                        >
                          <Plus size={16} strokeWidth={2.4} />
                          넣기
                        </button>
                      </div>
                      {inside.length > 0 && (
                        <ul className="divide-y divide-line border-t border-line">
                          {inside.map((i) => row(i, false))}
                        </ul>
                      )}
                    </Card>
                  )
                })}
            </section>
          ))}
    </div>
  )
}
