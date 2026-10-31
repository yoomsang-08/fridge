import { ChevronDown, ScanBarcode } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BarcodeScanner } from './BarcodeScanner'
import { useDialog } from './Dialog'
import { Sheet } from './Sheet'
import { cx } from '../lib/cx'
import { Button, Chip, Field, IconButton, Segmented, TextInput } from './ui'
import { CONTAINERS, UNITS, useCategories } from '../lib/categories'
import { addDays, addMonths, expiryLabel, expiryLevel, LEVEL_STYLE } from '../lib/expiry'
import {
  foodSearchAvailable,
  guessCategory,
  searchFoodByBarcode,
  searchFoodByName,
  type FoodProduct,
} from '../lib/foodSearch'
import { ZONE_LABEL } from '../lib/templates'
import type { ItemAction } from '../lib/repo'
import type { Compartment, Container, Fridge, Item, ItemInput, Member } from '../lib/types'

const QUICK_VISIBLE = 5

const QUICK_EXPIRY: { label: string; value: () => string }[] = [
  { label: '오늘', value: () => addDays(0) },
  { label: '+3일', value: () => addDays(3) },
  { label: '+1주', value: () => addDays(7) },
  { label: '+2주', value: () => addDays(14) },
  { label: '+1달', value: () => addMonths(1) },
  // 아래는 '더보기' 를 눌러야 보인다
  { label: '+3달', value: () => addMonths(3) },
  { label: '+6달', value: () => addMonths(6) },
  { label: '+1년', value: () => addMonths(12) },
]

const EASTER_NAMES = new Set(['송지선', '지선'])

/** "제조일로부터 12개월까지" → "12개월" */
function shortShelfLife(text: string | null, days: number): string {
  return text?.replace(/\s+/g, '').match(/\d+(?:\.\d+)?(년|개월|주|일)/)?.[0] ?? `${days}일`
}

interface Props {
  fridges: Fridge[]
  compartments: Compartment[]
  /** 예전에 입력한 식품들: 이름 자동완성과 분류·단위 추천에 사용 */
  history: Item[]
  /** 우리 집 식구: '누가 넣었는지' 표시용 */
  members?: Member[]
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
  members = [],
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
  const [container, setContainer] = useState<Container | null>(item?.container ?? null)
  const categories = useCategories().filter((c) => !c.hidden || c.id === item?.category)
  const [expiry, setExpiry] = useState<string | null>(item?.expiry_date ?? null)
  const [expiryType, setExpiryType] = useState(item?.expiry_type ?? 'use_by')
  const [opened, setOpened] = useState(item?.opened ?? false)
  const [memo, setMemo] = useState(item?.memo ?? '')
  const [moreExpiry, setMoreExpiry] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 식품안전나라 검색: 마지막으로 검색한 이름과 결과를 함께 들고 있어서 입력이 바뀌면 자연히 숨겨진다
  const [found, setFound] = useState<{ q: string; items: FoodProduct[]; failed?: boolean } | null>(null)
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<FoodProduct | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const [nameFocused, setNameFocused] = useState(!item)
  // 이스터에그 한 줄. 3초 뒤 저절로 사라진다 (docs/design.md 이스터에그 절)
  const [egg, setEgg] = useState<string | null>(null)
  const eggTimer = useRef(0)
  const eggShown = useRef(new Set<string>())
  // 같은 문구는 시트를 열 때마다 한 번만
  const showEgg = (text: string) => {
    if (eggShown.current.has(text)) return
    eggShown.current.add(text)
    setEgg(text)
    window.clearTimeout(eggTimer.current)
    eggTimer.current = window.setTimeout(() => setEgg(null), 3000)
  }
  useEffect(() => () => window.clearTimeout(eggTimer.current), [])
  const canSearch = foodSearchAvailable && !item

  const { confirm, dialog } = useDialog()
  const fridgeCompartments = compartments.filter((c) => c.fridge_id === fridgeId)

  const suggestions = useMemo(() => {
    const q = name.trim()
    if (!q || item) return []
    const seen = new Map<string, Item>()
    for (const h of history) if (h.name.includes(q) && h.name !== q && !seen.has(h.name)) seen.set(h.name, h)
    return [...seen.values()].slice(0, 6)
  }, [name, history, item])

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
        if (!cancelled) setFound({ q, items: [], failed: true })
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [name, canSearch, picked])

  // 바코드로 찾은 후보는 q 가 '' 로 들어온다
  const fresh = !!found && found.q !== '' && found.q === name.trim() && name.trim() !== picked?.name
  const products = !found
    ? []
    : found.q === ''
      ? found.items.length > 1
        ? found.items.slice(0, 5)
        : []
      : fresh && nameFocused
        ? found.items.slice(0, 5)
        : []
  // 후보 자리에 한 줄로 보여주는 검색 상태
  const searchStatus = searching
    ? '찾는 중…'
    : fresh && found!.failed
      ? '검색이 잠시 안 돼요. 직접 입력해 주세요.'
      : fresh && found!.items.length === 0
        ? '못 찾았어요. 이 이름 그대로 저장돼요.'
        : null
  const shelfDays = picked && name === picked.name ? picked.shelfLifeDays : null
  const shelfDate = shelfDays ? addDays(shelfDays) : null

  const pickProduct = (p: FoodProduct) => {
    setName(p.name)
    setCategory(guessCategory(p))
    setPicked(p)
    setScanNote(null)
    // 팀 이름이 써니사이드업이라 달걀은 그냥 못 지나친다
    if (guessCategory(p) === 'egg') showEgg('써니사이드업 재료 확보!')
  }

  const lookupBarcode = async (barcode: string) => {
    setScanning(false)
    setScanNote(`${barcode} 찾는 중…`)
    try {
      const items = await searchFoodByBarcode(barcode)
      if (items.length === 0) {
        setScanNote(`바코드 ${barcode}로는 못 찾았어요. 이름으로 검색해 주세요.`)
        document.getElementById('item-name')?.focus()
        return
      }
      pickProduct(items[0])
      // 이름이 다른 후보가 더 있으면 고를 수 있게 보여준다
      if (items.length > 1) setFound({ q: '', items })
    } catch {
      setScanNote('검색 서버에 연결하지 못했어요. 이름을 직접 입력해 주세요.')
    }
  }

  const pickSuggestion = (h: Item) => {
    setName(h.name)
    setPicked(null)
    setCategory(h.category)
    setUnit(h.unit)
    setExpiryType(h.expiry_type)
  }

  // 식품안전나라에서 고른 이름 그대로면 원본 정보도 남긴다 (나중에 일괄 재분류 근거)
  const fromProduct = picked && name.trim() === picked.name ? picked : null
  /** 새 칸은 값이 있을 때만 보낸다: 0007 마이그레이션 전에도 기본 저장은 되도록 */
  const productFields = (): Partial<ItemInput> => {
    const f: Partial<ItemInput> = {}
    if (container || item?.container) f.container = container
    if (fromProduct?.foodType) f.food_type = fromProduct.foodType
    if (fromProduct?.barcode) f.barcode = fromProduct.barcode
    return f
  }

  const reset = () => {
    setName('')
    setQuantity(1)
    setExpiry(null)
    setOpened(false)
    setContainer(null)
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
          ...productFields(),
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

  const canSave = !busy && !!name.trim() && !!compartmentId
  const lv = expiryLevel(expiry)

  return (
    <>
      <Sheet
        title={item ? '식품 정보' : '식품 넣기'}
        onClose={onClose}
        footer={
          <>
            {!item && (
              <Button variant="secondary" className="flex-1" disabled={!canSave} onClick={() => save(true)}>
                저장하고 계속
              </Button>
            )}
            <Button className="flex-[1.2]" disabled={!canSave} onClick={() => save(false)}>
              저장
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <Field label="무엇인가요?">
            <div className="relative flex gap-2">
              {/* 아래 칩이 밀리지 않도록 입력창 아래에 겹쳐 띄운다. 누름은 통과 */}
              {egg && (
                <p className="pointer-events-none absolute top-full left-0 z-10 mt-1.5 rounded-xl bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent shadow-card">
                  {egg}
                </p>
              )}
              <TextInput
                id="item-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (EASTER_NAMES.has(e.target.value.trim())) showEgg('이 냉장고의 주인공이시네요. 오늘도 맛있는 하루 보내세요.')
                }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                placeholder="예: 서울우유 1L, 김치, 삼겹살"
                className="min-w-0 flex-1 font-semibold"
                autoFocus={!item}
                enterKeyHint="done"
              />
              {canSearch && (
                <IconButton
                  className="h-12 w-12 rounded-2xl border border-line bg-surface text-ink"
                  onClick={() => setScanning(true)}
                  aria-label="바코드 찍기"
                >
                  <ScanBarcode size={22} strokeWidth={2.2} />
                </IconButton>
              )}
            </div>
            {scanNote && <p className="mt-2 text-sm text-muted">{scanNote}</p>}
            {picked && name === picked.name && (picked.maker || picked.foodType) && (
              <p className="mt-2 text-[13px] text-muted">{[picked.maker, picked.foodType].filter(Boolean).join(' · ')}</p>
            )}
            {products.length > 0 && (
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {products.map((p, i) => (
                  <li key={`${p.reportNo ?? p.barcode}-${i}`}>
                    <button
                      // 입력창 blur 로 목록이 닫히기 전에 고를 수 있게
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        pickProduct(p)
                        setFound(null)
                      }}
                      className="w-full px-4 py-2.5 text-left transition active:bg-sunken"
                    >
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="mt-0.5 text-xs text-muted">
                        {[p.maker, p.foodType, p.shelfLifeText].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searchStatus && products.length === 0 && nameFocused && (
              <p className="mt-2 text-xs text-muted">{searchStatus}</p>
            )}
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <Chip key={s.id} tone="suggest" onClick={() => pickSuggestion(s)}>
                    {s.name}
                  </Chip>
                ))}
              </div>
            )}
            <div className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {categories.map((c) => (
                <Chip key={c.id} active={c.id === category} onClick={() => setCategory(c.id)}>
                  <span aria-hidden>{c.emoji}</span> {c.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field
            label="어디에 넣나요?"
            aside={
              fridges.length > 1 && (
                <Segmented
                  value={fridgeId}
                  onChange={(id) => {
                    setFridgeId(id)
                    setCompartmentId(compartments.find((c) => c.fridge_id === id)?.id ?? '')
                  }}
                  options={fridges.map((f) => [f.id, f.name] as const)}
                />
              )
            }
          >
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {fridgeCompartments.map((c) => {
                const on = c.id === compartmentId
                return (
                  <button
                    key={c.id}
                    onClick={() => setCompartmentId(c.id)}
                    aria-pressed={on}
                    className={cx(
                      'flex min-h-12 flex-col justify-center rounded-xl border px-3 py-1.5 text-left text-sm font-semibold transition',
                      on
                        ? 'border-accent bg-accent-soft text-accent ring-1 ring-accent'
                        : 'border-line active:bg-sunken',
                    )}
                  >
                    <span className={cx('text-[10px] font-semibold', on ? 'text-accent' : 'text-muted')}>
                      {ZONE_LABEL[c.zone]}
                    </span>
                    <span className="truncate">{c.name}</span>
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="얼마나?">
            <div className="flex items-center gap-1.5">
              <button
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sunken text-2xl font-medium active:brightness-95"
                onClick={() => setQuantity((q) => Math.max(0, +(q - 1).toFixed(2)))}
                aria-label="하나 빼기"
              >
                −
              </button>
              <input
                id="item-quantity"
                type="number"
                inputMode="decimal"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="tabular h-12 w-16 rounded-xl bg-transparent text-center text-xl font-extrabold outline-none focus:bg-sunken"
              />
              <button
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sunken text-2xl font-medium active:brightness-95"
                onClick={() => setQuantity((q) => +(q + 1).toFixed(2))}
                aria-label="하나 더하기"
              >
                +
              </button>
              <label className="relative ml-1">
                <select
                  id="item-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="h-12 appearance-none rounded-xl border border-line bg-surface pr-8 pl-3 text-base font-semibold"
                >
                  {UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted"
                />
              </label>
              <Chip
                active={opened}
                className="ml-auto h-12 rounded-xl"
                onClick={() => setOpened(!opened)}
                aria-pressed={opened}
              >
                개봉함
              </Chip>
            </div>
            <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {CONTAINERS.map((c) => (
                <Chip
                  key={c.id}
                  active={c.id === container}
                  aria-pressed={c.id === container}
                  onClick={() => setContainer(c.id === container ? null : c.id)}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field
            label="언제까지?"
            aside={
              <Segmented
                value={expiryType}
                onChange={setExpiryType}
                options={[
                  ['use_by', '소비기한'],
                  ['sell_by', '유통기한'],
                ]}
              />
            }
          >
            <label className="flex h-14 items-center gap-3 rounded-2xl bg-sunken/70 pr-3 pl-4 focus-within:ring-4 focus-within:ring-accent-soft">
              <input
                id="item-expiry"
                type="date"
                value={expiry ?? ''}
                onChange={(e) => setExpiry(e.target.value || null)}
                className="tabular min-w-0 flex-1 bg-transparent text-base font-bold outline-none"
              />
              <span className={cx('tabular shrink-0 rounded-lg px-2 py-1 text-[13px] font-extrabold', LEVEL_STYLE[lv])}>
                {expiryLabel(expiry)}
              </span>
            </label>
            {shelfDate && expiry !== shelfDate && (
              <div className="mt-2">
                <Chip tone="suggest" onClick={() => setExpiry(shelfDate)}>
                  제품 기준 {shortShelfLife(picked!.shelfLifeText, shelfDays!)} · 날짜 넣기
                </Chip>
                <p className="mt-1 text-xs text-faint">
                  {picked!.shelfLifeText}. 제조일 기준이라 실제보다 길 수 있어요. 포장에 찍힌 날짜가 정확해요.
                </p>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(moreExpiry ? QUICK_EXPIRY : QUICK_EXPIRY.slice(0, QUICK_VISIBLE)).map((q) => {
                const v = q.value()
                return (
                  <Chip key={q.label} active={expiry === v} onClick={() => setExpiry(v)}>
                    {q.label}
                  </Chip>
                )
              })}
              {!moreExpiry && (
                <Chip className="text-muted" onClick={() => setMoreExpiry(true)}>
                  더보기
                </Chip>
              )}
              <Chip active={expiry === null} onClick={() => setExpiry(null)}>
                기한 없음
              </Chip>
            </div>
          </Field>

          <Field label="메모">
            <TextInput id="item-memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="선택 사항" />
          </Field>

          {error && <p className="rounded-xl bg-expired-soft p-3 text-sm text-expired">{error}</p>}

          {item && <AddedBy item={item} members={members} />}

          {item && onAction && onDelete && (
            <div className="grid grid-cols-3 gap-2 border-t border-line pt-5">
              <Button
                variant="secondary"
                size="md"
                disabled={busy}
                onClick={() => run(() => onAction(item, 'consume'))}
              >
                다 먹었어요
              </Button>
              <Button variant="ghost" size="md" disabled={busy} onClick={() => run(() => onAction(item, 'discard'))}>
                버렸어요
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={busy}
                onClick={async () => {
                  if (await confirm('기록에서 지울까요?', `'${item.name}'을(를) 먹은 기록 없이 완전히 지워요.`))
                    run(() => onDelete(item))
                }}
              >
                삭제
              </Button>
            </div>
          )}
        </div>
      </Sheet>
      {dialog}
      {scanning && <BarcodeScanner onDetected={lookupBarcode} onClose={() => setScanning(false)} />}
    </>
  )
}

/** "민상 님이 10월 31일에 넣었어요" */
function AddedBy({ item, members }: { item: Item; members: Member[] }) {
  const who = members.find((m) => m.id === item.created_by)?.name
  const d = new Date(item.created_at)
  const when = `${d.getMonth() + 1}월 ${d.getDate()}일`
  return (
    <p className="tabular -mb-2 text-xs text-muted">{who ? `${who} 님이 ${when}에 넣었어요` : `${when}에 넣었어요`}</p>
  )
}
