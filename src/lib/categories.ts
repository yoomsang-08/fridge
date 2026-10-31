import { useSyncExternalStore } from 'react'
import type { Container, Zone } from './types'

export interface Category {
  id: string
  label: string
  emoji: string
  /** 이모지 뒤에 까는 연한 바탕색 (#rrggbb) */
  tint: string
  /** 숨긴 분류는 입력 화면에서만 빠진다 */
  hidden?: boolean
  /** 자동 기한(일): 유통기한이 안 찍힌 재료는 '넣은 날 + 이 일수'. null 이면 자동으로 안 채움 */
  fridge_days?: number | null
  freezer_days?: number | null
  pantry_days?: number | null
}

/**
 * 처음 쓰는 집의 분류. 0007_categories.sql 의 seed, 0014_category_days.sql 의 기본 일수와 같다.
 * 냉동 일수는 지선님 기준 (생선·해산물 6개월, 육류 3개월, 채소 1년)
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'vegetable', label: '채소', emoji: '🥬', tint: '#e8f3e6', fridge_days: 7, freezer_days: 365, pantry_days: 7 },
  { id: 'fruit', label: '과일', emoji: '🍎', tint: '#fdecea', fridge_days: 7, freezer_days: 180, pantry_days: 5 },
  { id: 'meat', label: '육류', emoji: '🥩', tint: '#fbe7e4', fridge_days: 3, freezer_days: 90, pantry_days: null },
  { id: 'seafood', label: '해산물', emoji: '🐟', tint: '#e6f0f8', fridge_days: 2, freezer_days: 180, pantry_days: null },
  { id: 'dairy', label: '유제품', emoji: '🥛', tint: '#edf1f8', fridge_days: 7, freezer_days: 90, pantry_days: null },
  { id: 'egg', label: '달걀', emoji: '🥚', tint: '#fbf2e3', fridge_days: 21, freezer_days: null, pantry_days: 14 },
  { id: 'side', label: '반찬', emoji: '🥢', tint: '#eef3ea', fridge_days: 5, freezer_days: 30, pantry_days: null },
  { id: 'sauce', label: '소스·양념', emoji: '🧂', tint: '#f6efe6', fridge_days: 180, freezer_days: null, pantry_days: 180 },
  { id: 'drink', label: '음료', emoji: '🧃', tint: '#fdf3e1', fridge_days: 14, freezer_days: null, pantry_days: 180 },
  { id: 'frozen', label: '냉동식품', emoji: '🧊', tint: '#e7f2f6', fridge_days: null, freezer_days: 180, pantry_days: null },
  { id: 'processed', label: '가공식품', emoji: '🥫', tint: '#f3ede8', fridge_days: 30, freezer_days: 180, pantry_days: 90 },
  { id: 'rice', label: '밥·면', emoji: '🍚', tint: '#f5f1e6', fridge_days: 2, freezer_days: 30, pantry_days: null },
  { id: 'soup', label: '국·찌개', emoji: '🍲', tint: '#fbeee6', fridge_days: 3, freezer_days: 90, pantry_days: null },
  { id: 'leftover', label: '남은 음식', emoji: '🍱', tint: '#eef1f6', fridge_days: 3, freezer_days: 30, pantry_days: null },
  { id: 'prep', label: '손질 재료', emoji: '🧄', tint: '#f1f3e8', fridge_days: 3, freezer_days: 90, pantry_days: null },
  { id: 'babyfood', label: '이유식', emoji: '🍼', tint: '#fdf0f3', fridge_days: 2, freezer_days: 14, pantry_days: null },
  { id: 'etc', label: '기타', emoji: '📦', tint: '#eef0ee', fridge_days: 14, freezer_days: 90, pantry_days: 30 },
]

const FALLBACK: Category = { id: 'etc', label: '기타', emoji: '📦', tint: '#eef0ee' }

// 우리 집 분류 목록. repo.load() 가 DB 에서 읽어 채운다
let current = DEFAULT_CATEGORIES
const listeners = new Set<() => void>()

/** 바탕색은 옅은 색만(명도 90% 이상). 진한 값이 DB 에 들어와도 목록이 알록달록해지지 않게 */
function lightTint(tint: string): string {
  const m = tint.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return FALLBACK.tint
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255)
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 >= 0.9 ? tint : FALLBACK.tint
}

export function setCategories(list: Category[]) {
  current =
    list.length > 0
      ? list.map((c) => {
          // 0014 전이면 일수 컬럼이 없으니 기본값으로
          const d = DEFAULT_CATEGORIES.find((x) => x.id === c.id)
          return {
            ...c,
            tint: lightTint(c.tint),
            fridge_days: c.fridge_days === undefined ? (d?.fridge_days ?? null) : c.fridge_days,
            freezer_days: c.freezer_days === undefined ? (d?.freezer_days ?? null) : c.freezer_days,
            pantry_days: c.pantry_days === undefined ? (d?.pantry_days ?? null) : c.pantry_days,
          }
        })
      : DEFAULT_CATEGORIES
  listeners.forEach((l) => l())
}

export function useCategories(): Category[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

/** 목록에 없는 id(지운 분류 등)는 '기타'로 보여준다 */
export function categoryOf(id: string): Category {
  return current.find((c) => c.id === id) ?? current.find((c) => c.id === 'etc') ?? FALLBACK
}

export const UNITS = ['개', '팩', '봉지', '병', '통', 'g', 'kg', 'ml', 'L']

const CONTAINER_RULES: [RegExp, Container][] = [
  [/우유|두유|생크림|요구르트.*팩|팩/, 'carton'],
  [/맥주|콜라|사이다|캔|참치|스팸/, 'can'],
  [/잼|피클|병조림|꿀|땅콩버터/, 'jar'],
  [/소스|간장|식초|오일|기름|생수|음료|주스|와인|소주|막걸리|케첩|마요네즈|드레싱|병/, 'bottle'],
  [/김치|반찬|장아찌|젓갈|통|밀폐/, 'tub'],
  [/두부|계란|달걀|상자|박스/, 'box'],
  [/과자|만두|봉지|떡|면|지퍼백|냉동/, 'bag'],
  [/고기|삼겹|목살|등심|안심|갈비|닭|생선|연어|회|오징어|새우|트레이/, 'tray'],
  [/사과|배|귤|오렌지|바나나|양파|당근|감자|고구마|오이|호박|파프리카|토마토|레몬|아보카도/, 'loose'],
]

/** 이름과 단위로 용기를 짐작. 화면에서는 추천으로만 보여준다 */
export function guessContainer(name: string, unit: string): Container | null {
  const text = `${name} ${unit === '병' || unit === '통' || unit === '봉지' ? unit : ''}`
  return CONTAINER_RULES.find(([re]) => re.test(text))?.[1] ?? null
}

/** 용기: 3D 에서 모양을 고른다. 안 고르면 3D 가 단위와 분류로 추정 */
export const CONTAINERS: { id: Container; label: string }[] = [
  { id: 'bottle', label: '병' },
  { id: 'jar', label: '유리병' },
  { id: 'carton', label: '종이팩' },
  { id: 'can', label: '캔' },
  { id: 'tub', label: '통' },
  { id: 'box', label: '상자' },
  { id: 'bag', label: '봉지' },
  { id: 'tray', label: '트레이' },
  { id: 'loose', label: '낱개' },
]

export type DaysKey = 'fridge_days' | 'freezer_days' | 'pantry_days'
export type CategoryDays = Partial<Record<DaysKey, number | null>>

export const getCategories = () => current

/** 칸 종류 → 자동 기한 컬럼. 변온은 냉장 기준 */
export const DAYS_KEY: Record<Zone, DaysKey> = {
  fridge: 'fridge_days',
  flex: 'fridge_days',
  freezer: 'freezer_days',
  pantry: 'pantry_days',
}

/** 이 분류를 이 칸 종류에 넣을 때의 자동 기한(일). null 이면 자동으로 안 채움 */
export function autoDays(category: string, zone: Zone): number | null {
  return categoryOf(category)[DAYS_KEY[zone]] ?? null
}

/** 설정·안내 문구용: 7 → '1주', 90 → '3개월', 365 → '1년' */
export function daysLabel(days: number | null | undefined): string {
  if (!days) return '안 함'
  if (days % 365 === 0) return `${days / 365}년`
  if (days >= 28 && days % 30 === 0) return `${days / 30}개월`
  if (days % 7 === 0) return `${days / 7}주`
  return `${days}일`
}

/** 설정에서 고르는 일수 */
export const DAYS_OPTIONS = [1, 2, 3, 5, 7, 14, 21, 30, 60, 90, 180, 270, 365, 730]
