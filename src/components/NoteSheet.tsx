import { useState } from 'react'
import { isMine, NOTE_COLORS, NOTE_SUGGESTIONS, notePaper, timeAgo } from '../lib/notes'
import type { Me, Note, NoteColor, NoteInput } from '../lib/types'
import { cx } from '../lib/cx'
import { Sheet } from './Sheet'
import { Button, Chip, Field } from './ui'

const MAX = 200
const LAST_COLOR_KEY = 'fridge-last-note-color'

/** 메모 남기기 */
export function NoteWriteSheet({ onClose, onSave }: { onClose: () => void; onSave: (input: NoteInput) => Promise<void> }) {
  const [body, setBody] = useState('')
  const [color, setColor] = useState<NoteColor>(
    () => (localStorage.getItem(LAST_COLOR_KEY) as NoteColor | null) ?? 'yellow',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const text = body.trim()

  const save = async () => {
    if (!text || busy) return
    setBusy(true)
    setError(null)
    try {
      localStorage.setItem(LAST_COLOR_KEY, color)
      await onSave({ body: text, color })
    } catch {
      setError('메모를 붙이지 못했어요. 잠시 뒤 다시 해 주세요.')
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="메모 남기기"
      onClose={onClose}
      footer={
        <Button className="flex-1" disabled={!text || busy} onClick={save}>
          냉장고에 붙이기
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label="무슨 말을 남길까요?"
          aside={<span className="tabular text-xs text-faint">{body.length}/{MAX}</span>}
        >
          <textarea
            id="note-body"
            value={body}
            maxLength={MAX}
            rows={4}
            autoFocus
            onChange={(e) => setBody(e.target.value)}
            placeholder="예: 장 볼 때 두부 한 모만 사다 줘요"
            className={cx(
              'w-full resize-none rounded-2xl border border-line px-4 py-3 text-base leading-relaxed font-semibold outline-none transition placeholder:font-normal placeholder:text-faint',
              'focus:border-accent focus:ring-4 focus:ring-accent-soft',
              notePaper(color),
            )}
          />
          <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 pb-1">
            {NOTE_SUGGESTIONS.map((s) => (
              <Chip key={s} tone="suggest" onClick={() => setBody(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="어떤 색 종이에?">
          <div className="flex gap-3" role="radiogroup">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={color === c.id}
                aria-label={c.label}
                onClick={() => setColor(c.id)}
                className={cx(
                  'h-11 w-11 rounded-full border border-line transition',
                  c.paper,
                  color === c.id && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
                )}
              />
            ))}
          </div>
        </Field>

        {error && <p className="rounded-2xl bg-expired-soft p-3 text-sm text-expired">{error}</p>}
      </div>
    </Sheet>
  )
}

/** 메모 크게 보기, 떼기 */
export function NoteViewSheet({
  note,
  me,
  onClose,
  onRemove,
}: {
  note: Note
  me: Me
  onClose: () => void
  onRemove: () => Promise<void>
}) {
  const mine = isMine(note, me)
  return (
    <Sheet
      title={mine ? '내가 남긴 메모' : `${note.author_name ?? '누군가'}의 메모`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            닫기
          </Button>
          <Button variant="danger" className="flex-1" onClick={onRemove}>
            떼기
          </Button>
        </>
      }
    >
      <div className={cx('rounded-md px-5 pt-6 pb-4 shadow-card', notePaper(note.color))}>
        <p className="text-lg leading-relaxed font-semibold break-keep whitespace-pre-wrap">{note.body}</p>
      </div>
      <p className="mt-3 text-sm text-muted">
        {note.author_name ?? '누군가'} · {timeAgo(note.created_at)}
        {mine && (note.read_at ? ` · ${timeAgo(note.read_at)} 읽음` : ' · 아직 안 읽음')}
      </p>
    </Sheet>
  )
}
