import type { SupabaseClient } from '@supabase/supabase-js'
import type { Compartment, Fridge, Household, Item, ItemInput, Zone } from './types'
import type { FridgeTemplate } from './templates'

export interface Snapshot {
  fridges: Fridge[]
  compartments: Compartment[]
  items: Item[]
  /** 최근에 넣었던 식품(다 먹은 것 포함): 입력 자동완성용 */
  history: Item[]
}

export type ItemAction = 'use' | 'consume' | 'discard'

export interface Repo {
  load(): Promise<Snapshot>
  addFridge(template: FridgeTemplate, name: string): Promise<void>
  renameFridge(id: string, name: string): Promise<void>
  deleteFridge(id: string): Promise<void>
  addCompartment(fridgeId: string, name: string, zone: Zone): Promise<void>
  renameCompartment(id: string, name: string): Promise<void>
  deleteCompartment(id: string): Promise<void>
  addItem(input: ItemInput): Promise<void>
  updateItem(id: string, patch: Partial<ItemInput>): Promise<void>
  deleteItem(id: string): Promise<void>
  /** use: 1 만큼 사용, consume: 다 먹음, discard: 버림 */
  act(item: Item, action: ItemAction): Promise<void>
  /** 다른 기기에서 바뀌면 호출. 반환값은 구독 해제 */
  subscribe(onChange: () => void): () => void
}

function nextAfterAction(item: Item, action: ItemAction): Partial<Item> {
  if (action === 'use' && item.quantity > 1) return { quantity: item.quantity - 1 }
  return { status: action === 'discard' ? 'discarded' : 'consumed' }
}

// ---------- Supabase ----------

export function createSupabaseRepo(sb: SupabaseClient, household: Household): Repo {
  const hid = household.id
  const check = <T extends { error: unknown }>(r: T): T => {
    if (r.error) throw r.error
    return r
  }

  return {
    async load() {
      const [f, c, i, h] = await Promise.all([
        sb.from('fridges').select('*').eq('household_id', hid).order('sort_order').order('created_at'),
        sb.from('compartments').select('*').eq('household_id', hid).order('sort_order'),
        sb.from('items').select('*').eq('household_id', hid).eq('status', 'active'),
        sb.from('items').select('*').eq('household_id', hid).order('created_at', { ascending: false }).limit(300),
      ])
      return {
        fridges: check(f).data as Fridge[],
        compartments: check(c).data as Compartment[],
        items: check(i).data as Item[],
        history: check(h).data as Item[],
      }
    },
    async addFridge(t, name) {
      const { data } = check(
        await sb
          .from('fridges')
          .insert({
            household_id: hid,
            name,
            model: t.model,
            template: t.id,
            width_mm: t.width_mm,
            height_mm: t.height_mm,
            depth_mm: t.depth_mm,
          })
          .select()
          .single(),
      )
      check(
        await sb.from('compartments').insert(
          t.compartments.map((c, idx) => ({ ...c, household_id: hid, fridge_id: data.id, sort_order: idx })),
        ),
      )
    },
    async renameFridge(id, name) {
      check(await sb.from('fridges').update({ name }).eq('id', id))
    },
    async deleteFridge(id) {
      check(await sb.from('fridges').delete().eq('id', id))
    },
    async addCompartment(fridgeId, name, zone) {
      check(
        await sb
          .from('compartments')
          .insert({ household_id: hid, fridge_id: fridgeId, name, zone, sort_order: 999 }),
      )
    },
    async renameCompartment(id, name) {
      check(await sb.from('compartments').update({ name }).eq('id', id))
    },
    async deleteCompartment(id) {
      check(await sb.from('compartments').delete().eq('id', id))
    },
    async addItem(input) {
      const { data } = check(await sb.from('items').insert({ ...input, household_id: hid }).select().single())
      await sb.from('item_logs').insert({ household_id: hid, item_id: data.id, action: 'add', quantity_delta: input.quantity })
    },
    async updateItem(id, patch) {
      check(await sb.from('items').update(patch).eq('id', id))
    },
    async deleteItem(id) {
      check(await sb.from('items').delete().eq('id', id))
    },
    async act(item, action) {
      check(await sb.from('items').update(nextAfterAction(item, action)).eq('id', item.id))
      await sb.from('item_logs').insert({
        household_id: hid,
        item_id: item.id,
        action,
        quantity_delta: action === 'use' ? -1 : -item.quantity,
      })
    },
    subscribe(onChange) {
      const channel = sb.channel(`household-${hid}`)
      for (const table of ['fridges', 'compartments', 'items']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${hid}` }, onChange)
      }
      channel.subscribe()
      return () => {
        sb.removeChannel(channel)
      }
    },
  }
}

// ---------- 체험 모드 (이 기기 localStorage) ----------

const LOCAL_KEY = 'fridge-demo-v1'
const LOCAL_HID = 'local'

export const LOCAL_HOUSEHOLD: Household = { id: LOCAL_HID, name: '우리 집 (체험 모드)', invite_code: '-' }

export function createLocalRepo(): Repo {
  type Stored = Omit<Snapshot, 'history'>
  const read = (): Stored => {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : { fridges: [], compartments: [], items: [] }
  }
  const write = (s: Stored) => localStorage.setItem(LOCAL_KEY, JSON.stringify(s))
  const mutate = async (fn: (s: Stored) => void) => {
    const s = read()
    fn(s)
    write(s)
  }
  const id = () => crypto.randomUUID()
  const now = () => new Date().toISOString()

  return {
    async load() {
      const s = read()
      const history = [...s.items].sort((a, b) => b.created_at.localeCompare(a.created_at))
      return { ...s, items: s.items.filter((i) => i.status === 'active'), history }
    },
    addFridge: (t, name) =>
      mutate((s) => {
        const fridgeId = id()
        s.fridges.push({
          id: fridgeId,
          household_id: LOCAL_HID,
          name,
          model: t.model,
          template: t.id,
          width_mm: t.width_mm,
          height_mm: t.height_mm,
          depth_mm: t.depth_mm,
          sort_order: s.fridges.length,
        })
        t.compartments.forEach((c, idx) =>
          s.compartments.push({ ...c, id: id(), household_id: LOCAL_HID, fridge_id: fridgeId, sort_order: idx }),
        )
      }),
    renameFridge: (fid, name) =>
      mutate((s) => {
        s.fridges = s.fridges.map((f) => (f.id === fid ? { ...f, name } : f))
      }),
    deleteFridge: (fid) =>
      mutate((s) => {
        const gone = new Set(s.compartments.filter((c) => c.fridge_id === fid).map((c) => c.id))
        s.fridges = s.fridges.filter((f) => f.id !== fid)
        s.compartments = s.compartments.filter((c) => !gone.has(c.id))
        s.items = s.items.filter((i) => !gone.has(i.compartment_id))
      }),
    addCompartment: (fridgeId, name, zone) =>
      mutate((s) => {
        s.compartments.push({
          id: id(),
          household_id: LOCAL_HID,
          fridge_id: fridgeId,
          name,
          zone,
          section: 'main',
          layout: null,
          sort_order: 999,
        })
      }),
    renameCompartment: (cid, name) =>
      mutate((s) => {
        s.compartments = s.compartments.map((c) => (c.id === cid ? { ...c, name } : c))
      }),
    deleteCompartment: (cid) =>
      mutate((s) => {
        s.compartments = s.compartments.filter((c) => c.id !== cid)
        s.items = s.items.filter((i) => i.compartment_id !== cid)
      }),
    addItem: (input) =>
      mutate((s) => {
        s.items.push({
          ...input,
          id: id(),
          household_id: LOCAL_HID,
          purchased_on: null,
          barcode: null,
          status: 'active',
          created_at: now(),
          updated_at: now(),
        })
      }),
    updateItem: (iid, patch) =>
      mutate((s) => {
        s.items = s.items.map((i) => (i.id === iid ? { ...i, ...patch, updated_at: now() } : i))
      }),
    deleteItem: (iid) =>
      mutate((s) => {
        s.items = s.items.filter((i) => i.id !== iid)
      }),
    act: (item, action) =>
      mutate((s) => {
        s.items = s.items.map((i) => (i.id === item.id ? { ...i, ...nextAfterAction(i, action), updated_at: now() } : i))
      }),
    subscribe(onChange) {
      // 같은 브라우저의 다른 탭에서 바뀐 경우
      const handler = (e: StorageEvent) => e.key === LOCAL_KEY && onChange()
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}
