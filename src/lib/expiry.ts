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

export const LEVEL_STYLE: Record<ExpiryLevel, string> = {
  expired: 'bg-red-600 text-white',
  urgent: 'bg-orange-500 text-white',
  soon: 'bg-amber-300 text-amber-950',
  ok: 'bg-emerald-100 text-emerald-800',
  none: 'bg-slate-100 text-slate-500',
}
