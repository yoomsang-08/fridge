/** pantry: 실온 보관 (가상 팬트리) */
export type Zone = 'fridge' | 'freezer' | 'flex' | 'pantry'
export type ExpiryType = 'use_by' | 'sell_by'
/** 3D 모양용 용기. supabase/migrations/0007_categories.sql 의 check 와 같다 */
export type Container = 'bottle' | 'jar' | 'carton' | 'can' | 'tub' | 'box' | 'bag' | 'tray' | 'loose'
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
  /** 0007 마이그레이션 전 데이터나 체험 모드 예전 데이터에는 없을 수 있다 */
  container?: Container | null
  /** 식품안전나라 식품유형 원문 (예: 유탕면) */
  food_type?: string | null
  status: ItemStatus
  /** 넣은 사람(household_members.user_id) */
  created_by: string | null
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
> &
  // 있을 때만 보낸다
  Partial<Pick<Item, 'barcode' | 'container' | 'food_type'>>

export type NoteColor = 'yellow' | 'pink' | 'mint' | 'sky'

/** 냉장고 문에 붙이는 메모 */
export interface Note {
  id: string
  household_id: string
  body: string
  color: NoteColor
  author_id: string | null
  author_name: string | null
  /** 상대가 처음 본 시각. 아직 안 봤으면 null */
  read_at: string | null
  created_at: string
}

export type NoteInput = Pick<Note, 'body' | 'color'>

/** 냉장고 문에 붙인 사진 */
export interface FridgePhoto {
  id: string
  household_id: string
  /** 저장소 경로 '<household_id>/<파일>' */
  path: string
  width: number
  height: number
  author_id: string | null
  author_name: string | null
  created_at: string
  /** 화면에 띄울 주소 (서명된 URL 또는 data: URL) */
  url: string
}

/** 메모에 단 댓글 */
export interface NoteComment {
  id: string
  note_id: string
  household_id: string
  body: string
  author_id: string | null
  author_name: string | null
  created_at: string
}

/** 이 기기를 쓰는 사람 */
export interface Me {
  id: string
  name: string | null
}

/** 우리 집 식구 (같은 집 코드로 들어온 사람). 기기마다 계정이 달라 한 사람이 여러 줄일 수 있다 */
export interface Member extends Me {
  /** 이 기기에서 마지막으로 앱을 연 때 (0016 전이거나 기록 전이면 null) */
  lastSeenAt: string | null
  /** 기기 종류 (아이폰, Mac 등) */
  device: string | null
  joinedAt: string
}
