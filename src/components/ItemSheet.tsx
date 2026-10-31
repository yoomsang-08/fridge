import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { BarcodeScanner } from './BarcodeScanner'
import { CATEGORIES, UNITS } from '../lib/categories'
import { addDays, addMonths, dDayLabel } from '../lib/expiry'
import { ZONE_LABEL } from '../lib/templates'
import {
  foodSearchAvailable,
  guessCategory,
  searchFoodByBarcode,
  searchFoodByName,
  type FoodProduct,
} from '../lib/foodSearch'
import type { ItemAction } from '../lib/repo'
import type { Compartment, Fridge, Item, ItemInput } from '../lib/types'

const QUICK_EXPIRY: { label: string; value: () => string }[] = [
  { label: '오늘', value: () => addDays(0) },
  { label: '+3일', value: () => addDays(3) },
  { label: '+1주', value: () => addDays(7) },
  { label: '+2주', value: () => addDays(14) },
  { label: '+1달', value: () => addMonths(1) },
  { label: '+3달', value: () => addMonths(3) },
  { label: '+6달', value: () => addMonths(6) },
  { label: '+1년', value: () => addMonths(12) },
]

interface Props {
  fridges: Fridge[]
  compartments: Compartment[]
  /** 예전에 입력한 식품들: 이름 자동완성과 분류·단위 추천에 사용 */
  history: Item[]
  item?: Item
  defaultCompartmentId?: string
  onSave: (input: ItemInput, keepOpen: boolean) => Promise<void>
  onAction?: (item: Item, action: ItemAction) => Promise<void>
  onDelete?: (item: Item) => Promise<void>
  onClose: () => void
}

export function ItemSheet({
  fridges,
  compartments,
  history,
  item,
  defaultCompartmentId,
  onSave,
  onAction,
  onDelete,
  onClose,
}: Props) {
  const initialCompartment = item?.compartment_id ?? defaultCompartmentId ?? compartments[0]?.id ?? ''
  const [compartmentId, setCompartmentId] = useState(initialCompartment)
  const [fridgeId, setFridgeId] = useState(
    compartments.find((c) => c.id === initialCompartment)?.fridge_id ?? fridges[0]?.id ?? '',
  )
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? 'etc')
  const [quantity, setQuantity] = useState(item?.quantity ?? 1)
  const [unit, setUnit] = useState(item?.unit ?? '개')
  const [expiry, setExpiry] = useState<string | null>(item?.expiry_date ?? null)
  const [expiryType, setExpiryType] = useState(item?.expiry_type ?? 'use_by')
  const [opened, setOpened] = useState(item?.opened ?? false)
  const [memo, setMemo] = useState(item?.memo ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 식품안전나라 검색: 마지막으로 검색한 이름과 결과를 함께 들고 있어서 입력이 바뀌면 자연히 숨겨진다
  const [found, setFound] = useState<{ q: string; items: FoodProduct[] } | null>(null)
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<FoodProduct | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const canSearch = foodSearchAvailable && !item

  useEffect(() => {
    const q = name.trim()
    if (!canSearch || q.length < 2 || q === picked?.name) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const items = await searchFoodByName(q)
        if (!cancelled) setFound({ q, items })
      } catch {
        if (!cancelled) setFound({ q, items: [] })
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [name, canSearch, picked])

  const products = found && found.q === name.trim() && name.trim() !== picked?.name ? found.items.slice(0, 6) : []

  const pickProduct = (p: FoodProduct) => {
    setName(p.name)
    setCategory(guessCategory(p))
    setPicked(p)
    setScanNote(null)
  }

  const lookupBarcode = async (barcode: string) => {
    setScanning(false)
    setScanNote(`${barcode} 찾는 중…`)
    try {
      const items = await searchFoodByBarcode(barcode)
      if (items.length === 0) {
        setScanNote(`바코드 ${barcode}로는 못 찾았어요. 이름으로 검색해 주세요.`)
        nameRef.current?.focus()
        return
      }
      pickProduct(items[0])
      // 이름이 다른 후보가 더 있으면 고를 수 있게 보여준다
      if (items.length > 1) setFound({ q: '', items })
    } catch {
      setScanNote('검색 서버에 연결하지 못했어요. 이름을 직접 입력해 주세요.')
    }
  }

  const fridgeCompartments = compartments.filter((c) => c.fridge_id === fridgeId)

  const suggestions = useMemo(() => {
    const q = name.trim()
    if (!q || item) return []
    const seen = new Map<string, Item>()
    for (const h of history) if (h.name.includes(q) && h.name !== q && !seen.has(h.name)) seen.set(h.name, h)
    return [...seen.values()].slice(0, 6)
  }, [name, history, item])

  const pickSuggestion = (h: Item) => {
    setName(h.name)
    setPicked(null)
    setCategory(h.category)
    setUnit(h.unit)
    setExpiryType(h.expiry_type)
  }

  const reset = () => {
    setName('')
    setQuantity(1)
    setExpiry(null)
    setOpened(false)
    setMemo('')
    setPicked(null)
    setFound(null)
    setScanNote(null)
  }

  const save = async (keepOpen: boolean) => {
    if (!name.trim() || !compartmentId) return
    setBusy(true)
    setError(null)
    try {
      await onSave(
        {
          compartment_id: compartmentId,
          name: name.trim(),
          category,
          quantity,
          unit,
          expiry_date: expiry,
          expiry_type: expiryType,
          opened,
          memo: memo.trim() || null,
        },
        keepOpen,
      )
      if (keepOpen) reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
      active ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700'
    }`

  return (
    <Sheet title={item ? '식품 정보' : '식품 넣기'} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* 보관 위치 */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-500">어디에 넣나요?</h3>
          {fridges.length > 1 && (
            <div className="mb-2 flex gap-2">
              {fridges.map((f) => (
                <button
                  key={f.id}
                  className={chip(f.id === fridgeId)}
                  onClick={() => {
                    setFridgeId(f.id)
                    setCompartmentId(compartments.find((c) => c.fridge_id === f.id)?.id ?? '')
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {fridgeCompartments.map((c) => (
              <button
                key={c.id}
                onClick={() => setCompartmentId(c.id)}
                className={`rounded-lg border px-2 py-2 text-left text-sm ${
                  c.id === compartmentId ? 'border-sky-600 bg-sky-50 font-semibold text-sky-800' : 'border-slate-200'
                }`}
              >
                <span className="mr-1 text-xs text-slate-400">{ZONE_LABEL[c.zone]}</span>
                {c.name}
              </button>
            ))}
          </div>
        </section>

        {/* 이름 */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-500">무엇인가요?</h3>
          <div className="flex gap-2">
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 서울우유 1L, 김치, 삼겹살"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 text-base"
              autoFocus={!item}
            />
            {canSearch && (
              <button
                onClick={() => setScanning(true)}
                className="shrink-0 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700"
                aria-label="바코드 찍기"
              >
                📷 바코드
              </button>
            )}
          </div>
          {scanNote && <p className="mt-2 text-sm text-slate-500">{scanNote}</p>}
          {picked && name === picked.name && (
            <p className="mt-2 text-sm text-slate-500">
              {[picked.maker, picked.foodType].filter(Boolean).join(' · ')}
            </p>
          )}
          {(products.length > 0 || (found?.q === '' && found.items.length > 1)) && (
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {(products.length > 0 ? products : found!.items).map((p, i) => (
                <li key={`${p.reportNo ?? p.barcode}-${i}`}>
                  <button
                    onClick={() => {
                      pickProduct(p)
                      setFound(null)
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {[p.maker, p.foodType, p.shelfLifeText].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searching && products.length === 0 && <p className="mt-2 text-xs text-slate-400">식품안전나라에서 찾는 중…</p>}
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s.id} className={chip(false)} onClick={() => pickSuggestion(s)}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={chip(c.id === category)} onClick={() => setCategory(c.id)}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* 수량 */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-500">얼마나?</h3>
          <div className="flex items-center gap-2">
            <button
              className="h-11 w-11 rounded-xl border border-slate-300 text-xl"
              onClick={() => setQuantity((q) => Math.max(0, +(q - 1).toFixed(2)))}
            >
              −
            </button>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="h-11 w-20 rounded-xl border border-slate-300 text-center text-lg"
            />
            <button
              className="h-11 w-11 rounded-xl border border-slate-300 text-xl"
              onClick={() => setQuantity((q) => +(q + 1).toFixed(2))}
            >
              +
            </button>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 px-2"
            >
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <label className="ml-auto flex items-center gap-1 text-sm">
              <input type="checkbox" checked={opened} onChange={(e) => setOpened(e.target.checked)} />
              개봉함
            </label>
          </div>
        </section>

        {/* 기한 */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-500">언제까지?</h3>
            <div className="ml-auto flex rounded-lg bg-slate-100 p-0.5 text-sm">
              {(['use_by', 'sell_by'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setExpiryType(t)}
                  className={`rounded-md px-2 py-1 ${expiryType === t ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'}`}
                >
                  {t === 'use_by' ? '소비기한' : '유통기한'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={expiry ?? ''}
              onChange={(e) => setExpiry(e.target.value || null)}
              className="h-11 flex-1 rounded-xl border border-slate-300 px-3"
            />
            <span className="w-20 text-center text-sm font-semibold text-slate-600">{dDayLabel(expiry)}</span>
          </div>
          {picked?.shelfLifeDays && name === picked.name && (
            <button
              className="mt-2 w-full rounded-lg bg-amber-50 px-3 py-2 text-left text-sm text-amber-800"
              onClick={() => setExpiry(addDays(picked.shelfLifeDays!))}
            >
              제품 기준 "{picked.shelfLifeText}" → 오늘부터 {picked.shelfLifeDays}일로 넣기
              <span className="block text-xs text-amber-700/80">제조일 기준이라 실제보다 길 수 있어요. 포장에 찍힌 날짜가 정확해요.</span>
            </button>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_EXPIRY.map((q) => (
              <button key={q.label} className={chip(false)} onClick={() => setExpiry(q.value())}>
                {q.label}
              </button>
            ))}
            <button className={chip(expiry === null)} onClick={() => setExpiry(null)}>
              기한 없음
            </button>
          </div>
        </section>

        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          className="rounded-xl border border-slate-300 px-3 py-3"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          {!item && (
            <button
              disabled={busy || !name.trim()}
              onClick={() => save(true)}
              className="flex-1 rounded-xl border border-sky-600 py-3 font-semibold text-sky-700 disabled:opacity-40"
            >
              저장하고 계속 넣기
            </button>
          )}
          <button
            disabled={busy || !name.trim()}
            onClick={() => save(false)}
            className="flex-1 rounded-xl bg-sky-600 py-3 font-semibold text-white disabled:opacity-40"
          >
            저장
          </button>
        </div>

        {item && onAction && onDelete && (
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
            <button
              disabled={busy}
              onClick={() => run(() => onAction(item, 'consume'))}
              className="rounded-xl bg-emerald-50 py-3 font-semibold text-emerald-700"
            >
              다 먹었어요
            </button>
            <button
              disabled={busy}
              onClick={() => run(() => onAction(item, 'discard'))}
              className="rounded-xl bg-orange-50 py-3 font-semibold text-orange-700"
            >
              버렸어요
            </button>
            <button
              disabled={busy}
              onClick={() => confirm(`'${item.name}'을(를) 기록에서 지울까요?`) && run(() => onDelete(item))}
              className="rounded-xl bg-slate-100 py-3 font-semibold text-slate-600"
            >
              삭제
            </button>
          </div>
        )}
      </div>
      {scanning && <BarcodeScanner onDetected={lookupBarcode} onClose={() => setScanning(false)} />}
    </Sheet>
  )
}
