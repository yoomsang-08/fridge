import { useSyncExternalStore } from 'react'
import type { Container } from './types'

export interface Category {
  id: string
  label: string
  emoji: string
  /** 이모지 뒤에 까는 연한 바탕색 (#rrggbb) */
  tint: string
  /** 숨긴 분류는 입력 화면에서만 빠진다 */
  hidden?: boolean
}

/** 처음 쓰는 집의 분류. supabase/migrations/0007_categories.sql 의 seed 와 같다 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'vegetable', label: '채소', emoji: '🥬', tint: '#e8f3e6' },
  { id: 'fruit', label: '과일', emoji: '🍎', tint: '#fdecea' },
  { id: 'meat', label: '육류', emoji: '🥩', tint: '#fbe7e4' },
  { id: 'seafood', label: '해산물', emoji: '🐟', tint: '#e6f0f8' },
  { id: 'dairy', label: '유제품', emoji: '🥛', tint: '#edf1f8' },
  { id: 'egg', label: '달걀', emoji: '🥚', tint: '#fbf2e3' },
  { id: 'side', label: '반찬', emoji: '🥢', tint: '#eef3ea' },
  { id: 'sauce', label: '소스·양념', emoji: '🧂', tint: '#f6efe6' },
  { id: 'drink', label: '음료', emoji: '🧃', tint: '#fdf3e1' },
  { id: 'frozen', label: '냉동식품', emoji: '🧊', tint: '#e7f2f6' },
  { id: 'processed', label: '가공식품', emoji: '🥫', tint: '#f3ede8' },
  { id: 'etc', label: '기타', emoji: '📦', tint: '#eef0ee' },
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
  current = list.length > 0 ? list.map((c) => ({ ...c, tint: lightTint(c.tint) })) : DEFAULT_CATEGORIES
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

/**
 * 팬트리(실온)에 넣을 때 추천하는 기한. 보수적으로 잡은 대략값이라 추천 칩으로만 쓴다.
 * null 은 실온 보관을 권하지 않는 분류 (육류·해산물·유제품·반찬·냉동식품)
 */
export const ROOM_TEMP_DAYS: Record<string, number | null> = {
  vegetable: 7,
  fruit: 5,
  meat: null,
  seafood: null,
  dairy: null,
  egg: 14,
  side: null,
  sauce: 180,
  drink: 180,
  frozen: null,
  processed: 90,
  etc: 30,
}

/** 분류가 표에 없으면(집에서 새로 만든 분류) 추천하지 않는다 */
export function roomTempDays(category: string): number | null | undefined {
  return category in ROOM_TEMP_DAYS ? ROOM_TEMP_DAYS[category] : undefined
}
