import type { Layout, Zone } from './types'

export interface CompartmentTemplate {
  name: string
  zone: Zone
  section: string
  layout: Layout
}

export interface FridgeTemplate {
  id: string
  label: string
  name: string
  model: string | null
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  compartments: CompartmentTemplate[]
}

const shelf = (n: number, y: number): CompartmentTemplate => ({
  name: `냉장 선반 ${n}단`,
  zone: 'fridge',
  section: 'main',
  layout: { x: 0.04, y, w: 0.92, h: 0.1 },
})

const pocket = (side: 'left' | 'right', n: number, y: number): CompartmentTemplate => ({
  name: `${side === 'left' ? '왼쪽' : '오른쪽'} 문 포켓 ${n}`,
  zone: 'fridge',
  section: `door-${side}`,
  layout: { x: side === 'left' ? 0 : 0.5, y, w: 0.5, h: 0.12 },
})

export const FRIDGE_TEMPLATES: FridgeTemplate[] = [
  {
    id: 'samsung-rf85-4door',
    label: '삼성 비스포크 4도어 (RF85 계열)',
    name: '메인 냉장고',
    model: 'RF85DB90F1AP',
    width_mm: 912,
    height_mm: 1853,
    depth_mm: 930,
    compartments: [
      shelf(1, 0.03),
      shelf(2, 0.14),
      shelf(3, 0.25),
      shelf(4, 0.36),
      { name: '냉장 서랍', zone: 'fridge', section: 'main', layout: { x: 0.04, y: 0.47, w: 0.92, h: 0.1 } },
      pocket('left', 1, 0.05),
      pocket('left', 2, 0.2),
      pocket('left', 3, 0.35),
      pocket('right', 1, 0.05),
      pocket('right', 2, 0.2),
      pocket('right', 3, 0.35),
      { name: '왼쪽 하단 냉동 서랍', zone: 'freezer', section: 'lower', layout: { x: 0, y: 0.62, w: 0.5, h: 0.38 } },
      { name: '오른쪽 하단 맞춤보관 서랍', zone: 'flex', section: 'lower', layout: { x: 0.5, y: 0.62, w: 0.5, h: 0.38 } },
    ],
  },
  {
    id: 'cuckoo-upright-freezer-133',
    label: '쿠쿠 스탠드 냉동고 133L (앞문형)',
    name: '냉동고',
    model: 'ELKR-AD1420MS',
    width_mm: null,
    height_mm: null,
    depth_mm: null,
    compartments: [
      { name: '상단 선반', zone: 'freezer', section: 'main', layout: { x: 0.05, y: 0.03, w: 0.9, h: 0.2 } },
      { name: '서랍 1', zone: 'freezer', section: 'main', layout: { x: 0.05, y: 0.26, w: 0.9, h: 0.22 } },
      { name: '서랍 2', zone: 'freezer', section: 'main', layout: { x: 0.05, y: 0.5, w: 0.9, h: 0.22 } },
      { name: '서랍 3', zone: 'freezer', section: 'main', layout: { x: 0.05, y: 0.74, w: 0.9, h: 0.22 } },
      { name: '문 포켓', zone: 'freezer', section: 'door-right', layout: { x: 0, y: 0.1, w: 1, h: 0.8 } },
    ],
  },
  {
    id: 'custom',
    label: '직접 구성 (빈 냉장고)',
    name: '새 냉장고',
    model: null,
    width_mm: null,
    height_mm: null,
    depth_mm: null,
    compartments: [
      { name: '냉장실', zone: 'fridge', section: 'main', layout: { x: 0, y: 0, w: 1, h: 0.6 } },
      { name: '냉동실', zone: 'freezer', section: 'main', layout: { x: 0, y: 0.6, w: 1, h: 0.4 } },
    ],
  },
]

export const ZONE_LABEL: Record<Zone, string> = {
  fridge: '냉장',
  freezer: '냉동',
  flex: '변온',
}
