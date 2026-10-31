export type Zone = 'fridge' | 'freezer' | 'flex'
export type ExpiryType = 'use_by' | 'sell_by'
export type ItemStatus = 'active' | 'consumed' | 'discarded'

/** 정면 기준 좌표, 냉장고 전체를 0~1 로 본 비율 */
export interface Layout {
  x: number
  y: number
  w: number
  h: number
}

export interface Household {
  id: string
  name: string
  invite_code: string
}

export interface Fridge {
  id: string
  household_id: string
  name: string
  model: string | null
  template: string | null
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  sort_order: number
}

export interface Compartment {
  id: string
  household_id: string
  fridge_id: string
  name: string
  zone: Zone
  section: string
  layout: Layout | null
  sort_order: number
}

export interface Item {
  id: string
  household_id: string
  compartment_id: string
  name: string
  category: string
  quantity: number
  unit: string
  expiry_date: string | null
  expiry_type: ExpiryType
  purchased_on: string | null
  opened: boolean
  memo: string | null
  barcode: string | null
  status: ItemStatus
  created_at: string
  updated_at: string
}

export type ItemInput = Pick<
  Item,
  | 'compartment_id'
  | 'name'
  | 'category'
  | 'quantity'
  | 'unit'
  | 'expiry_date'
  | 'expiry_type'
  | 'opened'
  | 'memo'
>
