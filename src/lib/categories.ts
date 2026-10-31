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

export function setCategories(list: Category[]) {
  current = list.length > 0 ? list : DEFAULT_CATEGORIES
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
