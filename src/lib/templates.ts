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

// 칸은 냉장·냉동·김치냉장 같은 큰 구역만 둔다(세부 선반·서랍·포켓은 fridgeShape 의 slots 로 그림에서만 나눈다).
// layout 은 정면 기준 비율, section 'zone' 은 '그림에서 자리로 펼칠 큰 구역'이라는 표시

const zone = (name: string, z: Zone, layout: Layout): CompartmentTemplate => ({ name, zone: z, section: 'zone', layout })

export const FRIDGE_TEMPLATES: FridgeTemplate[] = [
  {
    // 위 양문 냉장실(높이 55%), 아래 여닫이 두 칸(왼쪽 냉동, 오른쪽 맞춤보관실을 김치냉장으로 씀)
    id: 'samsung-rf85-4door',
    label: '삼성 비스포크 4도어 (RF85 계열)',
    name: '메인 냉장고',
    model: 'RF85DB90F1AP',
    width_mm: 912,
    height_mm: 1853,
    depth_mm: 930,
    compartments: [
      zone('냉장실', 'fridge', { x: 0, y: 0, w: 1, h: 0.55 }),
      zone('냉동실', 'freezer', { x: 0, y: 0.555, w: 0.5, h: 0.445 }),
      zone('김치냉장실', 'flex', { x: 0.5, y: 0.555, w: 0.5, h: 0.445 }),
    ],
  },
  {
    // 앞문 하나(경첩 오른쪽, 손잡이 왼쪽). 냉동 구역 하나.
    // 치수는 같은 133L 본체인 CKR-AD1410MS 공개 사양
    id: 'cuckoo-upright-freezer-133',
    label: '쿠쿠 스탠드 냉동고 133L (앞문형)',
    name: '냉동고',
    model: 'ELKR-AD1420MS',
    width_mm: 515,
    height_mm: 1175,
    depth_mm: 620,
    compartments: [zone('냉동실', 'freezer', { x: 0, y: 0, w: 1, h: 1 })],
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
  // 비스포크 맞춤보관실을 김치냉장으로 쓴다
  flex: '김치냉장',
  pantry: '실온',
}
