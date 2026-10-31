import { expiryLevel, type ExpiryLevel } from './expiry'
import { guessContainer } from './categories'
import type { Compartment, Container, Fridge, Item, Layout } from './types'

/**
 * 3D·2D 그림을 그리기 위한 냉장고 외형.
 * 칸 위치는 DB 의 compartment.layout(정면 기준 0~1 비율)을 그대로 쓰고,
 * 문 구성과 칸막이처럼 모델마다 다른 부분만 여기서 정한다.
 */

export interface DoorSpec {
  id: string
  label: string
  /** 정면 기준 0~1 비율 */
  rect: Layout
  /** 경첩 쪽. 손잡이는 반대편 */
  hinge: 'left' | 'right'
}

export interface Divider {
  /** h: 가로 칸막이(y 위치), v: 세로 칸막이(x 위치, y0~y1 구간) */
  dir: 'h' | 'v'
  at: number
  from: number
  to: number
}

export interface FridgeShape {
  /** mm */
  width: number
  height: number
  depth: number
  /** 문 두께(mm). 문 포켓이 들어가는 깊이 */
  doorDepth: number
  /** 몸체 색 */
  body: string
  /** 문 앞판 색과 재질. frame 은 문 옆면·테두리 색 */
  door: { color: string; metal: boolean; frame: string }
  /**
   * 손잡이 모양.
   * groove-h: 위아래 문이 만나는 곳의 가로 홈(비스포크)
   * edge-v: 경첩 반대쪽 옆면에 세로로 숨은 손잡이(쿠쿠)
   */
  handle: 'groove-h' | 'edge-v'
  /** 문 앞 표시창 위치(정면 기준 비율) */
  display?: Layout
  /** 문 없는 선반장(팬트리)의 나무 색. 있으면 안쪽·선반·바구니를 이 색으로 */
  wood?: { inner: string; board: string; basket: string }
  doors: DoorSpec[]
  dividers: Divider[]
  /**
   * 그림에만 쓰는 선반·서랍·문 포켓 자리(정면 기준 비율). 칸(compartment)은 냉장·냉동·김치냉장 같은 큰 구역 하나씩이고,
   * 그 안의 식품을 이 자리들에 나눠 놓아 실물처럼 보이게 한다. section: main(선반)·bin(서랍·바구니)·door-left/right(문 포켓)
   */
  slots?: Slot[]
  /** 실제 치수를 확인하지 못해 추정한 값인지 */
  estimated: boolean
}

export interface Slot {
  section: string
  layout: Layout
}

const shelfSlot = (y: number, h: number): Slot => ({ section: 'main', layout: { x: 0.03, y, w: 0.94, h } })
const pocketSlot = (side: 'left' | 'right', y: number): Slot => ({
  section: `door-${side}`,
  layout: { x: side === 'left' ? 0 : 0.5, y, w: 0.5, h: 0.09 },
})
/** 비스포크 하단 칸: 위 바스켓 + 서랍 2개 */
const lowerSlots = (side: 'left' | 'right'): Slot[] => {
  const x = side === 'left' ? 0.02 : 0.52
  return [
    { section: 'bin', layout: { x, y: 0.575, w: 0.46, h: 0.1 } },
    { section: 'bin', layout: { x, y: 0.685, w: 0.46, h: 0.14 } },
    { section: 'bin', layout: { x, y: 0.835, w: 0.46, h: 0.15 } },
  ]
}

const SHAPES: Record<string, Omit<FridgeShape, 'width' | 'height' | 'depth' | 'estimated'> & { size: [number, number, number] }> = {
  // 삼성 비스포크 4도어: 위 양문형 냉장실, 아래 왼쪽 냉동 · 오른쪽 맞춤보관
  // 제조사 사진 기준: 몸체 옆면은 짙은 차콜, 문 앞판은 밝은 패널(패널 선택형), 위 문이 전체 높이의 약 55%
  'samsung-rf85-4door': {
    size: [912, 1853, 930],
    doorDepth: 90,
    body: '#2e3034',
    door: { color: '#e6e6e2', metal: false, frame: '#2e3034' },
    handle: 'groove-h',
    doors: [
      { id: 'top-left', label: '냉장실 왼쪽 문', rect: { x: 0, y: 0, w: 0.5, h: 0.55 }, hinge: 'left' },
      { id: 'top-right', label: '냉장실 오른쪽 문', rect: { x: 0.5, y: 0, w: 0.5, h: 0.55 }, hinge: 'right' },
      { id: 'bottom-left', label: '냉동실 문', rect: { x: 0, y: 0.555, w: 0.5, h: 0.445 }, hinge: 'left' },
      { id: 'bottom-right', label: '맞춤보관실 문', rect: { x: 0.5, y: 0.555, w: 0.5, h: 0.445 }, hinge: 'right' },
    ],
    dividers: [
      { dir: 'h', at: 0.55, from: 0, to: 1 },
      { dir: 'v', at: 0.5, from: 0.55, to: 1 },
    ],
    // 제조사 사진 기준: 냉장 선반 3단 + 좌우 야채실, 아래 칸마다 바스켓 + 서랍 2개, 문마다 포켓 3개
    slots: [
      shelfSlot(0.02, 0.135),
      shelfSlot(0.165, 0.12),
      shelfSlot(0.295, 0.105),
      { section: 'bin', layout: { x: 0.03, y: 0.41, w: 0.44, h: 0.125 } },
      { section: 'bin', layout: { x: 0.53, y: 0.41, w: 0.44, h: 0.125 } },
      ...lowerSlots('left'),
      ...lowerSlots('right'),
      ...[0.06, 0.2, 0.42, 0.6, 0.73, 0.86].flatMap((y) => [pocketSlot('left', y), pocketSlot('right', y)]),
    ],
  },
  // 쿠쿠 133L 스탠드 냉동고: 앞문 하나, 손잡이 왼쪽(경첩 오른쪽).
  // 치수는 같은 133L 본체인 CKR-AD1410MS 공개 사양(515×1175×620mm)을 따름
  'cuckoo-upright-freezer-133': {
    size: [515, 1175, 620],
    doorDepth: 70,
    body: '#6d7176',
    door: { color: '#7d8186', metal: true, frame: '#5f6368' },
    handle: 'edge-v',
    display: { x: 0.43, y: 0.07, w: 0.12, h: 0.13 },
    doors: [{ id: 'main', label: '냉동고 문', rect: { x: 0, y: 0, w: 1, h: 1 }, hinge: 'right' }],
    dividers: [],
    // 선반 4단 + 맨 아래 서랍, 문 위쪽 포켓 하나
    slots: [
      ...[0.03, 0.22, 0.41].map((y) => ({ section: 'main', layout: { x: 0.04, y, w: 0.92, h: 0.18 } })),
      { section: 'main', layout: { x: 0.04, y: 0.6, w: 0.92, h: 0.17 } },
      { section: 'bin', layout: { x: 0.04, y: 0.79, w: 0.92, h: 0.18 } },
      { section: 'door-right', layout: { x: 0, y: 0.08, w: 1, h: 0.1 } },
    ],
  },
  // 가상의 팬트리: 문 없는 원목 오픈 선반장. 선반 4단 + 바닥 바구니 2개
  pantry: {
    size: [800, 1800, 400],
    doorDepth: 0,
    body: '#e6d7bf',
    door: { color: '#e6d7bf', metal: false, frame: '#e6d7bf' },
    handle: 'edge-v',
    wood: { inner: '#f3ebdd', board: '#d6c2a2', basket: '#dcd5c9' },
    doors: [],
    dividers: [],
  },
}

const FALLBACK = {
  size: [700, 1800, 700] as [number, number, number],
  doorDepth: 70,
  body: '#d9dde2',
  door: { color: '#eef0f2', metal: false, frame: '#c7ccd2' },
  handle: 'edge-v' as const,
  doors: [{ id: 'main', label: '문', rect: { x: 0, y: 0, w: 1, h: 1 }, hinge: 'left' as const }],
  dividers: [],
}

export function shapeOf(fridge: Fridge): FridgeShape {
  const s = (fridge.template && SHAPES[fridge.template]) || FALLBACK
  const known = fridge.width_mm && fridge.height_mm && fridge.depth_mm
  return {
    ...s,
    width: fridge.width_mm ?? s.size[0],
    height: fridge.height_mm ?? s.size[1],
    depth: fridge.depth_mm ?? s.size[2],
    estimated: !known,
  }
}

export const isDoorCompartment = (c: Compartment) => c.section.startsWith('door')

/** 서랍처럼 통으로 그릴 칸인지 (아니면 유리 선반) */
export const isBin = (c: Compartment) => /서랍|야채|바스켓|바구니/.test(c.name) || c.section === 'lower' || c.section === 'bin'

const center = (l: Layout) => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 })
const contains = (r: Layout, p: { x: number; y: number }) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

/** 칸이 속한 문. 문 포켓은 그 문에 붙고, 몸체 칸은 그 칸을 가리는 문 */
export function doorOf(shape: FridgeShape, c: Compartment): DoorSpec | undefined {
  if (!c.layout) return undefined
  const p = center(c.layout)
  if (isDoorCompartment(c) && shape.doors.length > 1) {
    // 문 포켓의 x 범위는 '어느 쪽 문인지'를 뜻하므로 section 을 우선한다
    const side = c.section === 'door-left' ? 'left' : c.section === 'door-right' ? 'right' : null
    const sameSide = shape.doors.filter((d) => contains(d.rect, p) && (!side || d.hinge === side))
    if (sameSide.length) return sameSide[0]
  }
  return shape.doors.find((d) => contains(d.rect, p)) ?? shape.doors[0]
}

const overlaps = (a: Layout, b: Layout) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** 그 문을 열어야 보이는 칸인지. 양문형 아래 선반처럼 문 두 개에 걸친 칸은 양쪽 다 해당 */
export function behindDoor(shape: FridgeShape, door: DoorSpec, c: Compartment): boolean {
  if (!c.layout) return false
  return isDoorCompartment(c) ? doorOf(shape, c)?.id === door.id : overlaps(door.rect, c.layout)
}

/**
 * 문 포켓 칸의 '문 안에서의' 위치(문 rect 기준 0~1).
 * 템플릿의 포켓 layout 은 냉장고 전체 기준 좌표라서 문 rect 로 다시 나눈다.
 */
export function pocketRectInDoor(door: DoorSpec, c: Compartment): Layout {
  const l = c.layout ?? { x: 0, y: 0, w: 1, h: 0.1 }
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const y = clamp((l.y - door.rect.y) / door.rect.h)
  const h = Math.min(1 - y, l.h / door.rect.h)
  return { x: 0.06, y, w: 0.88, h }
}

export const LEVEL_ORDER: ExpiryLevel[] = ['expired', 'urgent', 'soon', 'ok', 'none']

/** 기한이 급한 것부터 */
export function sortByUrgency(items: Item[]): Item[] {
  return [...items].sort(
    (a, b) =>
      LEVEL_ORDER.indexOf(expiryLevel(a.expiry_date)) - LEVEL_ORDER.indexOf(expiryLevel(b.expiry_date)) ||
      (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999'),
  )
}

/**
 * three.js 는 CSS 클래스를 못 쓰니 디자인 토큰(index.css 의 --color-*)을 실제 색 값으로 읽는다.
 * 변수가 아직 없으면(테스트 등) 토큰 기본값을 쓴다.
 */
const TOKEN_FALLBACK = {
  bg: '#f3f5f2',
  surface: '#ffffff',
  sunken: '#e8ece9',
  line: '#e3e8e4',
  ink: '#17201c',
  muted: '#66726c',
  accent: '#1e6b52',
  'accent-soft': '#e3f1ea',
  expired: '#c8372d',
  'expired-soft': '#fbe9e7',
  urgent: '#d2621b',
  'urgent-soft': '#fdf0e6',
  soon: '#a87a10',
  'soon-soft': '#fbf3dc',
  'note-yellow': '#fff1b8',
  'note-pink': '#fde0e3',
  'note-mint': '#dcf1e4',
  'note-sky': '#dceaf6',
} as const

export type Token = keyof typeof TOKEN_FALLBACK

export function token(name: Token): string {
  if (typeof document === 'undefined') return TOKEN_FALLBACK[name]
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
  return v || TOKEN_FALLBACK[name]
}

/** 기한 단계별 테두리 색 토큰. 여유·기한 없음은 테두리 없음 */
export const LEVEL_RING: Partial<Record<ExpiryLevel, Token>> = { expired: 'expired', urgent: 'urgent', soon: 'soon' }

/** categories 의 tint 클래스(bg-[#hex])에서 색 값만 꺼낸다 */
export function tintHex(tint: string): string {
  return tint.match(/#[0-9a-fA-F]{6}/)?.[0] ?? TOKEN_FALLBACK.sunken
}

export function itemsBy(items: Item[]): Map<string, Item[]> {
  const m = new Map<string, Item[]>()
  for (const i of items) {
    const list = m.get(i.compartment_id)
    if (list) list.push(i)
    else m.set(i.compartment_id, [i])
  }
  return m
}

/** 3D 에서 그릴 용기 모양. 달걀은 분류로 따로 그리는 달걀판 */
export type Shape3D = Container | 'egg'

const UNIT_CONTAINER: Record<string, Container> = { 병: 'bottle', 팩: 'carton', 통: 'tub', 봉지: 'bag' }
const CATEGORY_CONTAINER: Record<string, Container> = {
  meat: 'tray',
  seafood: 'tray',
  vegetable: 'loose',
  fruit: 'loose',
  dairy: 'carton',
  side: 'tub',
  sauce: 'bottle',
  drink: 'bottle',
  frozen: 'bag',
  processed: 'box',
}

/** 고른 용기 → 이름으로 짐작 → 단위 → 분류 순. 달걀은 상자로 골랐거나 안 골랐으면 달걀판 */
export function shapeOfItem(item: Item): Shape3D {
  const picked = item.container ?? null
  if (item.category === 'egg' && (!picked || picked === 'box')) return 'egg'
  return picked ?? guessContainer(item.name, item.unit) ?? UNIT_CONTAINER[item.unit] ?? CATEGORY_CONTAINER[item.category] ?? 'box'
}

/**
 * 팬트리는 가상의 공간이라 모자라면 안 된다. 칸 하나에 식품이 많으면 선반장을 옆으로 늘린다.
 * 한 베이(800mm) 선반에 8개쯤이 보기 좋은 양. 넘치면 베이를 하나 더 붙이고(폰 화면을 생각해 최대 2베이), 그 뒤로는 식품을 작게 줄여 다 채운다
 */
export function fitPantry(shape: FridgeShape, perCompartment: number[]): FridgeShape {
  if (!shape.wood) return shape
  const most = Math.max(0, ...perCompartment)
  const bays = most > 8 ? 2 : 1
  return bays === 1 ? shape : { ...shape, width: shape.width * bays }
}

/** 그림용 자리 id(`칸id#번호`)에서 실제 칸 id */
export const baseId = (id: string) => id.split('#')[0]

/** 문 포켓에 먼저 꽂을 모양 */
const DOOR_FRIENDLY = new Set<Shape3D>(['bottle', 'carton', 'jar', 'can'])
const POCKET_CAP = 4

/**
 * 큰 구역 칸(section 'zone')을 그림용 자리들로 펼친다. 구역 안의 선반·서랍·포켓 자리마다 가짜 칸(`id#n`)을 만들고
 * 식품을 고르게 나눠 담는다(병·팩·캔은 문 포켓부터). 자리가 없는 모델이나 예전 세부 칸은 그대로 둔다.
 * 고르기·하이라이트는 baseId 로 원래 칸에 묶는다
 */
export function expandSlots(
  shape: FridgeShape,
  compartments: Compartment[],
  byComp: Map<string, Item[]>,
): { compartments: Compartment[]; itemsByCompartment: Map<string, Item[]> } {
  if (!shape.slots?.length) return { compartments, itemsByCompartment: byComp }
  const out: Compartment[] = []
  const items = new Map(byComp)
  for (const c of compartments) {
    const zone = c.layout
    if (!zone || c.section !== 'zone') {
      out.push(c)
      continue
    }
    const inZone = shape.slots.filter((s) => contains(zone, center(s.layout)))
    const body = inZone.filter((s) => !s.section.startsWith('door'))
    if (!body.length) {
      out.push(c)
      continue
    }
    const pockets = inZone.filter((s) => s.section.startsWith('door'))
    const slots = [...body, ...pockets]
    const bags: Item[][] = slots.map(() => [])
    const least = (from: number, to: number, cap = Infinity) => {
      let best = -1
      for (let i = from; i < to; i++) if (bags[i].length < cap && (best < 0 || bags[i].length < bags[best].length)) best = i
      return best
    }
    for (const it of sortByUrgency(byComp.get(c.id) ?? [])) {
      const pocket = pockets.length && DOOR_FRIENDLY.has(shapeOfItem(it)) ? least(body.length, slots.length, POCKET_CAP) : -1
      bags[pocket >= 0 ? pocket : least(0, body.length)].push(it)
    }
    slots.forEach((s, i) => {
      const id = `${c.id}#${i}`
      // 이름표는 구역의 첫 자리와 첫 문 포켓에만 (예: 냉장실). 아래 문 포켓이 어느 구역인지 보이게
      out.push({ ...c, id, name: i === 0 || i === body.length ? c.name : '', section: s.section, layout: s.layout })
      items.set(id, bags[i])
    })
  }
  return { compartments: out, itemsByCompartment: items }
}
