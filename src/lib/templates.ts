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

// 칸 위치는 제조사 제품 사진(문 열린 정면)을 보고 잡은 정면 기준 비율

const shelf = (n: number, y: number, h: number): CompartmentTemplate => ({
  name: `냉장 선반 ${n}단`,
  zone: 'fridge',
  section: 'main',
  layout: { x: 0.03, y, w: 0.94, h },
})

/** 문 포켓. section 의 left/right 는 경첩 쪽(=어느 문인지) */
const pocket = (door: string, side: 'left' | 'right', zone: Zone, n: number, y: number): CompartmentTemplate => ({
  name: `${door} 문 포켓 ${n}`,
  zone,
  section: `door-${side}`,
  layout: { x: side === 'left' ? 0 : 0.5, y, w: 0.5, h: 0.09 },
})

/** 비스포크 하단 칸: 위 바스켓 + 서랍 2개 */
const lower = (label: string, side: 'left' | 'right', zone: Zone): CompartmentTemplate[] => {
  const x = side === 'left' ? 0.02 : 0.52
  return [
    { name: `${label} 상단 바스켓`, zone, section: 'lower', layout: { x, y: 0.575, w: 0.46, h: 0.1 } },
    { name: `${label} 서랍 1`, zone, section: 'lower', layout: { x, y: 0.685, w: 0.46, h: 0.14 } },
    { name: `${label} 서랍 2`, zone, section: 'lower', layout: { x, y: 0.835, w: 0.46, h: 0.15 } },
  ]
}

export const FRIDGE_TEMPLATES: FridgeTemplate[] = [
  {
    // 위 양문 냉장실(높이 55%), 아래 여닫이 두 칸(왼쪽 냉동, 오른쪽 맞춤보관). 문마다 포켓 3개
    id: 'samsung-rf85-4door',
    label: '삼성 비스포크 4도어 (RF85 계열)',
    name: '메인 냉장고',
    model: 'RF85DB90F1AP',
    width_mm: 912,
    height_mm: 1853,
    depth_mm: 930,
    compartments: [
      shelf(1, 0.02, 0.135),
      shelf(2, 0.165, 0.12),
      shelf(3, 0.295, 0.105),
      { name: '왼쪽 야채실', zone: 'fridge', section: 'main', layout: { x: 0.03, y: 0.41, w: 0.44, h: 0.125 } },
      { name: '오른쪽 야채실', zone: 'fridge', section: 'main', layout: { x: 0.53, y: 0.41, w: 0.44, h: 0.125 } },
      pocket('냉장실 왼쪽', 'left', 'fridge', 1, 0.06),
      pocket('냉장실 왼쪽', 'left', 'fridge', 2, 0.2),
      pocket('냉장실 왼쪽', 'left', 'fridge', 3, 0.42),
      pocket('냉장실 오른쪽', 'right', 'fridge', 1, 0.06),
      pocket('냉장실 오른쪽', 'right', 'fridge', 2, 0.2),
      pocket('냉장실 오른쪽', 'right', 'fridge', 3, 0.42),
      ...lower('냉동실', 'left', 'freezer'),
      ...lower('맞춤보관실', 'right', 'flex'),
      pocket('냉동실', 'left', 'freezer', 1, 0.6),
      pocket('냉동실', 'left', 'freezer', 2, 0.73),
      pocket('냉동실', 'left', 'freezer', 3, 0.86),
      pocket('맞춤보관실', 'right', 'flex', 1, 0.6),
      pocket('맞춤보관실', 'right', 'flex', 2, 0.73),
      pocket('맞춤보관실', 'right', 'flex', 3, 0.86),
    ],
  },
  {
    // 앞문 하나(경첩 오른쪽, 손잡이 왼쪽). 선반 4단 + 맨 아래 서랍, 문 위쪽에 포켓 하나.
    // 치수는 같은 133L 본체인 CKR-AD1410MS 공개 사양
    id: 'cuckoo-upright-freezer-133',
    label: '쿠쿠 스탠드 냉동고 133L (앞문형)',
    name: '냉동고',
    model: 'ELKR-AD1420MS',
    width_mm: 515,
    height_mm: 1175,
    depth_mm: 620,
    compartments: [
      { name: '1단 (맨 위)', zone: 'freezer', section: 'main', layout: { x: 0.04, y: 0.03, w: 0.92, h: 0.18 } },
      { name: '2단', zone: 'freezer', section: 'main', layout: { x: 0.04, y: 0.22, w: 0.92, h: 0.18 } },
      { name: '3단', zone: 'freezer', section: 'main', layout: { x: 0.04, y: 0.41, w: 0.92, h: 0.18 } },
      { name: '4단', zone: 'freezer', section: 'main', layout: { x: 0.04, y: 0.6, w: 0.92, h: 0.17 } },
      { name: '하단 서랍', zone: 'freezer', section: 'main', layout: { x: 0.04, y: 0.79, w: 0.92, h: 0.18 } },
      { name: '문 포켓', zone: 'freezer', section: 'door-right', layout: { x: 0, y: 0.08, w: 1, h: 0.1 } },
    ],
  },
  {
    // 실온 보관용 가상 팬트리: 문 없는 선반장. 선반 4단 + 맨 아래 바구니 2개
    id: 'pantry',
    label: '팬트리(실온 선반)',
    name: '팬트리',
    model: null,
    width_mm: 800,
    height_mm: 1800,
    depth_mm: 400,
    compartments: [
      ...[0.02, 0.22, 0.42, 0.62].map((y, i) => ({
        name: `선반 ${i + 1}단`,
        zone: 'pantry' as const,
        section: 'shelf',
        layout: { x: 0.04, y, w: 0.92, h: 0.18 },
      })),
      { name: '왼쪽 바구니', zone: 'pantry', section: 'basket', layout: { x: 0.04, y: 0.82, w: 0.44, h: 0.16 } },
      { name: '오른쪽 바구니', zone: 'pantry', section: 'basket', layout: { x: 0.52, y: 0.82, w: 0.44, h: 0.16 } },
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
  pantry: '실온',
}
