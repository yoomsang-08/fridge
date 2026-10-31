import { categoryOf } from '../lib/categories'
import { expiryLabel, expiryLevel, LEVEL_TEXT } from '../lib/expiry'
import type { Item } from '../lib/types'
import { cx } from '../lib/cx'

/** 목록 한 줄: 분류 타일 · 이름과 수량(·위치) · 기한 문구 · 빠른 사용 버튼. 재고 목록과 냉장고 보기에서 같이 쓴다 */
export function ItemRow({
  item: i,
  location,
  onOpen,
  onUseOne,
}: {
  item: Item
  /** 있으면 수량 뒤에 붙인다 */
  location?: string
  onOpen: (item: Item) => void
  onUseOne: (item: Item) => void
}) {
  const lv = expiryLevel(i.expiry_date)
  const cat = categoryOf(i.category)
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
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
            {location && ` · ${location}`}
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
