import { Check, ShoppingCart, X } from 'lucide-react'
import { useState } from 'react'
import { eggToast } from '../lib/eggToast'
import { haveSummary, splitNameQty } from '../lib/shopping'
import { showToast } from '../lib/toast'
import { cx } from '../lib/cx'
import type { Item, ShoppingItem } from '../lib/types'
import { Button, Card, TextInput } from './ui'

interface Props {
  list: ShoppingItem[]
  items: Item[]
  onAdd: (name: string, qty?: string) => Promise<void>
  onCheck: (id: string, checked: boolean) => Promise<void>
  onRemove: (ids: string[]) => Promise<void>
  /** 뺀 줄 되살리기 (토스트의 '되돌리기') */
  onRestore: (list: ShoppingItem[]) => Promise<void>
  /** 체크한 것을 식품 넣기 시트로 연달아 연다 */
  onStock: (checked: ShoppingItem[]) => void
  onOpenItem: (item: Item) => void
  /** 태블릿 가로: 메모 보드 옆 패널로 놓일 때 (제목 작게, 폭은 패널에 맞춤) */
  panel?: boolean
}

/** 메모 탭 > 장보기: 냉장고 문에 붙여 두는 장보기 쪽지 */
export function ShoppingList({ list, items, onAdd, onCheck, onRemove, onRestore, onStock, onOpenItem, panel }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const todo = list.filter((s) => !s.checked)
  const done = list.filter((s) => s.checked)

  const add = async () => {
    const { name, qty } = splitNameQty(text)
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      await onAdd(name, qty)
      setText('')
      if (name.includes('아이스크림')) eggToast('지선 님 아이스크림 지킴이 출동')
    } catch {
      setError('담지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const check = async (s: ShoppingItem) => {
    setError(null)
    try {
      await onCheck(s.id, !s.checked)
    } catch {
      setError('바꾸지 못했어요. 잠시 뒤 다시 해 주세요.')
      return
    }
    // 마지막 하나까지 다 체크하면 (이스터에그)
    if (!s.checked && todo.length === 1 && list.length >= 2) eggToast('장보기 끝! 오늘도 수고했어요, 지선 님')
  }

  const remove = async (id: string) => {
    setError(null)
    try {
      const gone = list.find((x) => x.id === id)
      await onRemove([id])
      if (gone)
        showToast(`${gone.name} 뺐어요`, {
          label: '되돌리기',
          onClick: () => void onRestore([gone]).catch(() => setError('되돌리지 못했어요. 다시 담아 주세요.')),
        })
    } catch {
      setError('빼지 못했어요. 잠시 뒤 다시 해 주세요.')
    }
  }

  return (
    <div className={cx('flex flex-col gap-4', panel ? 'w-full' : 'mx-auto max-w-reading')}>
      <div>
        <h2 className={cx('font-extrabold tracking-tight', panel ? 'text-xl' : 'text-2xl')}>장보기</h2>
        <p className="mt-0.5 text-sm text-muted">
          {list.length === 0 ? '냉장고를 확인하고, 살 것을 적어 두세요.' : `안 산 것 ${todo.length}개 · 식구 모두 같이 봐요`}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex gap-2"
      >
        <TextInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="무엇을 살까요? (예: 우유 2통)"
          maxLength={60}
          enterKeyHint="done"
          aria-label="살 것 이름"
        />
        <Button type="submit" className="shrink-0" disabled={!text.trim() || busy}>
          담기
        </Button>
      </form>

      {error && (
        <p role="alert" className="rounded-2xl bg-expired-soft p-3 text-sm text-expired">
          {error}
        </p>
      )}

      {list.length === 0 && (
        <Card className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <ShoppingCart size={28} strokeWidth={2} className="text-faint" />
          <p className="text-sm text-muted">장볼 게 없어요. 살 것이 생각나면 위에 적어 보세요.</p>
        </Card>
      )}

      {todo.length > 0 && (
        <Card className="divide-y divide-line overflow-hidden">
          {todo.map((s) => (
            <Row key={s.id} s={s} items={items} onCheck={() => check(s)} onRemove={() => remove(s.id)} onOpenItem={onOpenItem} />
          ))}
        </Card>
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold text-muted">산 것 {done.length}개</h3>
            <Button variant="secondary" size="md" onClick={() => onStock(done)}>
              사 온 것 재고에 넣기 ({done.length})
            </Button>
          </div>
          <Card className="divide-y divide-line overflow-hidden">
            {done.map((s) => (
              <Row key={s.id} s={s} items={items} onCheck={() => check(s)} onRemove={() => remove(s.id)} onOpenItem={onOpenItem} />
            ))}
          </Card>
          <p className="text-xs text-muted">세제·휴지처럼 재고에 안 넣을 것은 오른쪽 ×로 빼 주세요.</p>
        </section>
      )}
    </div>
  )
}

function Row({
  s,
  items,
  onCheck,
  onRemove,
  onOpenItem,
}: {
  s: ShoppingItem
  items: Item[]
  onCheck: () => void
  onRemove: () => void
  onOpenItem: (item: Item) => void
}) {
  // 산 것은 이미 사 왔으니 '이미 있어요' 안내는 안 산 것에만
  const have = s.checked ? null : haveSummary(s.name, items)
  const who = s.checked ? (s.checked_by ? `${s.checked_by}님이 샀어요` : null) : s.added_by ? `${s.added_by}님이 담음` : null
  return (
    <div className="flex items-center gap-1 pr-1 pl-1">
      <button
        onClick={onCheck}
        role="checkbox"
        aria-checked={s.checked}
        aria-label={`${s.name} ${s.checked ? '체크 해제' : '샀어요'}`}
        className="grid h-11 w-11 shrink-0 place-items-center"
      >
        <span
          className={cx(
            'grid h-6 w-6 place-items-center rounded-md border-2 transition',
            s.checked ? 'border-accent bg-accent text-white' : 'border-faint bg-surface',
          )}
        >
          {s.checked && <Check size={16} strokeWidth={3} />}
        </span>
      </button>
      <div className="min-w-0 flex-1 py-2">
        <div className={cx('flex items-baseline gap-2', s.checked && 'text-faint')}>
          <span className={cx('min-w-0 truncate text-[15px] font-bold', s.checked && 'line-through')}>{s.name}</span>
          {s.qty && <span className="shrink-0 text-sm tabular-nums">{s.qty}</span>}
        </div>
        {s.source_note && <p className="truncate text-xs text-muted">{s.source_note}</p>}
        {who && <p className="truncate text-xs text-muted">{who}</p>}
        {have && (
          <button
            onClick={() => onOpenItem(have.first)}
            className="mt-1 inline-flex min-h-9 max-w-full items-center rounded-2xl bg-accent-soft px-2.5 py-1 text-left text-xs font-semibold break-keep text-accent sm:min-h-11"
          >
            <span>
              냉장고에 이미 {have.prefix}
              {have.amount} 있어요{have.count > 1 ? ` · ${have.count}곳 합계` : ''}
            </span>
          </button>
        )}
      </div>
      <button
        onClick={onRemove}
        aria-label={`${s.name} 빼기`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-faint transition active:bg-sunken"
      >
        <X size={18} strokeWidth={2.2} />
      </button>
    </div>
  )
}
