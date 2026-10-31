import { List, Plus, Refrigerator, Settings as SettingsIcon, StickyNote as NoteIcon, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Repo, Snapshot } from '../lib/repo'
import { cameBackFromOAuth, type SmartThings } from '../lib/smartthings'
import { FRIDGE_TEMPLATES } from '../lib/templates'
import { expiryLevel } from '../lib/expiry'
import { setAppBadge } from '../lib/badge'
import { isUnread } from '../lib/notes'
import type { Household, Item, Note } from '../lib/types'
import { FridgeStatus } from './FridgeStatus'
import { FridgeView } from './FridgeView'
import { InventoryList } from './InventoryList'
import { ItemSheet } from './ItemSheet'
import { NoteBanner } from './NoteBanner'
import { NoteBoard } from './NoteBoard'
import { NoteViewSheet, NoteWriteSheet } from './NoteSheet'
import { Settings } from './Settings'
import { cx } from '../lib/cx'
import { Button, Card, Logo, SunnyEgg } from './ui'

const URGENT_LEVELS = new Set(['expired', 'urgent'])

type Tab = 'list' | 'view' | 'notes' | 'settings'
/** 폰에서는 아래 탭 메뉴, PC 에서는 머리글 오른쪽에 보인다 */
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'list', label: '재고', icon: List },
  { id: 'view', label: '냉장고', icon: Refrigerator },
  { id: 'notes', label: '메모', icon: NoteIcon },
  { id: 'settings', label: '설정', icon: SettingsIcon },
]
type SheetState =
  | { mode: 'add'; compartmentId?: string }
  | { mode: 'edit'; item: Item }
  | { mode: 'note-write' }
  | { mode: 'note-view'; note: Note }
  | null

const LAST_COMPARTMENT_KEY = 'fridge-last-compartment'

interface Props {
  repo: Repo
  household: Household
  smartthings: SmartThings
  isLocal?: boolean
  onSignOut?: () => void
}

export function Main({ repo, household, smartthings, isLocal = false, onSignOut }: Props) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 알림을 눌러 열면 ./?tab=notes 처럼 들어온다. 삼성 계정 로그인에서 돌아오면(?smartthings=…) 냉장고 탭으로
  const [tab, setTab] = useState<Tab>(() => {
    if (cameBackFromOAuth()) return 'view'
    const t = new URLSearchParams(location.search).get('tab')
    return TABS.some((x) => x.id === t) ? (t as Tab) : 'list'
  })
  useEffect(() => {
    // 새로고침해도 그 탭에 묶이지 않게 주소에서 지운다
    if (location.search.includes('tab=')) history.replaceState(null, '', location.pathname)
  }, [])
  const [sheet, setSheet] = useState<SheetState>(null)
  /** 메모 탭을 연 순간 안 봤던 메모. 탭을 떠날 때까지 '새 메모'로 표시 */
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  /** 방금 뗀 메모: 잠깐 '되돌리기'를 보여 준다 */
  const [removed, setRemoved] = useState<Note | null>(null)
  const egg = useSunnyEgg()

  const reload = useCallback(async () => {
    try {
      setSnap(await repo.load())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했어요')
    }
  }, [repo])

  useEffect(() => {
    reload()
    const unsubscribe = repo.subscribe(reload)
    const onFocus = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [repo, reload])

  const unread = useMemo(() => (snap ? snap.notes.filter((n) => isUnread(n, snap.me)) : []), [snap])

  // 홈 화면 앱 아이콘 숫자: 안 읽은 메모 + 3일 안에 챙길 식품(지남 포함)
  const badgeCount = snap ? unread.length + snap.items.filter((i) => URGENT_LEVELS.has(expiryLevel(i.expiry_date))).length : 0
  useEffect(() => {
    if (!snap) return
    setAppBadge(badgeCount)
  }, [snap, badgeCount])

  // 메모 탭을 보고 있으면 상대 메모를 읽음으로 표시 (탭에 있는 동안 새로 온 것도)
  useEffect(() => {
    if (tab !== 'notes' || unread.length === 0) return
    const ids = unread.map((n) => n.id)
    setFresh((prev) => new Set([...prev, ...ids]))
    repo.markNotesRead(ids).catch(() => {})
  }, [tab, unread, repo])

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), 4000)
    return () => clearTimeout(timer)
  }, [removed])

  const openTab = (t: Tab) => {
    if (t !== 'notes') setFresh(new Set())
    setTab(t)
  }

  const mutate = useCallback(
    async (fn: () => Promise<void>) => {
      await fn()
      await reload()
    },
    [reload],
  )

  if (!snap) {
    return <div className="flex min-h-dvh items-center justify-center text-muted">{error ?? '불러오는 중…'}</div>
  }

  const noFridge = snap.fridges.length === 0
  const lastCompartment = localStorage.getItem(LAST_COMPARTMENT_KEY) ?? undefined
  const defaultCompartment =
    sheet?.mode === 'add' && sheet.compartmentId
      ? sheet.compartmentId
      : snap.compartments.some((c) => c.id === lastCompartment)
        ? lastCompartment
        : undefined

  const showAdd = (tab === 'list' || tab === 'view') && !noFridge
  const goHome = () => {
    egg.tap()
    setSheet(null)
    openTab('list')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-44 sm:pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-bg/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md sm:px-6">
        {/* 로고·제목을 누르면 홈(재고)으로, 맨 위로. 로고를 빠르게 다섯 번 누르면 이스터에그 */}
        <h1 className="min-w-0 flex-1">
          <button
            onClick={goHome}
            aria-label={egg.on ? undefined : '냉장고를 부탁해, 홈으로'}
            className="flex w-fit max-w-full items-center gap-3 text-left transition active:opacity-70"
          >
            <span className="shrink-0">{egg.on ? <SunnyEgg /> : <Logo />}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] leading-tight font-extrabold tracking-tight">냉장고를 부탁해</span>
              <span className="block truncate text-xs text-muted">
                {egg.on ? (
                  '써니사이드업 팀이 지선 님을 응원해요'
                ) : (
                  <>
                    {household.name}
                    {snap.items.length > 0 && ` · 식품 ${snap.items.length}개`}
                  </>
                )}
              </span>
            </span>
          </button>
        </h1>
        <nav className="hidden rounded-xl bg-sunken p-[3px] text-sm sm:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => openTab(t.id)}
              className={cx(
                'flex items-center gap-1.5 rounded-[9px] px-3.5 py-1.5 transition',
                tab === t.id ? 'bg-surface font-bold shadow-card' : 'text-muted',
              )}
            >
              <t.icon size={16} strokeWidth={2.2} />
              {t.label}
              {t.id === 'notes' && tab !== 'notes' && unread.length > 0 && <Badge count={unread.length} />}
            </button>
          ))}
        </nav>
      </header>

      <main className="px-4 pt-1 sm:px-6">
        {error && <p className="mb-3 rounded-2xl bg-expired-soft p-3 text-sm text-expired">{error}</p>}

        {(tab === 'list' || tab === 'view') && noFridge && (
          <Card className="p-5">
            <h2 className="text-lg font-extrabold">먼저 냉장고를 등록해 주세요</h2>
            <p className="mt-1 text-sm text-muted">
              우리 집 냉장고 모델의 칸 구성으로 바로 만들어요. 칸은 나중에 설정에서 바꿀 수 있어요.
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() =>
                mutate(async () => {
                  for (const t of FRIDGE_TEMPLATES.filter((t) => t.id !== 'custom')) await repo.addFridge(t, t.name)
                })
              }
            >
              삼성 비스포크 + 쿠쿠 냉동고 등록
            </Button>
            <button className="mt-2 w-full py-2 text-sm font-semibold text-muted" onClick={() => openTab('settings')}>
              다른 냉장고로 직접 등록하기
            </button>
          </Card>
        )}

        {tab === 'list' && <NoteBanner unread={unread} onOpen={() => openTab('notes')} />}

        {tab === 'notes' && (
          <NoteBoard
            notes={snap.notes}
            me={snap.me}
            fresh={fresh}
            onOpen={(note) => setSheet({ mode: 'note-view', note })}
            onWrite={() => setSheet({ mode: 'note-write' })}
          />
        )}

        {tab === 'list' && !noFridge && (
          <InventoryList
            fridges={snap.fridges}
            compartments={snap.compartments}
            items={snap.items}
            onOpen={(item) => setSheet({ mode: 'edit', item })}
            onUseOne={(item) => mutate(() => repo.act(item, 'use'))}
            onAddTo={(compartmentId) => setSheet({ mode: 'add', compartmentId })}
          />
        )}

        {tab === 'view' && noFridge && (
          <div className="mb-4">
            <FridgeStatus st={smartthings} />
          </div>
        )}

        {tab === 'view' && !noFridge && (
          <FridgeView
            fridges={snap.fridges}
            compartments={snap.compartments}
            items={snap.items}
            onOpen={(item) => setSheet({ mode: 'edit', item })}
            onUseOne={(item) => mutate(() => repo.act(item, 'use'))}
            onAddTo={(compartmentId) => setSheet({ mode: 'add', compartmentId })}
            notes={snap.notes}
            onOpenNotes={() => openTab('notes')}
            header={<FridgeStatus st={smartthings} />}
          />
        )}

        {tab === 'settings' && (
          <Settings
            repo={repo}
            household={household}
            fridges={snap.fridges}
            compartments={snap.compartments}
            me={snap.me}
            members={snap.members}
            isLocal={isLocal}
            onSignOut={onSignOut}
            onChanged={reload}
          />
        )}
      </main>

      {showAdd && (
        <button
          onClick={() => setSheet({ mode: 'add' })}
          className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex h-14 items-center gap-1.5 rounded-[1.25rem] bg-accent pr-5 pl-4 text-base font-bold text-white shadow-float transition active:scale-95 sm:right-[max(1.5rem,calc(50vw-24rem+1.5rem))] sm:bottom-8"
        >
          <Plus size={22} strokeWidth={2.6} />
          식품 넣기
        </button>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
        style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => openTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cx(
              'flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition',
              tab === t.id ? 'text-accent' : 'text-faint',
            )}
          >
            <span className="relative">
              <t.icon size={23} strokeWidth={tab === t.id ? 2.3 : 1.9} />
              {t.id === 'notes' && tab !== 'notes' && unread.length > 0 && (
                <Badge count={unread.length} className="absolute -top-1.5 -right-2.5" />
              )}
            </span>
            {t.label}
          </button>
        ))}
      </nav>

      {sheet?.mode === 'note-write' && (
        <NoteWriteSheet
          me={snap.me}
          members={snap.members}
          onClose={() => setSheet(null)}
          onSave={async (input) => {
            await mutate(() => repo.addNote(input))
            setSheet(null)
          }}
        />
      )}

      {sheet?.mode === 'note-view' && (
        <NoteViewSheet
          note={sheet.note}
          me={snap.me}
          onClose={() => setSheet(null)}
          onRemove={async () => {
            const note = sheet.note
            await mutate(() => repo.deleteNote(note.id))
            setSheet(null)
            setRemoved(note)
          }}
        />
      )}

      {removed && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md animate-[sheet-up_200ms_ease-out] items-center gap-3 rounded-2xl bg-ink py-2 pr-2 pl-4 text-sm text-white shadow-card sm:bottom-8"
        >
          <span className="flex-1">메모를 뗐어요</span>
          <button
            className="h-9 rounded-xl px-3 font-bold text-accent-soft active:bg-white/10"
            onClick={() => {
              const note = removed
              setRemoved(null)
              mutate(() => repo.restoreNote(note))
            }}
          >
            되돌리기
          </button>
        </div>
      )}

      {(sheet?.mode === 'add' || sheet?.mode === 'edit') && (
        <ItemSheet
          key={sheet.mode === 'edit' ? sheet.item.id : 'add'}
          fridges={snap.fridges}
          compartments={snap.compartments}
          history={snap.history}
          members={snap.members}
          item={sheet.mode === 'edit' ? sheet.item : undefined}
          defaultCompartmentId={defaultCompartment}
          onClose={() => setSheet(null)}
          onSave={async (input, keepOpen) => {
            localStorage.setItem(LAST_COMPARTMENT_KEY, input.compartment_id)
            await mutate(() => (sheet.mode === 'edit' ? repo.updateItem(sheet.item.id, input) : repo.addItem(input)))
            if (!keepOpen) setSheet(null)
          }}
          onAction={(item, action) => mutate(() => repo.act(item, action))}
          onDelete={(item) => mutate(() => repo.deleteItem(item.id))}
        />
      )}
    </div>
  )
}

/** 탭 아이콘 위 안 읽은 개수 */
function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cx(
        'tabular grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] leading-none font-bold text-white',
        className,
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

/** 이스터에그: 로고를 2초 안에 다섯 번 누르면 3초 동안 반숙 달걀로 바뀐다 */
function useSunnyEgg() {
  const [on, setOn] = useState(false)
  const taps = useRef<number[]>([])
  const tap = () => {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < 2000), now]
    if (taps.current.length < 5) return
    taps.current = []
    setOn(true)
    setTimeout(() => setOn(false), 3000)
  }
  return { on, tap }
}
