import { lazy, Suspense, useMemo, useState } from 'react'
import { categoryOf } from '../lib/categories'
import { dDayLabel, expiryLevel, LEVEL_STYLE } from '../lib/expiry'
import { isDoorCompartment, itemsBy, shapeOf, sortByUrgency } from '../lib/fridgeShape'
import { ZONE_LABEL } from '../lib/templates'
import type { Compartment, Fridge, Item } from '../lib/types'
import { Fridge2D, type View2D } from './Fridge2D'
import type { CameraPreset } from './Fridge3D'

// three.js 는 크니까 3D 를 열 때만 받는다
const Fridge3D = lazy(() => import('./Fridge3D'))

type Mode = '3d' | View2D

const MODES: [Mode, string][] = [
  ['3d', '3D'],
  ['open', '정면'],
  ['closed', '문 닫힘'],
  ['side', '측면'],
]

const CAMERAS: [CameraPreset, string][] = [
  ['front', '정면'],
  ['left', '왼쪽'],
  ['right', '오른쪽'],
  ['top', '위'],
]

const MODE_KEY = 'fridge-view-mode'

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

interface Props {
  fridges: Fridge[]
  compartments: Compartment[]
  items: Item[]
  onOpen: (item: Item) => void
  onAddTo: (compartmentId: string) => void
}

export function FridgeView({ fridges, compartments, items, onOpen, onAddTo }: Props) {
  const [webgl] = useState(hasWebGL)
  const [fridgeId, setFridgeId] = useState(fridges[0]?.id)
  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorage.getItem(MODE_KEY) as Mode | null
    return saved && MODES.some(([m]) => m === saved) && (saved !== '3d' || webgl) ? saved : webgl ? '3d' : 'open'
  })
  const [camera, setCamera] = useState<CameraPreset>('front')
  const [cameraNonce, setCameraNonce] = useState(0)
  const [doorOpen, setDoorOpen] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fridge = fridges.find((f) => f.id === fridgeId) ?? fridges[0]
  const shape = useMemo(() => shapeOf(fridge), [fridge])
  const mine = useMemo(() => compartments.filter((c) => c.fridge_id === fridge.id), [compartments, fridge])
  const byComp = useMemo(() => itemsBy(items), [items])
  const anyOpen = shape.doors.some((d) => doorOpen[d.id] ?? true)
  const unplaced = mine.filter((c) => !c.layout)
  const selected = mine.find((c) => c.id === selectedId) ?? null
  const fridgeItems = mine.flatMap((c) => byComp.get(c.id) ?? [])
  const urgent = sortByUrgency(fridgeItems).filter((i) => ['expired', 'urgent', 'soon'].includes(expiryLevel(i.expiry_date)))

  const changeMode = (m: Mode) => {
    setMode(m)
    localStorage.setItem(MODE_KEY, m)
  }

  const row = (i: Item, withPlace: boolean) => {
    const lv = expiryLevel(i.expiry_date)
    const place = withPlace ? mine.find((c) => c.id === i.compartment_id)?.name : null
    return (
      <li key={i.id}>
        <button className="flex w-full items-center gap-3 bg-white px-3 py-2 text-left" onClick={() => onOpen(i)}>
          <span className="text-xl">{categoryOf(i.category).emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{i.name}</span>
            <span className="block truncate text-xs text-slate-500">
              {i.quantity}
              {i.unit}
              {place && ` · ${place}`}
            </span>
          </span>
          <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${LEVEL_STYLE[lv]}`}>{dDayLabel(i.expiry_date)}</span>
        </button>
      </li>
    )
  }

  const selectedItems = selected ? sortByUrgency(byComp.get(selected.id) ?? []) : []

  return (
    <div className="flex flex-col gap-3">
      {fridges.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {fridges.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFridgeId(f.id)
                setSelectedId(null)
              }}
              className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
                f.id === fridge.id ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-slate-200 p-0.5 text-sm">
          {MODES.filter(([m]) => m !== '3d' || webgl).map(([m, label]) => (
            <button
              key={m}
              onClick={() => changeMode(m)}
              className={`rounded-md px-3 py-1.5 ${mode === m ? 'bg-white font-semibold shadow-sm' : 'text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === '3d' && (
          <button
            onClick={() => setDoorOpen(Object.fromEntries(shape.doors.map((d) => [d.id, !anyOpen])))}
            className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            {anyOpen ? '문 닫기' : '문 열기'}
          </button>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm">
        {mode === '3d' ? (
          <div className="h-[62dvh] min-h-80 w-full touch-none">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-400">3D 불러오는 중…</div>}>
              <Fridge3D
                shape={shape}
                compartments={mine}
                itemsByCompartment={byComp}
                selectedId={selectedId}
                doorOpen={doorOpen}
                camera={camera}
                cameraNonce={cameraNonce}
                onSelect={setSelectedId}
                onToggleDoor={(id) => setDoorOpen((s) => ({ ...s, [id]: !(s[id] ?? true) }))}
                onOpenItem={onOpen}
              />
            </Suspense>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 rounded-lg bg-white/85 p-0.5 text-xs shadow backdrop-blur">
              {CAMERAS.map(([c, label]) => (
                <button
                  key={c}
                  onClick={() => {
                    setCamera(c)
                    setCameraNonce((n) => n + 1)
                  }}
                  className={`rounded-md px-2.5 py-1 whitespace-nowrap ${camera === c ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3">
            <Fridge2D
              view={mode}
              shape={shape}
              compartments={mine}
              itemsByCompartment={byComp}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpenItem={onOpen}
              onOpenDoors={() => changeMode('open')}
            />
          </div>
        )}
      </div>

      <p className="-mt-1 text-xs text-slate-400">
        {fridge.model ?? fridge.name}
        {shape.estimated && ' · 크기는 추정치예요'}
        {mode === '3d' ? ' · 드래그로 돌리고, 두 손가락으로 확대 · 문을 누르면 열고 닫혀요' : ' · 칸을 누르면 아래에 목록이 나와요'}
      </p>

      {selected ? (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 text-sm">
            <span className="rounded bg-slate-200 px-1.5 text-xs text-slate-600">
              {isDoorCompartment(selected) ? '문' : ZONE_LABEL[selected.zone]}
            </span>
            <span className="font-semibold">{selected.name}</span>
            <span className="text-slate-400">{selectedItems.length}</span>
            <button onClick={() => onAddTo(selected.id)} className="ml-auto text-sky-700">
              + 여기에 넣기
            </button>
          </div>
          {selectedItems.length ? (
            <ul className="divide-y divide-slate-100">{selectedItems.map((i) => row(i, false))}</ul>
          ) : (
            <p className="px-3 py-4 text-sm text-slate-400">비어 있어요</p>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="bg-slate-50 px-3 py-2 text-sm font-semibold">
            {fridge.name} · 기한 임박 {urgent.length}개 <span className="font-normal text-slate-400">/ 전체 {fridgeItems.length}개</span>
          </div>
          {urgent.length ? (
            <ul className="divide-y divide-slate-100">{urgent.map((i) => row(i, true))}</ul>
          ) : (
            <p className="px-3 py-4 text-sm text-slate-400">급한 식품이 없어요. 칸을 누르면 그 칸의 식품을 볼 수 있어요</p>
          )}
        </section>
      )}

      {unplaced.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-slate-400">그림에 없는 칸:</span>
          {unplaced.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`rounded-full border px-3 py-1 ${selectedId === c.id ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white'}`}
            >
              {c.name} {(byComp.get(c.id) ?? []).length}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
