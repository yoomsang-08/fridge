import { useMemo, useState } from 'react'
import { categoryOf } from '../lib/categories'
import { dDayLabel, daysLeft, expiryLevel, LEVEL_STYLE, type ExpiryLevel } from '../lib/expiry'
import { ZONE_LABEL } from '../lib/templates'
import type { Compartment, Fridge, Item } from '../lib/types'

type View = 'expiry' | 'compartment'
type LevelFilter = 'all' | 'expired' | 'urgent' | 'soon'

const LEVEL_FILTERS: { id: Exclude<LevelFilter, 'all'>; label: string; match: ExpiryLevel[]; style: string }[] = [
  { id: 'expired', label: '기한 지남', match: ['expired'], style: LEVEL_STYLE.expired },
  { id: 'urgent', label: '3일 이내', match: ['urgent'], style: LEVEL_STYLE.urgent },
  { id: 'soon', label: '7일 이내', match: ['soon'], style: LEVEL_STYLE.soon },
]

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
    const levels = LEVEL_FILTERS.find((l) => l.id === level)?.match
    return items
      .filter((i) => fridgeId === 'all' || compById.get(i.compartment_id)?.fridge_id === fridgeId)
      .filter((i) => !levels || levels.includes(expiryLevel(i.expiry_date)))
      .filter((i) => !q || i.name.includes(q) || (i.memo ?? '').includes(q))
      .sort(byExpiry)
  }, [items, fridgeId, level, query, compById])

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
      <li key={i.id} className="flex items-center gap-3 bg-white px-3 py-2.5">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpen(i)}>
          <span className="text-2xl">{cat.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              {i.name}
              {i.opened && <span className="ml-1 text-xs font-normal text-slate-400">개봉</span>}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {i.quantity}
              {i.unit}
              {showLocation && ` · ${locationOf(i)}`}
              {i.expiry_date && ` · ${i.expiry_type === 'use_by' ? '소비' : '유통'} ${i.expiry_date.slice(5).replace('-', '/')}`}
            </span>
          </span>
          <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${LEVEL_STYLE[lv]}`}>
            {dDayLabel(i.expiry_date)}
          </span>
        </button>
        <button
          onClick={() => onUseOne(i)}
          className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 active:bg-slate-100"
          title={i.quantity > 1 ? '1개 사용' : '다 먹음'}
        >
          {i.quantity > 1 ? '−1' : '다 먹음'}
        </button>
      </li>
    )
  }

  const visibleFridges = fridges.filter((f) => fridgeId === 'all' || f.id === fridgeId)

  return (
    <div className="flex flex-col gap-3">
      {/* 임박 요약 */}
      <div className="grid grid-cols-3 gap-2">
        {LEVEL_FILTERS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLevel(level === l.id ? 'all' : l.id)}
            className={`rounded-xl p-3 text-left shadow-sm ring-2 ${
              level === l.id ? 'ring-sky-500' : 'ring-transparent'
            } ${counts[l.id] > 0 ? l.style : 'bg-white text-slate-400'}`}
          >
            <div className="text-xs font-semibold opacity-90">{l.label}</div>
            <div className="text-2xl font-extrabold">{counts[l.id]}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 식품 검색"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2"
        />
        <div className="flex rounded-lg bg-slate-200 p-0.5 text-sm">
          {(
            [
              ['expiry', '기한순'],
              ['compartment', '칸별'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 ${view === v ? 'bg-white font-semibold shadow-sm' : 'text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {fridges.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {[{ id: 'all', name: '전체' }, ...fridges].map((f) => (
            <button
              key={f.id}
              onClick={() => setFridgeId(f.id)}
              className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
                fridgeId === f.id ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {view === 'expiry' ? (
        filtered.length ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl shadow-sm">
            {filtered.map((i) => row(i, true))}
          </ul>
        ) : (
          <p className="py-10 text-center text-slate-400">
            {items.length ? '조건에 맞는 식품이 없어요' : '아직 넣은 식품이 없어요. + 버튼으로 넣어 보세요'}
          </p>
        )
      ) : (
        visibleFridges.map((f) => (
          <section key={f.id} className="flex flex-col gap-2">
            {fridges.length > 1 && <h2 className="mt-2 font-bold">{f.name}</h2>}
            {compartments
              .filter((c) => c.fridge_id === f.id)
              .map((c) => {
                const inside = filtered.filter((i) => i.compartment_id === c.id)
                if (!inside.length && (query || level !== 'all')) return null
                return (
                  <div key={c.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 text-sm">
                      <span className="rounded bg-slate-200 px-1.5 text-xs text-slate-600">{ZONE_LABEL[c.zone]}</span>
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-slate-400">{inside.length}</span>
                      <button onClick={() => onAddTo(c.id)} className="ml-auto text-sky-700">
                        + 넣기
                      </button>
                    </div>
                    {inside.length > 0 && <ul className="divide-y divide-slate-100">{inside.map((i) => row(i, false))}</ul>}
                  </div>
                )
              })}
          </section>
        ))
      )}
    </div>
  )
}
