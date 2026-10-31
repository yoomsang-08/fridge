import { Plus } from 'lucide-react'
import { isMine } from '../lib/notes'
import type { Me, Note, NoteComment } from '../lib/types'
import { StickyNote } from './StickyNote'

interface Props {
  notes: Note[]
  comments: NoteComment[]
  me: Me
  /** 이번에 메모 탭을 열기 전까지 안 봤던 메모. 탭에 있는 동안 '새 메모'로 보인다 */
  fresh: Set<string>
  onOpen: (note: Note) => void
  onWrite: () => void
}

/** 메모 탭: 냉장고 문 한 짝에 메모가 붙어 있는 모양 */
export function NoteBoard({ notes, comments, me, fresh, onOpen, onWrite }: Props) {
  const countOf = new Map<string, number>()
  for (const c of comments) countOf.set(c.note_id, (countOf.get(c.note_id) ?? 0) + 1)
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">냉장고 문</h2>
        <p className="mt-0.5 text-sm text-muted">
          {notes.length > 0
            ? `붙어 있는 메모 ${notes.length}개`
            : '장보기 부탁이나 한마디를 냉장고 문에 붙여 보세요.'}
        </p>
      </div>

      <div className="rounded-[1.75rem] border border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
          <button
            onClick={onWrite}
            className="flex min-h-36 flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-line text-sm font-bold text-accent transition active:bg-accent-soft"
          >
            <Plus size={22} strokeWidth={2.4} />
            메모 붙이기
          </button>
          {notes.map((n) => (
            <StickyNote
              key={n.id}
              note={n}
              onClick={() => onOpen(n)}
              comments={countOf.get(n.id) ?? 0}
              status={fresh.has(n.id) ? 'new' : isMine(n, me) ? (n.read_at ? 'read' : 'unread') : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
