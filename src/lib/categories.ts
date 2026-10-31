export interface Category {
  id: string
  label: string
  emoji: string
}

export const CATEGORIES: Category[] = [
  { id: 'vegetable', label: '채소', emoji: '🥬' },
  { id: 'fruit', label: '과일', emoji: '🍎' },
  { id: 'meat', label: '육류', emoji: '🥩' },
  { id: 'seafood', label: '해산물', emoji: '🐟' },
  { id: 'dairy', label: '유제품', emoji: '🥛' },
  { id: 'egg', label: '달걀', emoji: '🥚' },
  { id: 'side', label: '반찬', emoji: '🥢' },
  { id: 'sauce', label: '소스·양념', emoji: '🧂' },
  { id: 'drink', label: '음료', emoji: '🧃' },
  { id: 'frozen', label: '냉동식품', emoji: '🧊' },
  { id: 'processed', label: '가공식품', emoji: '🥫' },
  { id: 'etc', label: '기타', emoji: '📦' },
]

export const UNITS = ['개', '팩', '봉지', '병', '통', 'g', 'kg', 'ml', 'L']

export function categoryOf(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
}
