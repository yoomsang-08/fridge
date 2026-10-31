import { ChevronRight } from 'lucide-react'
import { notePaper } from '../lib/notes'
import type { Note } from '../lib/types'
import { cx } from '../lib/cx'

/** 재고 화면 위: 아직 안 본 메모가 있을 때만 보인다 */
export function NoteBanner({ unread, onOpen }: { unread: Note[]; onOpen: () => void }) {
  if (unread.length === 0) return null
  const latest = unread[0]
  return (
    <button
      onClick={onOpen}
      className={cx(
        'mb-3 flex w-full items-center gap-3 rounded-card px-4 py-3 text-left shadow-card transition active:scale-[0.99]',
        notePaper(latest.color),
      )}
    >
      <span aria-hidden className="h-3 w-3 shrink-0 rounded-full bg-accent ring-2 ring-surface/70" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-muted">
          {latest.author_name ?? '누군가'}의 새 메모{unread.length > 1 && ` 외 ${unread.length - 1}개`}
        </span>
        <span className="block truncate text-[15px] font-semibold">{latest.body}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </button>
  )
}
