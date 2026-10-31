import { ChevronDown, MapPin } from 'lucide-react'
import { useState } from 'react'
import { categoryOf } from '../lib/categories'
import { daysLeft, expiryLevel, LEVEL_TEXT } from '../lib/expiry'
import type { ItemAction } from '../lib/repo'
import type { Item } from '../lib/types'
import { cx } from '../lib/cx'
import { Button, Card } from './ui'

/** 사람에게 하는 말로: 오늘까지 먹어야 해요, 2일 지났어요 */
function deadlineSentence(i: Item) {
  const d = daysLeft(i.expiry_date) ?? 0
  if (d < 0) return `${-d}일 지났어요`
  if (d === 0) return '오늘까지 먹어야 해요'
  if (d === 1) return '내일까지 먹어야 해요'
  return `${d}일 안에 먹어야 해요`
}

const dateText = (i: Item) => {
  if (!i.expiry_date) return ''
  const [, m, d] = i.expiry_date.split('-').map(Number)
  return `${m}월 ${d}일 ${i.expiry_type === 'use_by' ? '소비기한' : '유통기한'}`
}

const VISIBLE = 3

interface Props {
  /** 3일 안에 먹어야 하는 식품, 급한 순 */
  due: Item[]
  /** 기한 지난 식품, 오래된 순 */
  expired: Item[]
  /** 급한 게 없을 때 '다음 차례'로 보여 줄 식품 */
  next?: Item
  locationOf: (i: Item) => string
  onOpen: (item: Item) => void
  onAct: (item: Item, action: ItemAction) => void
}

/** 재고 화면 맨 위: 지금 해야 할 일을 크게. 제일 급한 하나 → 나머지 급한 것 → 기한 지난 것 */
export function TodayFocus({ due, expired, next, locationOf, onOpen, onAct }: Props) {
  const [moreDue, setMoreDue] = useState(false)
  const [moreExpired, setMoreExpired] = useState(false)

  // 먹을 수 있는 것부터. 다 지났으면 지난 것 중 하나를 크게
  const [hero, ...restDue] = due.length ? due : expired
  const expiredList = due.length ? expired : expired.slice(1)

  if (!hero) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl" aria-hidden>
          👍
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-extrabold">오늘 급한 식품은 없어요</p>
          <p className="truncate text-[13px] text-muted">
            {next
              ? `다음 차례는 ${next.name}, ${daysLeft(next.expiry_date)}일 남았어요`
              : '3일 안에 기한이 끝나는 식품이 없어요'}
          </p>
        </div>
      </Card>
    )
  }

  const shownDue = moreDue ? restDue : restDue.slice(0, VISIBLE)
  const shownExpired = moreExpired ? expiredList : expiredList.slice(0, VISIBLE)

  return (
    <section className="flex flex-col gap-2.5" aria-label="오늘 챙길 식품">
      <h2 className="px-1 text-[15px] font-extrabold">지금 챙길 식품</h2>
      <Hero item={hero} location={locationOf(hero)} onOpen={onOpen} onAct={onAct} />

      {shownDue.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {shownDue.map((i) => (
              <FocusRow key={i.id} item={i} location={locationOf(i)} onOpen={onOpen}>
                <QuickButton onClick={() => onAct(i, 'consume')}>다 먹었어요</QuickButton>
              </FocusRow>
            ))}
          </ul>
          {restDue.length > VISIBLE && (
            <MoreButton open={moreDue} rest={restDue.length - VISIBLE} onClick={() => setMoreDue(!moreDue)} />
          )}
        </Card>
      )}

      {shownExpired.length > 0 && (
        <>
          <h3 className="mt-1 flex items-baseline gap-1.5 px-1 text-[13px] font-bold text-expired">
            기한 지난 식품
            <span className="tabular">{expiredList.length}</span>
            <span className="font-medium text-muted">· 버리거나 상태를 확인해 주세요</span>
          </h3>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {shownExpired.map((i) => (
                <FocusRow key={i.id} item={i} location={locationOf(i)} onOpen={onOpen}>
                  <QuickButton onClick={() => onAct(i, 'discard')}>버렸어요</QuickButton>
                  <QuickButton onClick={() => onOpen(i)}>확인하기</QuickButton>
                </FocusRow>
              ))}
            </ul>
            {expiredList.length > VISIBLE && (
              <MoreButton
                open={moreExpired}
                rest={expiredList.length - VISIBLE}
                onClick={() => setMoreExpired(!moreExpired)}
              />
            )}
          </Card>
        </>
      )}
    </section>
  )
}

/** 제일 급한 하나: 무엇을, 언제까지, 어디에 — 세 줄이면 바로 알 수 있게 */
function Hero({
  item: i,
  location,
  onOpen,
  onAct,
}: {
  item: Item
  location: string
  onOpen: (item: Item) => void
  onAct: (item: Item, action: ItemAction) => void
}) {
  const cat = categoryOf(i.category)
  const lv = expiryLevel(i.expiry_date)
  const expired = lv === 'expired'
  const many = i.quantity > 1
  return (
    <Card className={cx('overflow-hidden ring-2', expired ? 'ring-expired/30' : 'ring-urgent/30')}>
      <button onClick={() => onOpen(i)} className="flex w-full items-center gap-3.5 p-4 pb-3 text-left">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-[34px]"
          style={{ backgroundColor: cat.tint }}
          aria-hidden
        >
          {cat.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[24px] leading-tight font-extrabold">{i.name}</span>
          <span className="tabular mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted">
            <MapPin size={13} className="shrink-0" strokeWidth={2.2} />
            <span className="truncate">
              {location} · {i.quantity}
              {i.unit}
              {i.opened && ' · 개봉'}
            </span>
          </span>
        </span>
      </button>
      <div className={cx('mx-4 rounded-xl px-3.5 py-2.5', expired ? 'bg-expired-soft' : 'bg-urgent-soft')}>
        <p className={cx('text-[19px] leading-snug font-extrabold', LEVEL_TEXT[lv])}>{deadlineSentence(i)}</p>
        <p className="tabular text-xs text-muted">{dateText(i)}</p>
      </div>
      <div className={cx('grid gap-2 p-4 pt-3', many ? 'grid-cols-2' : 'grid-cols-1')}>
        {expired ? (
          <>
            <Button size="md" variant="secondary" onClick={() => onAct(i, 'discard')}>
              버렸어요
            </Button>
            <Button size="md" variant="secondary" onClick={() => onOpen(i)}>
              확인하기
            </Button>
          </>
        ) : (
          <>
            {many && (
              <Button size="md" variant="secondary" onClick={() => onAct(i, 'use')}>
                1{i.unit} 썼어요
              </Button>
            )}
            <Button size="md" onClick={() => onAct(i, 'consume')}>
              다 먹었어요
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}

function FocusRow({
  item: i,
  location,
  onOpen,
  children,
}: {
  item: Item
  location: string
  onOpen: (item: Item) => void
  children: React.ReactNode
}) {
  const cat = categoryOf(i.category)
  const lv = expiryLevel(i.expiry_date)
  return (
    <li className="flex items-center gap-3 px-3.5 py-3">
      <button onClick={() => onOpen(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[22px]"
          style={{ backgroundColor: cat.tint }}
          aria-hidden
        >
          {cat.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold">{i.name}</span>
          <span className={cx('block truncate text-[13px] font-bold', LEVEL_TEXT[lv])}>{deadlineSentence(i)}</span>
          <span className="block truncate text-xs text-muted">{location}</span>
        </span>
      </button>
      <span className="flex shrink-0 gap-1.5">{children}</span>
    </li>
  )
}

function QuickButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="h-9 shrink-0 rounded-xl bg-sunken px-2.5 text-xs font-bold text-ink transition active:brightness-95"
    />
  )
}

function MoreButton({ open, rest, onClick }: { open: boolean; rest: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      className="flex h-11 w-full items-center justify-center gap-1 border-t border-line text-[13px] font-semibold text-muted"
    >
      {open ? '접기' : `${rest}개 더 보기`}
      <ChevronDown size={15} className={cx('transition', open && 'rotate-180')} />
    </button>
  )
}
