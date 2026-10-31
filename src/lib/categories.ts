export interface Category {
  id: string
  label: string
  emoji: string
  /** 이모지 뒤에 까는 연한 바탕색 */
  tint: string
}

export const CATEGORIES: Category[] = [
  { id: 'vegetable', label: '채소', emoji: '🥬', tint: 'bg-[#e8f3e6]' },
  { id: 'fruit', label: '과일', emoji: '🍎', tint: 'bg-[#fdecea]' },
  { id: 'meat', label: '육류', emoji: '🥩', tint: 'bg-[#fbe7e4]' },
  { id: 'seafood', label: '해산물', emoji: '🐟', tint: 'bg-[#e6f0f8]' },
  { id: 'dairy', label: '유제품', emoji: '🥛', tint: 'bg-[#edf1f8]' },
  { id: 'egg', label: '달걀', emoji: '🥚', tint: 'bg-[#fbf2e3]' },
  { id: 'side', label: '반찬', emoji: '🥢', tint: 'bg-[#eef3ea]' },
  { id: 'sauce', label: '소스·양념', emoji: '🧂', tint: 'bg-[#f6efe6]' },
  { id: 'drink', label: '음료', emoji: '🧃', tint: 'bg-[#fdf3e1]' },
  { id: 'frozen', label: '냉동식품', emoji: '🧊', tint: 'bg-[#e7f2f6]' },
  { id: 'processed', label: '가공식품', emoji: '🥫', tint: 'bg-[#f3ede8]' },
  { id: 'etc', label: '기타', emoji: '📦', tint: 'bg-[#eef0ee]' },
]

export const UNITS = ['개', '팩', '봉지', '병', '통', 'g', 'kg', 'ml', 'L']

export function categoryOf(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
}
