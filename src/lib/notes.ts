import type { Me, Note, NoteColor } from './types'

export const NOTE_COLORS: { id: NoteColor; label: string; paper: string }[] = [
  { id: 'yellow', label: '노랑', paper: 'bg-note-yellow' },
  { id: 'pink', label: '분홍', paper: 'bg-note-pink' },
  { id: 'mint', label: '민트', paper: 'bg-note-mint' },
  { id: 'sky', label: '하늘', paper: 'bg-note-sky' },
]

export const notePaper = (color: NoteColor) => NOTE_COLORS.find((c) => c.id === color)?.paper ?? 'bg-note-yellow'

/** 한 사람이 기기를 여러 개 쓰면 기기마다 계정이 달라서, 이름이 같아도 내 메모로 본다 */
export function isMine(note: Note, me: Me): boolean {
  return note.author_id === me.id || (!!me.name && note.author_name === me.name)
}

/** 상대가 남겼고 내가 아직 안 본 메모 */
export const isUnread = (note: Note, me: Me) => !note.read_at && !isMine(note, me)

/** 메모 아래 '민상 · 2시간 전' */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  if (day === 1) return '어제'
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

/** 냉장고 보기에서 문 앞면에 붙일 메모 수 (최근 것부터) */
export const DOOR_NOTE_COUNT = 3

/** 자주 남기는 말: 눌러서 채우기 */
export const NOTE_SUGGESTIONS = [
  '장 볼 때 우유 사다 줘요',
  '이거 먼저 먹어 줘요',
  '오늘 저녁은 이걸로 해요',
  '내 거니까 남겨 줘요',
  '반찬 해 놨어요',
]

/** 사랑 표현엔 하트 자석, 계란 얘기엔 계란 프라이 자석 */
export function magnetOf(body: string): 'heart' | 'egg' | 'dot' {
  if (/사랑|고마워|고맙|좋아해|보고 ?싶|♥|❤|love/i.test(body)) return 'heart'
  if (/계란|달걀|에그|써니|sunny/i.test(body)) return 'egg'
  return 'dot'
}
