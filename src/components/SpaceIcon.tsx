import { Archive, Refrigerator } from 'lucide-react'
import type { Fridge } from '../lib/types'

/** 공간 칩 아이콘. 3D 탭·재고 필터·식품 시트에서 같은 모양을 쓴다 */
export function SpaceIcon({ fridge, size = 15 }: { fridge: Pick<Fridge, 'template'>; size?: number }) {
  const Icon = fridge.template === 'pantry' ? Archive : Refrigerator
  return <Icon size={size} strokeWidth={2.2} className="shrink-0" />
}
