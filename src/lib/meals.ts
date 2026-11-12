import { useSyncExternalStore } from 'react'
import { addDays, toDateString, today } from './expiry'
import type { MealPlan, MealSlot } from './types'

export const MEAL_SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: '아침' },
  { id: 'lunch', label: '점심' },
  { id: 'dinner', label: '저녁' },
  { id: 'snack', label: '간식' },
  { id: 'late', label: '야식' },
]
export const MEAL_LABEL = Object.fromEntries(MEAL_SLOTS.map((s) => [s.id, s.label])) as Record<MealSlot, string>
const DEFAULT_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner']

// ---------- 보이는 끼니 (집 단위: 모든 기기에 같게) ----------

/** 예전에는 이 기기에만 저장했다. 한 번 집 설정으로 옮기고 지운다 */
const LEGACY_KEY = 'fridge-meal-slots'
const listeners = new Set<() => void>()
let current: MealSlot[] = DEFAULT_SLOTS

const clean = (ids: unknown): MealSlot[] | null => {
  if (!Array.isArray(ids)) return null
  const picked = MEAL_SLOTS.map((s) => s.id).filter((id) => ids.includes(id))
  return picked.length > 0 ? picked : null
}

function set(next: MealSlot[]) {
  if (next.length === current.length && next.every((x, i) => x === current[i])) return
  current = next
  listeners.forEach((l) => l())
}

/** 식단표에 보여 줄 끼니. 설정에서 바꾸면 집 식구 모두에게 같게 보인다 */
export function useMealSlots(): MealSlot[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

/** 설정 화면에서 바꾼 값을 바로 보여 준다 (저장은 repo 가 한다) */
export function setMealSlots(ids: MealSlot[]) {
  if (ids.length > 0) set(ids)
}

/**
 * 불러온 집 설정을 반영한다. 집에 아직 값이 없고 이 기기에 예전 설정이 있으면 그걸 집 설정으로 한 번 옮긴다.
 */
export function syncMealSlots(fromHome: unknown, save: (ids: MealSlot[]) => Promise<void>) {
  const home = clean(fromHome)
  let legacy: MealSlot[] | null = null
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    legacy = raw ? clean(JSON.parse(raw)) : null
  } catch {
    /* 읽지 못하면 기본값 */
  }
  if (home) {
    set(home)
    try { localStorage.removeItem(LEGACY_KEY) } catch { /* 지우지 못해도 괜찮다 */ }
  } else if (legacy) {
    set(legacy)
    save(legacy).then(
      () => { try { localStorage.removeItem(LEGACY_KEY) } catch { /* 괜찮다 */ } },
      () => {}, // 0020 전이면 저장이 안 된다. 이 기기 설정으로 계속 쓴다
    )
  } else {
    set(DEFAULT_SLOTS)
  }
}

// ---------- 날짜 ----------

/** 이번 주 월요일 */
export function mondayOf(base: Date = today()): Date {
  const back = (base.getDay() + 6) % 7
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() - back)
}

export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

export interface MealDay {
  date: string
  /** 0=월 … 6=일 */
  dow: number
  month: number
  day: number
  isToday: boolean
}

/** 한 주 전부터 볼 수 있는 최대 주 수 */
export const MEAL_BACK_WEEKS = 8
/** 다음 주까지만 미리 적는다 */
export const MEAL_AHEAD_WEEKS = 1

/** 이번 주를 0으로 센 주(-1 = 지난 주, 1 = 다음 주)의 월~일 */
export function mealWeek(offset: number, base: Date = today()): MealDay[] {
  const monday = mondayOf(base)
  const todayStr = toDateString(base)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset * 7 + i)
    const date = toDateString(d)
    return { date, dow: i, month: d.getMonth() + 1, day: d.getDate(), isToday: date === todayStr }
  })
}

export function weekName(offset: number): string {
  if (offset === 0) return '이번 주'
  if (offset === 1) return '다음 주'
  if (offset === -1) return '지난 주'
  return offset < 0 ? `${-offset}주 전` : `${offset}주 뒤`
}

/** 식단을 불러올 시작 날짜: 이번 주 월요일 두 달 전부터 (지난 주 보기와 자주 적은 메뉴 제안용) */
export const mealsSince = () => addDays(-60, mondayOf())

export const mealKey = (date: string, slot: MealSlot) => `${date}|${slot}`

export function mealMap(meals: MealPlan[]): Map<string, MealPlan> {
  return new Map(meals.map((m) => [mealKey(m.plan_date, m.slot), m]))
}

/** 한 칸의 어른·아이 메뉴 (둘 다 없으면 빈 문자열) */
export function mealText(m: MealPlan | undefined): { adult: string; kid: string } {
  return { adult: m?.menu?.trim() ?? '', kid: m?.kid_menu?.trim() ?? '' }
}

/** 메뉴에 달걀이 들어 있으면 반숙 달걀 (이스터에그) */
export const hasEgg = (menu: string) => /달걀|계란|써니/.test(menu)

/** 자주 적은 메뉴, 많이 적은 순 */
export function frequentMenus(meals: MealPlan[], limit = 6): string[] {
  const count = new Map<string, number>()
  for (const m of meals)
    for (const menu of [m.menu, m.kid_menu ?? '']) if (menu.trim()) count.set(menu, (count.get(menu) ?? 0) + 1)
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([menu]) => menu)
}

// ---------- 사용 예정 (식단표에서 고른 냉장고 재료) ----------

export interface PlannedUse {
  date: string
  slot: MealSlot
  menu: string
}

/** 식품 id → 앞으로 그 식품을 쓰기로 한 식단들(빠른 날짜순). 지난 날짜 식단은 뺀다 */
export function plannedUses(meals: MealPlan[], base: Date = today()): Map<string, PlannedUse[]> {
  const todayStr = toDateString(base)
  const order = MEAL_SLOTS.map((s) => s.id)
  const out = new Map<string, PlannedUse[]>()
  for (const m of meals) {
    if (m.plan_date < todayStr) continue
    for (const itemId of m.item_ids ?? []) {
      const list = out.get(itemId) ?? []
      const { adult, kid } = mealText(m)
      list.push({ date: m.plan_date, slot: m.slot, menu: [adult, kid].filter(Boolean).join(' / ') })
      out.set(itemId, list)
    }
  }
  for (const list of out.values())
    list.sort((a, b) => a.date.localeCompare(b.date) || order.indexOf(a.slot) - order.indexOf(b.slot))
  return out
}

/** '오늘', '내일', '11월 14일(금)' */
export function plannedDayText(date: string, base: Date = today()): string {
  if (date === toDateString(base)) return '오늘'
  if (date === addDays(1, base)) return '내일'
  const [y, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일(${WEEKDAYS[(new Date(y, m - 1, d).getDay() + 6) % 7]})`
}
