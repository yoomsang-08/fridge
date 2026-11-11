import { Utensils } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MEAL_LABEL, hasEgg, plannedDayText } from '../lib/meals'
import { usePlannedUses } from '../lib/plannedUse'
import { SunnyEgg } from './ui'

/**
 * 식단표에서 쓰기로 한 식품에 붙는 '사용예정' 칩. 누르면(마우스는 올려도) 언제 어떤 메뉴인지 작은 창으로 보여 준다.
 * 폰·아이패드는 탭으로 열고 닫는다. 다른 곳을 누르거나 스크롤하면 닫힌다. 식단이 없으면 아무것도 그리지 않는다
 */
export function PlannedChip({ itemId, className }: { itemId: string; className?: string }) {
  const uses = usePlannedUses(itemId)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return
    const r = btn.current.getBoundingClientRect()
    const w = pop.current.offsetWidth
    const h = pop.current.offsetHeight
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
    // 아래에 자리가 모자라면 위로
    const top = r.bottom + 6 + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6
    setPos({ left, top })
  }, [open, uses])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const down = (e: Event) => {
      const t = e.target as Node
      if (!btn.current?.contains(t) && !pop.current?.contains(t)) close()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (!uses?.length) return null
  const toggle = (v: boolean) => {
    setOpen(v)
    if (!v) setPos(null)
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => toggle(!open)}
        onMouseEnter={() => matchMedia('(hover: hover)').matches && toggle(true)}
        className={
          'relative inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent transition before:absolute before:-inset-2 before:content-[""] active:brightness-95 ' +
          (className ?? '')
        }
      >
        <Utensils size={11} strokeWidth={2.4} aria-hidden />
        사용예정
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label="사용 예정 식단"
            onMouseLeave={() => matchMedia('(hover: hover)').matches && toggle(false)}
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
            className="fixed z-50 w-64 max-w-[calc(100vw-1rem)] animate-[sheet-up_150ms_ease-out] rounded-2xl border border-line bg-surface p-3.5 shadow-card motion-reduce:animate-none"
          >
            <p className="text-[13px] font-bold text-muted">식단표에서 쓰기로 했어요</p>
            <ul className="mt-2 flex flex-col gap-2">
              {uses.map((u) => (
                <li key={`${u.date}|${u.slot}`} className="flex items-start gap-2 text-[14px] leading-snug">
                  <span className="tabular shrink-0 rounded-lg bg-sunken px-1.5 py-0.5 text-xs font-bold text-muted">
                    {plannedDayText(u.date)} {MEAL_LABEL[u.slot]}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold break-keep">{u.menu}</span>
                  {hasEgg(u.menu) && <SunnyEgg size={16} />}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
