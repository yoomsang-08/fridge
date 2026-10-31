export type ExpiryLevel = 'expired' | 'urgent' | 'soon' | 'ok' | 'none'

const DAY = 24 * 60 * 60 * 1000

/** 'YYYY-MM-DD' 를 로컬 자정 기준 Date 로 */
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function today(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** 오늘 기준 남은 일수. 오늘이 기한이면 0, 지났으면 음수 */
export function daysLeft(expiry: string | null, base: Date = today()): number | null {
  if (!expiry) return null
  return Math.round((parseDate(expiry).getTime() - base.getTime()) / DAY)
}

export function expiryLevel(expiry: string | null, base?: Date): ExpiryLevel {
  const d = daysLeft(expiry, base)
  if (d === null) return 'none'
  if (d < 0) return 'expired'
  if (d <= 3) return 'urgent'
  if (d <= 7) return 'soon'
  return 'ok'
}

export function dDayLabel(expiry: string | null, base?: Date): string {
  const d = daysLeft(expiry, base)
  if (d === null) return '기한 없음'
  if (d === 0) return 'D-DAY'
  return d > 0 ? `D-${d}` : `D+${-d}`
}

export function addDays(days: number, base: Date = today()): string {
  return toDateString(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days))
}

export function addMonths(months: number, base: Date = today()): string {
  return toDateString(new Date(base.getFullYear(), base.getMonth() + months, base.getDate()))
}

/** 'D-3' 대신 사람이 읽는 말로: 오늘까지, 내일까지, 3일 남음, 2일 지남 */
export function expiryLabel(expiry: string | null, base?: Date): string {
  const d = daysLeft(expiry, base)
  if (d === null) return '기한 없음'
  if (d < 0) return `${-d}일 지남`
  if (d === 0) return '오늘까지'
  if (d === 1) return '내일까지'
  return `${d}일 남음`
}

/** 배지처럼 쓰는 바탕+글자 색 */
export const LEVEL_STYLE: Record<ExpiryLevel, string> = {
  expired: 'bg-expired-soft text-expired',
  urgent: 'bg-urgent-soft text-urgent',
  soon: 'bg-soon-soft text-soon',
  ok: 'bg-sunken text-muted',
  none: 'bg-sunken text-faint',
}

/** 목록에서 글자에만 쓰는 색 */
export const LEVEL_TEXT: Record<ExpiryLevel, string> = {
  expired: 'text-expired',
  urgent: 'text-urgent',
  soon: 'text-soon',
  ok: 'text-muted',
  none: 'text-faint',
}

/** 기한순 목록의 묶음 이름 */
export const LEVEL_GROUP: Record<ExpiryLevel, string> = {
  expired: '기한이 지났어요',
  urgent: '3일 안에 먹어요',
  soon: '이번 주',
  ok: '여유 있어요',
  none: '기한 없음',
}

export const LEVEL_DOT: Record<ExpiryLevel, string> = {
  expired: 'bg-expired',
  urgent: 'bg-urgent',
  soon: 'bg-soon',
  ok: 'bg-faint/60',
  none: 'bg-faint/40',
}
