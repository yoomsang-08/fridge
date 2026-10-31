import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { isMine, NOTE_COLORS, NOTE_SUGGESTIONS, notePaper, timeAgo } from '../lib/notes'
import type { Me, Member, Note, NoteColor, NoteComment, NoteInput } from '../lib/types'
import { cx } from '../lib/cx'
import { Sheet } from './Sheet'
import { NoteText } from './StickyNote'
import { Button, Chip, Field, TextInput } from './ui'

const MAX = 200
const LAST_COLOR_KEY = 'fridge-last-note-color'

/** 메모 남기기 */
export function NoteWriteSheet({
  me,
  members,
  onClose,
  onSave,
}: {
  me: Me
  members: Member[]
  onClose: () => void
  onSave: (input: NoteInput) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [color, setColor] = useState<NoteColor>(
    () => (localStorage.getItem(LAST_COLOR_KEY) as NoteColor | null) ?? 'yellow',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const text = body.trim()
  // 해시태그로 부를 수 있는 식구: 나와 이름 없는 사람은 빼고, 둘 이상이면 #모두 도
  const others = [...new Set(members.filter((m) => m.name && m.name !== me.name).map((m) => m.name!))]
  const tags = others.length > 1 ? [...others, '모두'] : others
  const addTag = (name: string) =>
    setBody((b) => (b.includes(`#${name}`) ? b : `${b.trimEnd()}${b.trim() ? ' ' : ''}#${name} `).slice(0, MAX))

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

        {tags.length > 0 && (
          <Field label="누구에게 알려 줄까요?">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((name) => (
                <Chip key={name} active={body.includes(`#${name}`)} onClick={() => addTag(name)}>
                  #{name}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">#이름을 붙이면 그 사람 폰으로 알림이 가요. 알림을 켜 둔 기기에만 가요.</p>
          </Field>
        )}

        <Field label="어떤 색 종이에?">
          <div className="flex gap-3">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.id}
                aria-pressed={color === c.id}
                aria-label={`${c.label} 종이`}
                onClick={() => setColor(c.id)}
                className={cx(
                  'grid h-11 w-11 place-items-center rounded-full border border-line text-ink transition',
                  c.paper,
                  color === c.id && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
                )}
              >
                {color === c.id && <Check size={18} strokeWidth={2.6} />}
              </button>
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
  comments,
  me,
  onClose,
  onRemove,
  onComment,
  onDeleteComment,
}: {
  note: Note
  /** 이 메모에 달린 댓글, 오래된 것부터 */
  comments: NoteComment[]
  me: Me
  onClose: () => void
  onRemove: () => Promise<void>
  onComment: (body: string) => Promise<void>
  onDeleteComment: (id: string) => Promise<void>
}) {
  const mine = isMine(note, me)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const text = draft.trim()

  const send = async () => {
    if (!text || busy) return
    setBusy(true)
    setError(null)
    try {
      await onComment(text)
      setDraft('')
    } catch {
      setError('댓글을 달지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

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
        <p className="text-lg leading-relaxed font-semibold break-keep whitespace-pre-wrap">
          <NoteText body={note.body} />
        </p>
      </div>
      <p className="mt-3 text-sm text-muted">
        {note.author_name ?? '누군가'} · {timeAgo(note.created_at)}
        {mine && (note.read_at ? ` · ${timeAgo(note.read_at)} 읽음` : ' · 아직 안 읽음')}
      </p>

      <section className="mt-5 border-t border-line pt-4" aria-label="댓글">
        <h3 className="text-[13px] font-bold text-muted">댓글{comments.length > 0 && ` ${comments.length}`}</h3>
        {comments.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {comments.map((c) => {
              const own = isMine(c, me)
              return (
                <li key={c.id} className={cx('rounded-2xl px-3.5 py-2.5', own ? 'bg-accent-soft' : 'bg-sunken')}>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="font-bold text-ink">{c.author_name ?? '누군가'}</span>
                    <span className="flex-1">{timeAgo(c.created_at)}</span>
                    {own && (
                      <button
                        onClick={() => onDeleteComment(c.id).catch(() => setError('댓글을 지우지 못했어요.'))}
                        aria-label="내 댓글 지우기"
                        className="-my-1 -mr-1.5 grid h-7 w-7 place-items-center rounded-full text-faint transition active:bg-ink/10"
                      >
                        <X size={14} strokeWidth={2.4} />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-[15px] leading-snug break-keep whitespace-pre-wrap text-ink">
                    <NoteText body={c.body} />
                  </p>
                </li>
              )
            })}
          </ul>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <TextInput
            value={draft}
            maxLength={MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={comments.length ? '댓글 달기' : '첫 댓글을 남겨 보세요'}
            aria-label="댓글 쓰기"
            enterKeyHint="send"
          />
          <Button type="submit" className="h-12 shrink-0" disabled={!text || busy}>
            달기
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-expired">{error}</p>}
      </section>
    </Sheet>
  )
}
