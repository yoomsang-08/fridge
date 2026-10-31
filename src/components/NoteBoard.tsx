import { ImagePlus, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { isMine } from '../lib/notes'
import { PHOTO_LIMIT } from '../lib/photos'
import type { FridgePhoto, Me, Note, NoteComment } from '../lib/types'
import { cx } from '../lib/cx'
import { PhotoMagnet } from './PhotoMagnet'
import { StickyNote } from './StickyNote'

interface Props {
  notes: Note[]
  comments: NoteComment[]
  photos: FridgePhoto[]
  me: Me
  /** 이번에 메모 탭을 열기 전까지 안 봤던 메모. 탭에 있는 동안 '새 메모'로 보인다 */
  fresh: Set<string>
  onOpen: (note: Note) => void
  onWrite: () => void
  onOpenPhoto: (photo: FridgePhoto) => void
  onAddPhoto: (file: File) => Promise<void>
}

const HALF =
  'flex flex-1 flex-col items-center justify-center gap-1 py-3 text-sm font-bold text-accent transition active:bg-accent-soft'

/** 메모 탭: 냉장고 문 한 짝에 메모와 사진이 붙어 있는 모양 */
export function NoteBoard({ notes, comments, photos, me, fresh, onOpen, onWrite, onOpenPhoto, onAddPhoto }: Props) {
  const countOf = new Map<string, number>()
  for (const c of comments) countOf.set(c.note_id, (countOf.get(c.note_id) ?? 0) + 1)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const full = photos.length >= PHOTO_LIMIT

  // 메모와 사진을 붙인 순서대로 섞어서
  const cards = [
    ...notes.map((n) => ({ kind: 'note' as const, at: n.created_at, n })),
    ...photos.map((p) => ({ kind: 'photo' as const, at: p.created_at, p })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await onAddPhoto(file)
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'photo_limit'
          ? `사진은 ${PHOTO_LIMIT}장까지 붙일 수 있어요. 오래된 사진을 떼고 붙여 주세요.`
          : '사진을 붙이지 못했어요. 잠시 뒤 다시 해 주세요.',
      )
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {/* 열 장이 넘게 붙으면 제목이 살짝 바뀐다 (이스터에그) */}
        <h2 className="text-2xl font-extrabold tracking-tight">{notes.length + photos.length > 10 ? '냉장고 문이 꽉 찼어요' : '냉장고 문'}</h2>
        <p className="mt-0.5 text-sm text-muted">
          {notes.length + photos.length > 0
            ? [notes.length && `메모 ${notes.length}개`, photos.length && `사진 ${photos.length}장`].filter(Boolean).join(' · ') + ' 붙어 있어요'
            : '장보기 부탁이나 한마디, 사진을 냉장고 문에 붙여 보세요.'}
        </p>
      </div>

      <div className="rounded-[1.75rem] border border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
          {/* 메모 한 장 크기의 점선 칸 하나를 위아래 반반으로 */}
          <div className="flex min-h-36 flex-col self-start overflow-hidden rounded-md border-2 border-dashed border-line">
            <button onClick={onWrite} className={HALF}>
              <Plus size={20} strokeWidth={2.4} />
              메모 붙이기
            </button>
            <span aria-hidden className="mx-3 border-t-2 border-dashed border-line" />
            <button
              onClick={() => input.current?.click()}
              disabled={busy || full}
              className={cx(HALF, (busy || full) && 'text-faint active:bg-transparent')}
            >
              <ImagePlus size={20} strokeWidth={2.2} />
              {busy ? '붙이는 중…' : full ? `사진 ${PHOTO_LIMIT}장 가득` : '사진 붙이기'}
            </button>
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          {cards.map((c) =>
            c.kind === 'note' ? (
              <StickyNote
                key={c.n.id}
                note={c.n}
                onClick={() => onOpen(c.n)}
                comments={countOf.get(c.n.id) ?? 0}
                status={fresh.has(c.n.id) ? 'new' : isMine(c.n, me) ? (c.n.read_at ? 'read' : 'unread') : undefined}
              />
            ) : (
              <PhotoMagnet key={c.p.id} photo={c.p} onClick={() => onOpenPhoto(c.p)} />
            ),
          )}
        </div>
        {error && <p className="mt-3 text-sm text-expired">{error}</p>}
      </div>
    </div>
  )
}
