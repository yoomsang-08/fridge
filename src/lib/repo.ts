import type { SupabaseClient } from '@supabase/supabase-js'
import { hashtagsOf } from './notes'
import { blobToDataUrl, PHOTO_LIMIT, preparePhoto } from './photos'
import type { Compartment, Fridge, Household, FridgePhoto, Item, ItemInput, Me, Member, Note, NoteComment, NoteInput, Zone } from './types'
import type { FridgeTemplate } from './templates'
import { DEFAULT_CATEGORIES, getCategories, setCategories, type Category, type CategoryDays } from './categories'

export interface Snapshot {
  fridges: Fridge[]
  compartments: Compartment[]
  items: Item[]
  /** 최근에 넣었던 식품(다 먹은 것 포함): 입력 자동완성용 */
  history: Item[]
  /** 냉장고 문 메모, 최근 것부터 */
  notes: Note[]
  /** 메모 댓글, 오래된 것부터 */
  comments: NoteComment[]
  /** 냉장고 문 사진, 최근 것부터 */
  photos: FridgePhoto[]
  me: Me
  /** 우리 집 식구들. 나도 포함 */
  members: Member[]
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
  addNote(input: NoteInput): Promise<void>
  /** 냉장고 문에서 떼기 */
  deleteNote(id: string): Promise<void>
  /** 뗀 메모 되돌리기: 같은 메모와 댓글을 그대로 다시 붙인다 */
  restoreNote(note: Note, comments: NoteComment[]): Promise<void>
  addComment(noteId: string, body: string): Promise<void>
  /** 내가 단 댓글 지우기 */
  deleteComment(id: string): Promise<void>
  /** 사진 붙이기: 줄여서 올린다. 10장이 넘으면 'photo_limit' 오류 */
  addPhoto(file: File): Promise<void>
  /** 사진 떼기: 파일까지 지운다 */
  deletePhoto(photo: FridgePhoto): Promise<void>
  /** 상대가 남긴 메모를 봤다고 표시 */
  markNotesRead(ids: string[]): Promise<void>
  /** 이 기기를 쓰는 사람의 이름 바꾸기 */
  renameMe(name: string): Promise<void>
  /** 분류별 자동 기한(일) 바꾸기. null 이면 그 보관 위치에서는 자동으로 안 채움 */
  setCategoryDays(id: string, days: CategoryDays): Promise<void>
  /** 다른 기기에서 바뀌면 호출. 반환값은 구독 해제 */
  subscribe(onChange: () => void): () => void
}

function nextAfterAction(item: Item, action: ItemAction): Partial<Item> {
  if (action === 'use' && item.quantity > 1) return { quantity: item.quantity - 1 }
  return { status: action === 'discard' ? 'discarded' : 'consumed' }
}

// ---------- Supabase ----------

const PHOTO_BUCKET = 'fridge-photos'

export function createSupabaseRepo(sb: SupabaseClient, household: Household): Repo {
  const hid = household.id
  const check = <T extends { error: unknown }>(r: T): T => {
    if (r.error) throw r.error
    return r
  }

  // 비공개 버킷이라 서명된 주소로 띄운다. 새로 불러올 때마다 주소가 바뀌어 깜빡이지 않게 기억해 둔다
  const signed = new Map<string, { url: string; until: number }>()
  const SIGN_SECONDS = 6 * 3600
  const signPhotos = async (rows: Omit<FridgePhoto, 'url'>[]): Promise<FridgePhoto[]> => {
    const fresh = Date.now() + 10 * 60 * 1000
    const need = rows.filter((r) => (signed.get(r.path)?.until ?? 0) < fresh).map((r) => r.path)
    if (need.length) {
      const { data } = await sb.storage.from(PHOTO_BUCKET).createSignedUrls(need, SIGN_SECONDS)
      for (const d of data ?? []) {
        if (d.path && d.signedUrl) signed.set(d.path, { url: d.signedUrl, until: Date.now() + SIGN_SECONDS * 1000 })
      }
    }
    return rows.filter((r) => signed.has(r.path)).map((r) => ({ ...r, url: signed.get(r.path)!.url }))
  }

  return {
    async load() {
      const { data: auth } = await sb.auth.getSession()
      const uid = auth.session?.user.id ?? ''
      const [f, c, i, h, n, m, k, nc, ph] = await Promise.all([
        sb.from('fridges').select('*').eq('household_id', hid).order('sort_order').order('created_at'),
        sb.from('compartments').select('*').eq('household_id', hid).order('sort_order'),
        sb.from('items').select('*').eq('household_id', hid).eq('status', 'active'),
        sb.from('items').select('*').eq('household_id', hid).order('created_at', { ascending: false }).limit(300),
        sb.from('notes').select('*').eq('household_id', hid).order('created_at', { ascending: false }).limit(100),
        sb.from('household_members').select('user_id, display_name').eq('household_id', hid).order('created_at'),
        sb.from('categories').select('*').eq('household_id', hid).order('sort_order'),
        sb.from('note_comments').select('*').eq('household_id', hid).order('created_at').limit(500),
        sb.from('fridge_photos').select('*').eq('household_id', hid).order('created_at', { ascending: false }).limit(PHOTO_LIMIT),
      ])
      // 0007 마이그레이션 전이면 테이블이 없으니 기본 분류로
      setCategories((k.data as Category[] | null) ?? DEFAULT_CATEGORIES)
      const members: Member[] = (check(m).data ?? []).map((r) => ({ id: r.user_id, name: r.display_name || null }))
      return {
        fridges: check(f).data as Fridge[],
        compartments: check(c).data as Compartment[],
        items: check(i).data as Item[],
        history: check(h).data as Item[],
        // 메모 테이블을 아직 만들지 않았어도 나머지 화면은 열리게
        notes: (n.data ?? []) as Note[],
        // 0008 마이그레이션 전이면 댓글 없이
        comments: (nc.data ?? []) as NoteComment[],
        // 0011 마이그레이션 전이면 사진 없이
        photos: await signPhotos((ph.data ?? []) as Omit<FridgePhoto, 'url'>[]),
        me: members.find((x) => x.id === uid) ?? { id: uid, name: null },
        members,
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
    async addNote(input) {
      const { data: auth } = await sb.auth.getSession()
      const uid = auth.session?.user.id
      const { data: m } = await sb
        .from('household_members')
        .select('display_name')
        .eq('household_id', hid)
        .eq('user_id', uid ?? '')
        .maybeSingle()
      const { data: note } = check(
        await sb
          .from('notes')
          .insert({ ...input, household_id: hid, author_name: m?.display_name || null })
          .select('id')
          .single(),
      )
      // #이름 이 있으면 그 식구 폰으로 알림. 알림이 안 가도 메모는 붙어 있으니 기다리지 않는다
      if (hashtagsOf(input.body).length > 0) {
        sb.functions.invoke('note-notify', { body: { note_id: note!.id } }).catch(() => {})
      }
    },
    async deleteNote(id) {
      check(await sb.from('notes').delete().eq('id', id))
    },
    async restoreNote(note, comments) {
      check(await sb.from('notes').insert(note))
      if (comments.length) await sb.from('note_comments').insert(comments)
    },
    async addComment(noteId, body) {
      const { data: auth } = await sb.auth.getSession()
      const uid = auth.session?.user.id
      const { data: m } = await sb
        .from('household_members')
        .select('display_name')
        .eq('household_id', hid)
        .eq('user_id', uid ?? '')
        .maybeSingle()
      const { data: c } = check(
        await sb
          .from('note_comments')
          .insert({ note_id: noteId, household_id: hid, body, author_name: m?.display_name || null })
          .select('id')
          .single(),
      )
      // 메모 쓴 사람(과 앞서 댓글 단 식구)에게 알림. 기다리지 않는다
      sb.functions.invoke('note-notify', { body: { comment_id: c!.id } }).catch(() => {})
    },
    async deleteComment(id) {
      check(await sb.from('note_comments').delete().eq('id', id))
    },
    async addPhoto(file) {
      const { count } = await sb.from('fridge_photos').select('id', { count: 'exact', head: true }).eq('household_id', hid)
      if ((count ?? 0) >= PHOTO_LIMIT) throw new Error('photo_limit')
      const { blob, width, height } = await preparePhoto(file)
      const path = `${hid}/${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`
      check(await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' }))
      const { data: auth } = await sb.auth.getSession()
      const { data: m } = await sb
        .from('household_members')
        .select('display_name')
        .eq('household_id', hid)
        .eq('user_id', auth.session?.user.id ?? '')
        .maybeSingle()
      const r = await sb.from('fridge_photos').insert({ household_id: hid, path, width, height, author_name: m?.display_name || null })
      if (r.error) {
        // 목록에 못 붙였으면 올린 파일도 치운다 (10장 제한에 걸린 경우 등)
        await sb.storage.from(PHOTO_BUCKET).remove([path])
        throw r.error.message.includes('fridge_photos_limit') ? new Error('photo_limit') : r.error
      }
    },
    async deletePhoto(photo) {
      check(await sb.from('fridge_photos').delete().eq('id', photo.id))
      await sb.storage.from(PHOTO_BUCKET).remove([photo.path])
      signed.delete(photo.path)
    },
    async renameMe(name) {
      const { data: auth } = await sb.auth.getSession()
      const uid = auth.session?.user.id ?? ''
      check(await sb.from('household_members').update({ display_name: name }).eq('household_id', hid).eq('user_id', uid))
    },
    async setCategoryDays(id, days) {
      check(await sb.from('categories').update({ ...days, days_set: true }).eq('household_id', hid).eq('id', id))
      setCategories(getCategories().map((c) => (c.id === id ? { ...c, ...days } : c)))
    },
    async markNotesRead(ids) {
      if (ids.length === 0) return
      check(await sb.from('notes').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null))
    },
    subscribe(onChange) {
      // 한꺼번에 여러 줄이 바뀌어도(냉장고 추가 등) 한 번만 다시 불러온다
      let timer: ReturnType<typeof setTimeout> | undefined
      const changed = () => {
        clearTimeout(timer)
        timer = setTimeout(onChange, 250)
      }
      const channel = sb.channel(`household-${hid}`)
      for (const table of ['fridges', 'compartments', 'items', 'notes', 'note_comments', 'fridge_photos']) {
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `household_id=eq.${hid}` }, changed)
        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `household_id=eq.${hid}` }, changed)
        // 삭제는 Supabase 가 필터를 지원하지 않아(id 만 온다) 필터 없이 받는다
        channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, changed)
      }
      channel.subscribe()
      return () => {
        clearTimeout(timer)
        sb.removeChannel(channel)
      }
    },
  }
}

// ---------- 체험 모드 (이 기기 localStorage) ----------

const LOCAL_KEY = 'fridge-demo-v1'
const LOCAL_HID = 'local'

export const LOCAL_HOUSEHOLD: Household = { id: LOCAL_HID, name: '우리 집 (체험 모드)', invite_code: '-' }

/** 체험 모드는 혼자 쓰니 메모는 모두 '내 메모' */
const LOCAL_ME_ID = 'local-me'
const LOCAL_NAME_KEY = 'fridge-demo-name'
/** 체험 모드에서 바꾼 자동 기한 */
const LOCAL_DAYS_KEY = 'fridge-demo-category-days'
const localDays = (): Record<string, CategoryDays> => JSON.parse(localStorage.getItem(LOCAL_DAYS_KEY) || '{}')
const applyLocalDays = () => DEFAULT_CATEGORIES.map((c) => ({ ...c, ...localDays()[c.id] }))
const localMe = (): Me => ({ id: LOCAL_ME_ID, name: localStorage.getItem(LOCAL_NAME_KEY) || '나' })

export function createLocalRepo(): Repo {
  type Stored = Omit<Snapshot, 'history' | 'me'>
  const read = (): Stored => {
    const raw = localStorage.getItem(LOCAL_KEY)
    const s = raw ? JSON.parse(raw) : {}
    return { fridges: [], compartments: [], items: [], notes: [], comments: [], photos: [], ...s }
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
      setCategories(applyLocalDays())
      const history = [...s.items].sort((a, b) => b.created_at.localeCompare(a.created_at))
      const me = localMe()
      return { ...s, items: s.items.filter((i) => i.status === 'active'), history, me, members: [me] }
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
          created_by: LOCAL_ME_ID,
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
    addNote: (input) =>
      mutate((s) => {
        s.notes.unshift({
          ...input,
          id: id(),
          household_id: LOCAL_HID,
          author_id: LOCAL_ME_ID,
          author_name: localMe().name,
          read_at: null,
          created_at: now(),
        })
      }),
    deleteNote: (nid) =>
      mutate((s) => {
        s.notes = s.notes.filter((n) => n.id !== nid)
        s.comments = s.comments.filter((c) => c.note_id !== nid)
      }),
    restoreNote: (note, comments) =>
      mutate((s) => {
        s.notes = [note, ...s.notes].sort((a, b) => b.created_at.localeCompare(a.created_at))
        s.comments = [...s.comments, ...comments].sort((a, b) => a.created_at.localeCompare(b.created_at))
      }),
    addComment: (noteId, body) =>
      mutate((s) => {
        s.comments.push({
          id: id(),
          note_id: noteId,
          household_id: LOCAL_HID,
          body,
          author_id: LOCAL_ME_ID,
          author_name: localMe().name,
          created_at: now(),
        })
      }),
    deleteComment: (cid) =>
      mutate((s) => {
        s.comments = s.comments.filter((c) => c.id !== cid)
      }),
    async addPhoto(file) {
      if (read().photos.length >= PHOTO_LIMIT) throw new Error('photo_limit')
      // 이 기기 저장소(5MB 안팎)에 담으니 체험 모드는 더 작게
      const { blob, width, height } = await preparePhoto(file, 900, 120 * 1024)
      const url = await blobToDataUrl(blob)
      const pid = id()
      await mutate((s) => {
        s.photos.unshift({
          id: pid,
          household_id: LOCAL_HID,
          path: `local/${pid}`,
          url,
          width,
          height,
          author_id: LOCAL_ME_ID,
          author_name: localMe().name,
          created_at: now(),
        })
      })
    },
    deletePhoto: (photo) =>
      mutate((s) => {
        s.photos = s.photos.filter((p) => p.id !== photo.id)
      }),
    markNotesRead: async () => {},
    async renameMe(name) {
      localStorage.setItem(LOCAL_NAME_KEY, name)
    },
    async setCategoryDays(id, days) {
      const all = { ...localDays(), [id]: { ...localDays()[id], ...days } }
      localStorage.setItem(LOCAL_DAYS_KEY, JSON.stringify(all))
      setCategories(applyLocalDays())
    },
    subscribe(onChange) {
      // 같은 브라우저의 다른 탭에서 바뀐 경우
      const handler = (e: StorageEvent) => e.key === LOCAL_KEY && onChange()
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}
