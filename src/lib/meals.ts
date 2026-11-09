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

// ---------- 보이는 끼니 (이 기기 설정) ----------

const SLOTS_KEY = 'fridge-meal-slots'
const listeners = new Set<() => void>()
let cache: { raw: string | null; value: MealSlot[] } | null = null

function read(): MealSlot[] {
  const raw = localStorage.getItem(SLOTS_KEY)
  if (cache && cache.raw === raw) return cache.value
  let value = DEFAULT_SLOTS
  try {
    const ids: unknown = raw ? JSON.parse(raw) : null
    if (Array.isArray(ids)) {
      const picked = MEAL_SLOTS.map((s) => s.id).filter((id) => ids.includes(id))
      if (picked.length > 0) value = picked
    }
  } catch {
    /* 기본값 */
  }
  cache = { raw, value }
  return value
}

/** 식단표에 보여 줄 끼니. 설정에서 바꾼다 (한 가지는 꼭 켜 둔다) */
export function useMealSlots(): MealSlot[] {
  return useSyncExternalStore((cb) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, read)
}

export function setMealSlots(ids: MealSlot[]) {
  if (ids.length === 0) return
  localStorage.setItem(SLOTS_KEY, JSON.stringify(ids))
  listeners.forEach((l) => l())
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

/** 이번 주와 다음 주, 월요일부터 일요일까지 */
export function mealWeeks(base: Date = today()): MealDay[][] {
  const monday = mondayOf(base)
  const todayStr = toDateString(base)
  return [0, 1].map((w) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + w * 7 + i)
      const date = toDateString(d)
      return { date, dow: i, month: d.getMonth() + 1, day: d.getDate(), isToday: date === todayStr }
    }),
  )
}

/** 식단을 불러올 시작 날짜: 이번 주 월요일 두 달 전부터 (자주 적은 메뉴 제안용) */
export const mealsSince = () => addDays(-60, mondayOf())

export const mealKey = (date: string, slot: MealSlot) => `${date}|${slot}`

export function mealMap(meals: MealPlan[]): Map<string, MealPlan> {
  return new Map(meals.map((m) => [mealKey(m.plan_date, m.slot), m]))
}

/** 메뉴에 달걀이 들어 있으면 반숙 달걀 (이스터에그) */
export const hasEgg = (menu: string) => /달걀|계란|써니/.test(menu)

/** 자주 적은 메뉴, 많이 적은 순 */
export function frequentMenus(meals: MealPlan[], limit = 6): string[] {
  const count = new Map<string, number>()
  for (const m of meals) count.set(m.menu, (count.get(m.menu) ?? 0) + 1)
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([menu]) => menu)
}
