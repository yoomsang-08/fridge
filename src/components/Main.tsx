import { List, Plus, Settings as SettingsIcon, Thermometer, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Repo, Snapshot } from '../lib/repo'
import type { SmartThings } from '../lib/smartthings'
import { FRIDGE_TEMPLATES } from '../lib/templates'
import type { Household, Item } from '../lib/types'
import { FridgeStatus } from './FridgeStatus'
import { InventoryList } from './InventoryList'
import { ItemSheet } from './ItemSheet'
import { Settings } from './Settings'
import { cx } from '../lib/cx'
import { Button, Card, Logo, SunnyEgg } from './ui'

type Tab = 'list' | 'device' | 'settings'
/** 폰에서는 아래 탭 메뉴, PC 에서는 머리글 오른쪽에 보인다 */
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'list', label: '재고', icon: List },
  { id: 'device', label: '온도', icon: Thermometer },
  { id: 'settings', label: '설정', icon: SettingsIcon },
]
type SheetState = { mode: 'add'; compartmentId?: string } | { mode: 'edit'; item: Item } | null

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
  const [tab, setTab] = useState<Tab>('list')
  const [sheet, setSheet] = useState<SheetState>(null)
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

  const showAdd = tab === 'list' && !noFridge

  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-44 sm:pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-bg/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md sm:px-6">
        <button onClick={egg.tap} aria-label="냉장고를 부탁해" className="shrink-0">
          {egg.on ? <SunnyEgg /> : <Logo />}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] leading-tight font-extrabold tracking-tight">냉장고를 부탁해</h1>
          <p className="truncate text-xs text-muted">
            {egg.on ? (
              '써니사이드업 팀이 지선 님을 응원해요'
            ) : (
              <>
                {household.name}
                {snap.items.length > 0 && ` · 식품 ${snap.items.length}개`}
              </>
            )}
          </p>
        </div>
        <nav className="hidden rounded-xl bg-sunken p-[3px] text-sm sm:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                'flex items-center gap-1.5 rounded-[9px] px-3.5 py-1.5 transition',
                tab === t.id ? 'bg-surface font-bold shadow-card' : 'text-muted',
              )}
            >
              <t.icon size={16} strokeWidth={2.2} />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="px-4 pt-1 sm:px-6">
        {error && <p className="mb-3 rounded-2xl bg-expired-soft p-3 text-sm text-expired">{error}</p>}

        {tab === 'list' && noFridge && (
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
            <button className="mt-2 w-full py-2 text-sm font-semibold text-muted" onClick={() => setTab('settings')}>
              다른 냉장고로 직접 등록하기
            </button>
          </Card>
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

        {tab === 'device' && <FridgeStatus st={smartthings} />}

        {tab === 'settings' && (
          <Settings
            repo={repo}
            household={household}
            fridges={snap.fridges}
            compartments={snap.compartments}
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
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cx(
              'flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition',
              tab === t.id ? 'text-accent' : 'text-faint',
            )}
          >
            <t.icon size={23} strokeWidth={tab === t.id ? 2.3 : 1.9} />
            {t.label}
          </button>
        ))}
      </nav>

      {sheet && (
        <ItemSheet
          key={sheet.mode === 'edit' ? sheet.item.id : 'add'}
          fridges={snap.fridges}
          compartments={snap.compartments}
          history={snap.history}
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
