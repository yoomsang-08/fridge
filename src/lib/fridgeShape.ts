import { expiryLevel, type ExpiryLevel } from './expiry'
import type { Compartment, Fridge, Item, Layout } from './types'

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
  /** 문 색과 재질 */
  door: { color: string; metal: boolean }
  doors: DoorSpec[]
  dividers: Divider[]
  /** 실제 치수를 확인하지 못해 추정한 값인지 */
  estimated: boolean
}

const SHAPES: Record<string, Omit<FridgeShape, 'width' | 'height' | 'depth' | 'estimated'> & { size: [number, number, number] }> = {
  // 삼성 비스포크 4도어: 위 양문형 냉장실, 아래 왼쪽 냉동 · 오른쪽 맞춤보관
  'samsung-rf85-4door': {
    size: [912, 1853, 930],
    doorDepth: 90,
    body: '#d9dde2',
    door: { color: '#ece8e1', metal: false },
    doors: [
      { id: 'top-left', label: '냉장실 왼쪽 문', rect: { x: 0, y: 0, w: 0.5, h: 0.6 }, hinge: 'left' },
      { id: 'top-right', label: '냉장실 오른쪽 문', rect: { x: 0.5, y: 0, w: 0.5, h: 0.6 }, hinge: 'right' },
      { id: 'bottom-left', label: '냉동실 문', rect: { x: 0, y: 0.605, w: 0.5, h: 0.395 }, hinge: 'left' },
      { id: 'bottom-right', label: '맞춤보관실 문', rect: { x: 0.5, y: 0.605, w: 0.5, h: 0.395 }, hinge: 'right' },
    ],
    dividers: [
      { dir: 'h', at: 0.6, from: 0, to: 1 },
      { dir: 'v', at: 0.5, from: 0.6, to: 1 },
    ],
  },
  // 쿠쿠 133L 스탠드 냉동고: 앞문 하나, 손잡이 왼쪽(경첩 오른쪽). 치수는 추정
  'cuckoo-upright-freezer-133': {
    size: [550, 1120, 600],
    doorDepth: 70,
    body: '#b8bcc1',
    door: { color: '#c3c7cc', metal: true },
    doors: [{ id: 'main', label: '냉동고 문', rect: { x: 0, y: 0, w: 1, h: 1 }, hinge: 'right' }],
    dividers: [],
  },
}

const FALLBACK = {
  size: [700, 1800, 700] as [number, number, number],
  doorDepth: 70,
  body: '#d9dde2',
  door: { color: '#eef0f2', metal: false },
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
export const isBin = (c: Compartment) => c.name.includes('서랍') || c.section === 'lower'

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

/** 3D·2D 공용 색 */
export const LEVEL_COLOR: Record<ExpiryLevel, string> = {
  expired: '#dc2626',
  urgent: '#f97316',
  soon: '#fbbf24',
  ok: '#ffffff',
  none: '#e2e8f0',
}

export const CATEGORY_COLOR: Record<string, string> = {
  vegetable: '#86efac',
  fruit: '#fca5a5',
  meat: '#fda4af',
  seafood: '#93c5fd',
  dairy: '#f1f5f9',
  egg: '#fde68a',
  side: '#d9f99d',
  sauce: '#fdba74',
  drink: '#a5f3fc',
  frozen: '#bae6fd',
  processed: '#e9d5ff',
  etc: '#e2e8f0',
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
