import { notePaper, timeAgo } from '../lib/notes'
import type { Note } from '../lib/types'
import { cx } from '../lib/cx'

/** 살짝 기울어 붙은 느낌. 메모마다 고정된 각도 */
const TILTS = ['-rotate-[1.5deg]', 'rotate-[1deg]', '-rotate-[0.5deg]', 'rotate-[1.5deg]']
const tiltOf = (id: string) => TILTS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TILTS.length]

/**
 * 냉장고 문에 붙은 메모 한 장. 메모 탭과 냉장고 보기(문 위)에서 같이 쓴다.
 * status: 오른쪽 아래 표시 (새 메모 / 읽음 / 안 읽음)
 */
export function StickyNote({
  note,
  status,
  onClick,
  className,
}: {
  note: Note
  status?: 'new' | 'read' | 'unread'
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'relative flex min-h-36 w-full flex-col rounded-md px-3.5 pt-5 pb-3 text-left shadow-card transition active:scale-[0.98]',
        notePaper(note.color),
        tiltOf(note.id),
        className,
      )}
    >
      {/* 자석 */}
      <span
        aria-hidden
        className="absolute top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-accent ring-2 ring-surface/70"
      />
      <p className="line-clamp-5 flex-1 text-[15px] leading-snug font-semibold break-keep whitespace-pre-wrap text-ink">
        {note.body}
      </p>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted">
        <span className="min-w-0 flex-1 truncate">
          {note.author_name ?? '누군가'} · {timeAgo(note.created_at)}
        </span>
        {status === 'new' && (
          <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">새 메모</span>
        )}
        {status === 'read' && <span className="shrink-0 font-semibold text-accent">읽음</span>}
        {status === 'unread' && <span className="shrink-0 text-faint">안 읽음</span>}
      </div>
    </button>
  )
}
