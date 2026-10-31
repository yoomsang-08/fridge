import { useCallback, useEffect, useState } from 'react'
import type { Repo, Snapshot } from '../lib/repo'
import { FRIDGE_TEMPLATES } from '../lib/templates'
import type { Household, Item } from '../lib/types'
import { FridgeView } from './FridgeView'
import { InventoryList } from './InventoryList'
import { ItemSheet } from './ItemSheet'
import { Settings } from './Settings'

type Tab = 'list' | 'view' | 'settings'
type SheetState = { mode: 'add'; compartmentId?: string } | { mode: 'edit'; item: Item } | null

const LAST_COMPARTMENT_KEY = 'fridge-last-compartment'

interface Props {
  repo: Repo
  household: Household
  isLocal?: boolean
  onSignOut?: () => void
}

export function Main({ repo, household, isLocal = false, onSignOut }: Props) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('list')
  const [sheet, setSheet] = useState<SheetState>(null)

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
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-400">{error ?? '불러오는 중…'}</div>
    )
  }

  const noFridge = snap.fridges.length === 0
  const lastCompartment = localStorage.getItem(LAST_COMPARTMENT_KEY) ?? undefined
  const defaultCompartment =
    sheet?.mode === 'add' && sheet.compartmentId
      ? sheet.compartmentId
      : snap.compartments.some((c) => c.id === lastCompartment)
        ? lastCompartment
        : undefined

  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-slate-100/90 px-4 py-3 backdrop-blur">
        <span className="text-2xl">🧊</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold leading-tight">냉장고를 부탁해</h1>
          <p className="truncate text-xs text-slate-500">{household.name}</p>
        </div>
        <nav className="flex rounded-xl bg-slate-200 p-0.5 text-sm">
          {(
            [
              ['list', '재고'],
              ['view', '냉장고'],
              ['settings', '설정'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 ${tab === t ? 'bg-white font-semibold shadow-sm' : 'text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="px-4">
        {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {(tab === 'list' || tab === 'view') && noFridge && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">먼저 냉장고를 등록해 주세요</h2>
            <p className="mt-1 text-sm text-slate-500">우리 집 냉장고 모델의 칸 구성으로 바로 만들어요. 칸은 나중에 설정에서 바꿀 수 있어요.</p>
            <button
              className="mt-4 w-full rounded-xl bg-sky-600 py-3 font-semibold text-white"
              onClick={() =>
                mutate(async () => {
                  for (const t of FRIDGE_TEMPLATES.filter((t) => t.id !== 'custom')) await repo.addFridge(t, t.name)
                })
              }
            >
              삼성 비스포크 + 쿠쿠 냉동고 등록
            </button>
            <button className="mt-2 w-full py-2 text-sm text-slate-500" onClick={() => setTab('settings')}>
              다른 냉장고로 직접 등록하기
            </button>
          </div>
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

        {tab === 'view' && !noFridge && (
          <FridgeView
            fridges={snap.fridges}
            compartments={snap.compartments}
            items={snap.items}
            onOpen={(item) => setSheet({ mode: 'edit', item })}
            onAddTo={(compartmentId) => setSheet({ mode: 'add', compartmentId })}
          />
        )}

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

      {(tab === 'list' || tab === 'view') && !noFridge && (
        <button
          onClick={() => setSheet({ mode: 'add' })}
          className="fixed bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-sky-600 text-4xl text-white shadow-lg active:scale-95 sm:right-[max(1.5rem,calc(50vw-24rem+1.5rem))]"
          aria-label="식품 넣기"
        >
          +
        </button>
      )}

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
            await mutate(() =>
              sheet.mode === 'edit' ? repo.updateItem(sheet.item.id, input) : repo.addItem(input),
            )
            if (!keepOpen) setSheet(null)
          }}
          onAction={(item, action) => mutate(() => repo.act(item, action))}
          onDelete={(item) => mutate(() => repo.deleteItem(item.id))}
        />
      )}
    </div>
  )
}
