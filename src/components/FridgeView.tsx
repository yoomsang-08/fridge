import { DoorClosed, DoorOpen, PanelRight, Rotate3d, Square, ZoomOut } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { expiryLevel, LEVEL_DOT } from '../lib/expiry'
import { expandSlots, fitPantry, isDoorCompartment, itemsBy, shapeOf, sortByUrgency } from '../lib/fridgeShape'
import { ZONE_LABEL } from '../lib/templates'
import { celebrationToday, hourKST } from '../lib/celebrations'
import { DOOR_NOTE_COUNT } from '../lib/notes'
import { burst, eggToast } from '../lib/eggToast'
import type { Compartment, Fridge, FridgePhoto, Item, Note } from '../lib/types'
import { cx } from '../lib/cx'
import { Fridge2D } from './Fridge2D'
import type { CameraPreset } from './Fridge3D'
import { ItemRow } from './ItemRow'
import { SpaceIcon } from './SpaceIcon'
import { Card, Chip, IconButton, Segmented, SunnyEgg } from './ui'

// three.js 는 크니까 3D 를 열 때만 받는다
const Fridge3D = lazy(() => import('./Fridge3D'))

type Mode = '3d' | 'flat'

const MODE_KEY = 'fridge-view-mode'
const DOOR_HINT_KEY = 'fridge-door-hint-v1'
const CAMERA_ORDER: CameraPreset[] = ['front', 'left', 'right', 'top']
const CAMERA_LABEL: Record<CameraPreset, string> = { front: '정면', left: '왼쪽', right: '오른쪽', top: '위' }

const LEGEND = [
  ['expired', '지남'],
  ['urgent', '3일 이내'],
  ['soon', '7일 이내'],
] as const

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
  onUseOne: (item: Item) => void
  onAddTo: (compartmentId: string) => void
  /** 맨 위 카드 자리 (냉장고 상태 등) */
  header?: ReactNode
  /** 냉장고 문 메모. 첫 번째 냉장고 문 앞면에 최근 몇 장을 붙인다 */
  notes?: Note[]
  onOpenNotes?: () => void
  /** 냉장고 문 사진 */
  photos?: FridgePhoto[]
}

export function FridgeView({ fridges, compartments, items, onOpen, onUseOne, onAddTo, header, notes = [], onOpenNotes, photos = [] }: Props) {
  const [webgl] = useState(hasWebGL)
  const [fridgeId, setFridgeId] = useState(fridges[0]?.id)
  const [mode, setMode] = useState<Mode>(() =>
    webgl && localStorage.getItem(MODE_KEY) !== 'flat' ? '3d' : 'flat',
  )
  const [camera, setCamera] = useState<CameraPreset>('front')
  const [cameraNonce, setCameraNonce] = useState(0)
  const [doorOpen, setDoorOpen] = useState<Record<string, boolean>>({})
  const [side, setSide] = useState(false)
  // 문은 닫힌 채로 시작한다. 처음 한 번만 '문을 누르면 안이 보여요'를 띄운다
  const [hintSeen, setHintSeen] = useState(() => localStorage.getItem(DOOR_HINT_KEY) === '1')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [egg, setEgg] = useState(false)

  useEffect(() => {
    if (!egg) return
    const t = setTimeout(() => setEgg(false), 3000)
    return () => clearTimeout(t)
  }, [egg])

  const fridge = fridges.find((f) => f.id === fridgeId) ?? fridges[0]
  const mine = useMemo(() => compartments.filter((c) => c.fridge_id === fridge.id), [compartments, fridge])
  const byComp = useMemo(() => itemsBy(items), [items])
  // 팬트리는 물건이 많으면 옆으로 늘어난다
  const shape = useMemo(
    () => fitPantry(shapeOf(fridge), mine.map((c) => byComp.get(c.id)?.length ?? 0)),
    [fridge, mine, byComp],
  )
  // 냉장·냉동·김치냉장 같은 큰 구역을 그림에서는 선반·서랍·포켓 자리로 나눠 보여 준다
  const drawn = useMemo(() => expandSlots(shape, mine, byComp), [shape, mine, byComp])
  // 팬트리처럼 문이 없으면 늘 열린 것처럼 보여 준다
  const noDoors = shape.doors.length === 0
  const anyOpen = noDoors || shape.doors.some((d) => doorOpen[d.id] ?? false)
  const showHint = !anyOpen && !hintSeen && shape.doors.length > 0
  const spaces = [...fridges].sort((a, b) => Number(a.template === 'pantry') - Number(b.template === 'pantry'))
  const unplaced = mine.filter((c) => !c.layout)
  const selected = mine.find((c) => c.id === selectedId) ?? null
  // 3D 에서 몸체 칸을 고르면 카메라가 그 칸으로 다가간다(Fridge3D 의 focus)
  const zoomed = !!selected?.layout && !isDoorCompartment(selected)
  const fridgeItems = mine.flatMap((c) => byComp.get(c.id) ?? [])
  const urgent = sortByUrgency(fridgeItems).filter((i) => ['expired', 'urgent', 'soon'].includes(expiryLevel(i.expiry_date)))
  const selectedItems = selected ? sortByUrgency(byComp.get(selected.id) ?? []) : []
  // 메모는 집에 하나인 메인 냉장고(첫 번째)에만 붙인다
  const doorNotes = fridge.id === fridges[0]?.id ? notes.slice(0, DOOR_NOTE_COUNT) : []
  // 사진도 메인 냉장고 문에 최근 두 장만
  const doorPhotos = fridge.id === fridges[0]?.id ? photos.slice(0, 2) : []
  // 생일·기념일에는 메인 냉장고를 꾸민다 (이스터에그)
  const celebration = useMemo(() => (fridge.id === fridges[0]?.id ? celebrationToday() : null), [fridge.id, fridges])
  const nameOf = (i: Item) => mine.find((c) => c.id === i.compartment_id)?.name

  const changeMode = (m: Mode) => {
    setMode(m)
    localStorage.setItem(MODE_KEY, m)
  }
  const seeHint = () => {
    if (hintSeen) return
    setHintSeen(true)
    localStorage.setItem(DOOR_HINT_KEY, '1')
  }
  // 문을 짧은 시간에 다섯 번 여닫으면 한마디 (이스터에그)
  const flaps = useRef<number[]>([])
  const flap = () => {
    if (burst(flaps.current, Date.now(), 2500, 5)) eggToast('문 고장 아니에요, 지선 님')
  }
  const setAllDoors = (open: boolean) => {
    flap()
    if (open) seeHint()
    setDoorOpen(Object.fromEntries(shape.doors.map((d) => [d.id, open])))
  }
  const toggleDoor = (id: string) => {
    flap()
    seeHint()
    setDoorOpen((s) => ({ ...s, [id]: !(s[id] ?? false) }))
  }
  const nextCamera = () => {
    setCamera((c) => CAMERA_ORDER[(CAMERA_ORDER.indexOf(c) + 1) % CAMERA_ORDER.length])
    setCameraNonce((n) => n + 1)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 상태 카드(냉장·냉동 온도)는 냉장고를 볼 때만 */}
      {!noDoors && header}

      {/* 폰은 공간 칩 줄 아래에 3D·평면, sm 이상은 한 줄 양 끝 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {fridges.length > 1 && (
          <div className="-mx-4 flex min-w-0 gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {spaces.map((f) => (
              <Chip
                key={f.id}
                active={f.id === fridge.id}
                onClick={() => {
                  setFridgeId(f.id)
                  setSelectedId(null)
                  setSide(false)
                }}
              >
                <SpaceIcon fridge={f} />
                {f.name}
              </Chip>
            ))}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {webgl && (
            <Segmented
              className="ml-auto"
              value={mode}
              options={[
                ['3d', '3D'],
                ['flat', '평면'],
              ]}
              onChange={changeMode}
            />
          )}
        </div>
      </div>

      <Card className="relative overflow-hidden">
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {/* 칸으로 다가간 뒤엔 빈 곳을 찾기 어려우니 돌아가는 버튼을 따로 */}
          {mode === '3d' && zoomed && (
            <button
              onClick={() => setSelectedId(null)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-surface/90 px-3 text-sm font-bold text-ink shadow-card transition active:brightness-95"
            >
              <ZoomOut size={18} />
              전체 보기
            </button>
          )}
          {mode === '3d' ? (
            <IconButton onClick={nextCamera} aria-label="각도 바꾸기" title={`각도 바꾸기 (지금 ${CAMERA_LABEL[camera]})`} className="bg-surface/80">
              <Rotate3d size={20} />
            </IconButton>
          ) : (
            anyOpen && (
              <IconButton onClick={() => setSide((v) => !v)} aria-label={side ? '정면으로 보기' : '옆에서 보기'} className="bg-surface/80">
                {side ? <Square size={20} /> : <PanelRight size={20} />}
              </IconButton>
            )
          )}
          {!noDoors && (
            <button
              onClick={() => setAllDoors(!anyOpen)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-sunken px-3 text-sm font-bold text-ink transition active:brightness-95"
            >
              {anyOpen ? <DoorClosed size={18} /> : <DoorOpen size={18} />}
              {anyOpen ? '문 닫기' : '문 열기'}
            </button>
          )}
        </div>

        {egg && (
          <div className="pointer-events-none absolute top-2 left-2 z-10 flex animate-[fade-in_200ms] items-center gap-2 rounded-full bg-surface/95 py-1 pr-3 pl-1 shadow-card">
            <SunnyEgg size={28} />
            <span className="text-xs font-semibold text-muted">{noDoors ? '간식은 여기 숨겨 뒀어요, 지선 님' : '불 켜 뒀어요, 지선 님'}</span>
          </div>
        )}

        {mode === '3d' ? (
          <div className={cx(noDoors ? 'h-[72dvh]' : 'h-[60dvh]', 'min-h-80 w-full touch-none')}>
            <Suspense fallback={<div className="grid h-full place-items-center text-muted">불러오는 중…</div>}>
              <Fridge3D
                shape={shape}
                compartments={drawn.compartments}
                itemsByCompartment={drawn.itemsByCompartment}
                selectedId={selectedId}
                doorOpen={doorOpen}
                camera={camera}
                cameraNonce={cameraNonce}
                onSelect={setSelectedId}
                onToggleDoor={toggleDoor}
                onOpenItem={onOpen}
                onEgg={() => setEgg(true)}
                egg={egg}
                notes={doorNotes}
                photos={doorPhotos}
                celebration={celebration}
                onOpenNotes={onOpenNotes}
              />
            </Suspense>
          </div>
        ) : (
          <div className={cx('px-3 pt-14', showHint ? 'pb-8' : 'pb-3')}>
            <Fridge2D
              view={!anyOpen ? 'closed' : side ? 'side' : 'open'}
              shape={shape}
              compartments={drawn.compartments}
              itemsByCompartment={drawn.itemsByCompartment}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpenItem={onOpen}
              onOpenDoors={() => setAllDoors(true)}
              notes={doorNotes}
              photos={doorPhotos}
              celebration={celebration}
              onOpenNotes={onOpenNotes}
            />
          </div>
        )}

        {showHint && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 mx-auto w-fit rounded-full bg-surface/90 px-2.5 py-0.5 text-xs text-muted">문을 누르면 안이 보여요</p>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted">
        {LEGEND.map(([lv, label]) => (
          <span key={lv} className="flex items-center gap-1.5">
            <span className={cx('h-2 w-2 rounded-full', LEVEL_DOT[lv])} />
            {label}
          </span>
        ))}
        {/* 폰에서는 아래 줄로 내려 '식품 넣기' 버튼에 가리지 않게 */}
        <span className="basis-full text-faint sm:ml-auto sm:basis-auto">
          {/* 이스터에그: 한밤중(0–4시)에 열면 */}
          {hourKST() < 5
            ? '야식 시간이네요. 문은 살짝만 열어요'
            : mode === '3d'
              ? '끌어서 돌리고, 문이나 칸을 눌러 보세요'
              : '칸을 누르면 그 칸의 식품을 볼 수 있어요'}
        </span>
      </div>

      {unplaced.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {unplaced.map((c) => (
            <Chip key={c.id} active={selectedId === c.id} onClick={() => setSelectedId(c.id)}>
              {c.name} {(byComp.get(c.id) ?? []).length}
            </Chip>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="text-[13px] font-bold text-muted">
            {selected
              ? `${selected.name} · ${isDoorCompartment(selected) ? '문' : ZONE_LABEL[selected.zone]}`
              : `챙겨 먹을 것 ${urgent.length}개`}
          </h3>
          {selected && (
            <button onClick={() => onAddTo(selected.id)} className="text-sm font-bold text-accent">
              여기에 넣기
            </button>
          )}
        </div>
        <Card className="overflow-hidden">
          {(selected ? selectedItems : urgent).length ? (
            <ul className="divide-y divide-line">
              {(selected ? selectedItems : urgent).map((i) => (
                <ItemRow key={i.id} item={i} location={selected ? undefined : nameOf(i)} onOpen={onOpen} onUseOne={onUseOne} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted">
              {selected ? '비어 있어요' : '급하게 먹을 건 없어요. 칸을 누르면 그 칸의 식품이 보여요'}
            </p>
          )}
        </Card>
      </section>
    </div>
  )
}
