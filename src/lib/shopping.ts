import { UNITS } from './categories'
import type { Item, ShoppingItem } from './types'

const squash = (s: string) => s.replace(/\s+/g, '')

/** 장보기 항목과 같은(또는 비슷한) 이름의 재고. 막지 않고 알려 주기만 한다 */
export function alreadyHave(name: string, items: Item[]): Item | null {
  const q = squash(name)
  if (!q) return null
  const exact = items.find((i) => squash(i.name) === q)
  if (exact) return exact
  if (q.length < 2) return null
  // '우유' ↔ '서울우유 1L' 는 후보로만
  return items.find((i) => {
    const n = squash(i.name)
    return n.length >= 2 && (n.includes(q) || q.includes(n))
  }) ?? null
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
