import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { categoryOf } from '../lib/categories'
import { emojiOfItem } from '../lib/foodLook'
import { daysLeft, expiryLevel, LEVEL_TEXT } from '../lib/expiry'
import type { ItemAction } from '../lib/repo'
import type { Item } from '../lib/types'
import { cx } from '../lib/cx'
import { PlannedChip } from './PlannedChip'
import { Card } from './ui'

/** 사람에게 하는 말로: 오늘까지 먹어야 해요, 2일 지났어요 */
function deadlineSentence(i: Item) {
  const d = daysLeft(i.expiry_date) ?? 0
  if (d < 0) return `${-d}일 지났어요`
  if (d === 0) return '오늘까지 먹어야 해요'
  if (d === 1) return '내일까지 먹어야 해요'
  return `${d}일 안에 먹어야 해요`
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

/** 재고 화면 오늘 식단표 아래: 지금 챙길 식품을 급한 순 목록으로. 기한 지난 것은 그 아래 따로 */
export function TodayFocus({ due, expired, next, locationOf, onOpen, onAct }: Props) {
  const [moreDue, setMoreDue] = useState(false)
  const [moreExpired, setMoreExpired] = useState(false)

  const restDue = due
  const expiredList = expired

  if (!due.length && !expired.length) {
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
      <h2 className="flex items-baseline gap-1.5 px-1 text-[15px] font-extrabold">
        지금 챙길 식품
        <span className="tabular text-sm font-semibold text-faint">{due.length + expired.length}</span>
      </h2>

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
    <li className="flex flex-wrap items-center gap-x-3 px-3.5 py-3">
      <button onClick={() => onOpen(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[22px]"
          style={{ backgroundColor: cat.tint }}
          aria-hidden
        >
          {emojiOfItem(i, cat.emoji)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold">{i.name}</span>
          <span className={cx('block truncate text-[13px] font-bold', LEVEL_TEXT[lv])}>{deadlineSentence(i)}</span>
          <span className="block truncate text-xs text-muted">{location}</span>
        </span>
      </button>
      <span className="flex shrink-0 gap-1.5 sm:gap-2">{children}</span>
      <div className="basis-full pt-1 pl-14 empty:hidden">
        <PlannedChip itemId={i.id} />
      </div>
    </li>
  )
}

function QuickButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="h-9 sm:h-11 shrink-0 rounded-xl bg-sunken px-2.5 text-xs font-bold text-ink transition active:brightness-95"
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
