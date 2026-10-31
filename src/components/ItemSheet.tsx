import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDialog } from './Dialog'
import { Sheet } from './Sheet'
import { cx } from '../lib/cx'
import { Button, Chip, Field, Segmented, TextInput } from './ui'
import { CATEGORIES, UNITS } from '../lib/categories'
import { addDays, addMonths, expiryLabel, expiryLevel, LEVEL_STYLE } from '../lib/expiry'
import { ZONE_LABEL } from '../lib/templates'
import type { ItemAction } from '../lib/repo'
import type { Compartment, Fridge, Item, ItemInput } from '../lib/types'

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
  const [moreExpiry, setMoreExpiry] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { confirm, dialog } = useDialog()
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
            <TextInput
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 서울우유 1L, 김치, 삼겹살"
              className="font-semibold"
              autoFocus={!item}
              enterKeyHint="done"
            />
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
              {CATEGORIES.map((c) => (
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
    </>
  )
}
