import { UNITS } from './categories'
import type { Item, ShoppingItem } from './types'

const squash = (s: string) => s.replace(/\s+/g, '')

/**
 * 장보기 항목과 같은(또는 비슷한) 이름의 재고 전부. 막지 않고 알려 주기만 한다.
 * 같은 이름이 있으면 그것만, 없으면 '우유' ↔ '서울우유 1L' 같은 부분 일치를 후보로 돌려준다.
 */
export function matchingItems(name: string, items: Item[]): Item[] {
  const q = squash(name)
  if (!q) return []
  const exact = items.filter((i) => squash(i.name) === q)
  if (exact.length > 0 || q.length < 2) return exact
  return items.filter((i) => {
    const n = squash(i.name)
    return n.length >= 2 && (n.includes(q) || q.includes(n))
  })
}

export function alreadyHave(name: string, items: Item[]): Item | null {
  return matchingItems(name, items)[0] ?? null
}

/** 여러 칸에 나뉜 같은 식품을 단위별로 합쳐 '2통 + 500ml' 로. 첫 번째 식품은 눌렀을 때 열 대상 */
export function haveSummary(name: string, items: Item[]): { first: Item; amount: string; count: number; prefix: string } | null {
  const list = matchingItems(name, items)
  if (list.length === 0) return null
  const sums = new Map<string, number>()
  for (const i of list) sums.set(i.unit, (sums.get(i.unit) ?? 0) + i.quantity)
  const amount = [...sums].map(([unit, q]) => `${Math.round(q * 100) / 100}${unit}`).join(' + ')
  const names = new Set(list.map((i) => i.name))
  const prefix = names.size === 1 && !names.has(name.trim()) ? `${list[0].name} ` : ''
  return { first: list[0], amount, count: list.length, prefix }
}

/** '1통' · '2 개' → 수량 1, 단위 통. 모르는 말이면 null */
export function parseQty(qty: string | null): { quantity: number; unit: string } | null {
  const m = qty?.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (!m) return null
  const quantity = Number(m[1])
  if (!(quantity > 0)) return null
  const unit = m[2].trim()
  return { quantity, unit: UNITS.includes(unit) ? unit : '' }
}

/** 입력 한 줄에서 이름과 수량 나누기: '우유 2통' → 우유 / 2통 */
export function splitNameQty(text: string): { name: string; qty?: string } {
  const t = text.trim().replace(/\s+/g, ' ')
  const m = t.match(/^(.+?)\s+(\d+(?:\.\d+)?\s?[가-힣A-Za-z]{0,3})$/)
  return m ? { name: m[1], qty: m[2].replace(/\s/g, '') } : { name: t }
}

export const openCount = (list: ShoppingItem[]) => list.filter((s) => !s.checked).length
