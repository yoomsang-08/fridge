import { shortAgo } from '../lib/notes'
import type { FridgePhoto } from '../lib/types'
import { cx } from '../lib/cx'

const TILTS = ['rotate-[1.5deg]', '-rotate-[1deg]', 'rotate-[0.5deg]', '-rotate-[1.5deg]']
const tiltOf = (id: string) => TILTS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TILTS.length]

/** 냉장고 문에 자석으로 붙인 사진 한 장 (폴라로이드 느낌) */
export function PhotoMagnet({ photo, onClick, className }: { photo: FridgePhoto; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${photo.author_name ?? '누군가'}가 붙인 사진 보기`}
      className={cx(
        'relative flex w-full flex-col self-start rounded-[4px] bg-white p-2 pb-2.5 text-left shadow-card transition active:scale-[0.98]',
        tiltOf(photo.id),
        className,
      )}
    >
      <span aria-hidden className="absolute -top-1 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-accent ring-2 ring-surface/70" />
      <img src={photo.url} alt="" loading="lazy" decoding="async" className="aspect-[4/5] w-full rounded-[2px] bg-sunken object-cover" />
      <span className="mt-2 truncate text-xs text-muted">
        {photo.author_name ?? '누군가'} · {shortAgo(photo.created_at)}
      </span>
    </button>
  )
}
