import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Edges, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { categoryOf } from '../lib/categories'
import { expiryLevel } from '../lib/expiry'
import {
  behindDoor,
  CATEGORY_COLOR,
  doorOf,
  isBin,
  isDoorCompartment,
  LEVEL_COLOR,
  pocketRectInDoor,
  sortByUrgency,
  type DoorSpec,
  type FridgeShape,
} from '../lib/fridgeShape'
import type { Compartment, Item } from '../lib/types'

export type CameraPreset = 'front' | 'left' | 'right' | 'top'

interface Props {
  shape: FridgeShape
  compartments: Compartment[]
  itemsByCompartment: Map<string, Item[]>
  selectedId: string | null
  /** 문별 열림 상태. 없으면 열림 */
  doorOpen: Record<string, boolean>
  camera: CameraPreset
  /** 프리셋 버튼을 다시 눌러도 카메라가 돌아가도록 */
  cameraNonce: number
  onSelect: (compartmentId: string | null) => void
  onToggleDoor: (doorId: string) => void
  onOpenItem: (item: Item) => void
}

const WALL = 0.03
const PANEL = 0.05
const POCKET_DEPTH = 0.11
const OPEN_ANGLE = (105 * Math.PI) / 180
/** 드래그(회전)와 탭을 구분하는 거리(px) */
const TAP_SLOP = 6

const isTap = (e: ThreeEvent<MouseEvent>) => e.delta <= TAP_SLOP

// ---------- 이모지 텍스처 ----------

const textureCache = new Map<string, THREE.CanvasTexture>()

function labelTexture(text: string, bg?: string, fg = '#fff'): THREE.CanvasTexture {
  const key = `${text}|${bg ?? ''}|${fg}`
  const hit = textureCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  if (bg) {
    g.fillStyle = bg
    g.beginPath()
    g.arc(64, 64, 60, 0, Math.PI * 2)
    g.fill()
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = fg
  g.font = `${bg ? 'bold 64px' : '92px'} system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
  g.fillText(text, 64, 70)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  textureCache.set(key, t)
  return t
}

// ---------- 식품 ----------

function ItemMesh({ item, size, position, onOpen }: { item: Item; size: number; position: [number, number, number]; onOpen: (i: Item) => void }) {
  const [hover, setHover] = useState(false)
  const lv = expiryLevel(item.expiry_date)
  const warn = lv === 'expired' || lv === 'urgent' || lv === 'soon'
  const s = size * (hover ? 1.12 : 1)
  return (
    <group
      position={position}
      userData={{ item: true }}
      onClick={(e) => {
        if (!isTap(e)) return
        e.stopPropagation()
        onOpen(item)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
    >
      <RoundedBox args={[s * 0.92, s * 0.8, s * 0.92]} radius={s * 0.12} smoothness={2} userData={{ item: true }}>
        <meshStandardMaterial color={warn ? LEVEL_COLOR[lv] : (CATEGORY_COLOR[item.category] ?? '#e2e8f0')} roughness={0.6} />
      </RoundedBox>
      <sprite position={[0, s * 0.12, s * 0.5]} scale={[s * 0.85, s * 0.85, 1]} userData={{ item: true }}>
        <spriteMaterial map={labelTexture(categoryOf(item.category).emoji)} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

function MoreBadge({ count, size, position }: { count: number; size: number; position: [number, number, number] }) {
  return (
    <sprite position={position} scale={[size * 0.8, size * 0.8, 1]}>
      <spriteMaterial map={labelTexture(`+${count}`, '#334155')} transparent depthWrite={false} />
    </sprite>
  )
}

/** 사각 바닥 영역(w × d)에 식품을 앞줄부터 채워 놓는다 */
function ItemGrid({
  items,
  width,
  depth,
  maxSize,
  floorY,
  onOpen,
}: {
  items: Item[]
  width: number
  depth: number
  maxSize: number
  floorY: number
  onOpen: (i: Item) => void
}) {
  if (!items.length) return null
  const size = Math.max(0.04, Math.min(0.1, maxSize))
  const pitch = size * 1.2
  const cols = Math.max(1, Math.floor(width / pitch))
  const rows = Math.max(1, Math.floor(depth / pitch))
  const capacity = cols * rows
  const sorted = sortByUrgency(items)
  const shown = sorted.length > capacity ? sorted.slice(0, capacity - 1) : sorted
  const slot = (i: number): [number, number, number] => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const used = Math.min(cols, shown.length + (sorted.length > capacity ? 1 : 0))
    const x = (col - (used - 1) / 2) * pitch
    return [x, floorY + size * 0.4, depth / 2 - pitch / 2 - row * pitch]
  }
  return (
    <>
      {shown.map((it, i) => (
        <ItemMesh key={it.id} item={it} size={size} position={slot(i)} onOpen={onOpen} />
      ))}
      {sorted.length > capacity && <MoreBadge count={sorted.length - shown.length} size={size} position={slot(capacity - 1)} />}
    </>
  )
}

// ---------- 칸 ----------

const glass = { color: '#dbeafe', transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0 }

function hitHandlers(id: string, onSelect: (id: string | null) => void) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!isTap(e)) return
      // 칸 안의 식품을 누른 경우엔 식품 쪽에서 처리
      if (e.intersections.some((h) => h.object.userData.item)) return
      e.stopPropagation()
      onSelect(id)
    },
  }
}

function CabinetCompartment({
  c,
  shape,
  items,
  selected,
  onSelect,
  onOpen,
}: {
  c: Compartment
  shape: FridgeShape
  items: Item[]
  selected: boolean
  onSelect: (id: string | null) => void
  onOpen: (i: Item) => void
}) {
  const W = shape.width / 1000
  const H = shape.height / 1000
  const D = shape.depth / 1000
  const l = c.layout!
  const iw = W - WALL * 2
  const ih = H - WALL * 2
  const x0 = -W / 2 + WALL + l.x * iw + 0.012
  const x1 = -W / 2 + WALL + (l.x + l.w) * iw - 0.012
  const yTop = H - WALL - l.y * ih
  const yBot = H - WALL - (l.y + l.h) * ih
  const z0 = -D / 2 + WALL + 0.01
  const z1 = D / 2 - PANEL - POCKET_DEPTH - 0.015
  const w = x1 - x0
  const h = yTop - yBot
  const d = z1 - z0
  const bin = isBin(c)
  const binH = Math.min(h * 0.75, 0.3)

  return (
    <group position={[(x0 + x1) / 2, yBot, (z0 + z1) / 2]}>
      {bin ? (
        <mesh position={[0, binH / 2, 0]}>
          <boxGeometry args={[w, binH, d]} />
          <meshStandardMaterial {...glass} opacity={0.18} depthWrite={false} />
          <Edges color={selected ? '#0284c7' : '#94a3b8'} />
        </mesh>
      ) : (
        <mesh position={[0, 0.004, 0]}>
          <boxGeometry args={[w + 0.02, 0.008, d]} />
          <meshStandardMaterial {...glass} />
          {selected && <Edges color="#0284c7" />}
        </mesh>
      )}
      {/* 칸 선택용 투명 영역 */}
      <mesh position={[0, h / 2, 0]} {...hitHandlers(c.id, onSelect)}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={selected ? 0.12 : 0} depthWrite={false} />
      </mesh>
      <ItemGrid items={items} width={w - 0.02} depth={d} maxSize={h * 0.6} floorY={0.008} onOpen={onOpen} />
    </group>
  )
}

// ---------- 문 ----------

function Door({
  door,
  shape,
  open,
  pockets,
  itemsByCompartment,
  hiddenWarnings,
  selectedId,
  onToggle,
  onSelect,
  onOpen,
}: {
  door: DoorSpec
  shape: FridgeShape
  open: boolean
  pockets: Compartment[]
  itemsByCompartment: Map<string, Item[]>
  /** 문이 닫혀 있을 때 앞에 띄울 경고 개수 */
  hiddenWarnings: number
  selectedId: string | null
  onToggle: () => void
  onSelect: (id: string | null) => void
  onOpen: (i: Item) => void
}) {
  const ref = useRef<THREE.Group>(null)
  const W = shape.width / 1000
  const H = shape.height / 1000
  const D = shape.depth / 1000
  const gap = 0.004
  const dw = door.rect.w * W - gap
  const dh = door.rect.h * H - gap
  const left = door.hinge === 'left'
  const sign = left ? 1 : -1
  const hingeX = -W / 2 + (left ? door.rect.x : door.rect.x + door.rect.w) * W + (left ? gap / 2 : -gap / 2)
  const cy = H - (door.rect.y + door.rect.h / 2) * H
  const target = open ? (left ? -OPEN_ANGLE : OPEN_ANGLE) : 0

  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const diff = target - g.rotation.y
    if (Math.abs(diff) < 0.001) {
      g.rotation.y = target
      return
    }
    g.rotation.y += diff * Math.min(1, dt * 8)
    state.invalidate()
  })

  return (
    <group ref={ref} position={[hingeX, cy, D / 2 - PANEL]}>
      <group position={[(sign * dw) / 2, 0, 0]}>
        <mesh
          position={[0, 0, PANEL / 2]}
          onClick={(e) => {
            if (!isTap(e)) return
            e.stopPropagation()
            onToggle()
          }}
        >
          <boxGeometry args={[dw, dh, PANEL]} />
          <meshStandardMaterial
            color={shape.door.color}
            metalness={shape.door.metal ? 0.6 : 0.05}
            roughness={shape.door.metal ? 0.35 : 0.55}
          />
        </mesh>
        {/* 손잡이: 경첩 반대편 */}
        <mesh position={[sign * (dw / 2 - 0.035), 0, PANEL + 0.012]}>
          <boxGeometry args={[0.018, Math.min(dh * 0.5, 0.45), 0.02]} />
          <meshStandardMaterial color="#8b9097" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* 문 가장자리 패킹: 닫았을 때 문 사이로 안이 비치지 않게 */}
        <mesh position={[sign * (dw / 2 - 0.004), 0, -0.012]}>
          <boxGeometry args={[0.016, dh - 0.01, 0.024]} />
          <meshStandardMaterial color="#9ca3af" />
        </mesh>
        {/* 문 안쪽 면 */}
        <mesh position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[dw - 0.02, dh - 0.02]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        {!open && hiddenWarnings > 0 && (
          <sprite position={[0, dh / 2 - 0.1, PANEL + 0.04]} scale={[0.1, 0.1, 1]}>
            <spriteMaterial map={labelTexture(String(hiddenWarnings), '#ea580c')} transparent />
          </sprite>
        )}
        {pockets.map((p) => (
          <Pocket
            key={p.id}
            c={p}
            door={door}
            dw={dw}
            dh={dh}
            items={itemsByCompartment.get(p.id) ?? []}
            selected={selectedId === p.id}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        ))}
      </group>
    </group>
  )
}

function Pocket({
  c,
  door,
  dw,
  dh,
  items,
  selected,
  onSelect,
  onOpen,
}: {
  c: Compartment
  door: DoorSpec
  dw: number
  dh: number
  items: Item[]
  selected: boolean
  onSelect: (id: string | null) => void
  onOpen: (i: Item) => void
}) {
  const r = pocketRectInDoor(door, c)
  const w = r.w * dw
  const h = r.h * dh
  // 세로로 긴 포켓(냉동고 문)은 선반 여러 단으로 나눈다
  const tiers = Math.max(1, Math.round(h / 0.22))
  const tierH = h / tiers
  const sorted = sortByUrgency(items)
  const per = Math.ceil(sorted.length / tiers)
  const top = dh / 2 - r.y * dh
  const lipH = Math.min(0.07, tierH * 0.45)
  return (
    <group position={[(r.x + r.w / 2 - 0.5) * dw, top - h, -POCKET_DEPTH / 2]}>
      {Array.from({ length: tiers }, (_, t) => {
        const y = t * tierH
        const tierItems = sorted.slice((tiers - 1 - t) * per, (tiers - t) * per)
        return (
          <group key={t} position={[0, y, 0]}>
            <mesh position={[0, 0.004, 0]}>
              <boxGeometry args={[w, 0.008, POCKET_DEPTH]} />
              <meshStandardMaterial color="#e2e8f0" transparent opacity={0.85} />
            </mesh>
            <mesh position={[0, lipH / 2, -POCKET_DEPTH / 2]}>
              <boxGeometry args={[w, lipH, 0.006]} />
              <meshStandardMaterial {...glass} opacity={0.45} />
              {selected && <Edges color="#0284c7" />}
            </mesh>
            <ItemGrid
              items={tierItems}
              width={w - 0.01}
              depth={POCKET_DEPTH}
              maxSize={Math.min(tierH * 0.6, POCKET_DEPTH * 0.8)}
              floorY={0.008}
              onOpen={onOpen}
            />
          </group>
        )
      })}
      <mesh position={[0, h / 2, 0]} {...hitHandlers(c.id, onSelect)}>
        <boxGeometry args={[w, h, POCKET_DEPTH]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={selected ? 0.15 : 0} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ---------- 몸체 ----------

function Cabinet({ shape }: { shape: FridgeShape }) {
  const W = shape.width / 1000
  const H = shape.height / 1000
  const D = shape.depth / 1000
  const bodyD = D - PANEL
  const zc = -PANEL / 2
  const mat = <meshStandardMaterial color={shape.body} metalness={0.3} roughness={0.5} />
  const inner = <meshStandardMaterial color="#f8fafc" roughness={0.8} />
  const iw = W - WALL * 2
  const ih = H - WALL * 2
  return (
    <group>
      {/* 바깥 */}
      <mesh position={[-W / 2 + WALL / 2, H / 2, zc]}>
        <boxGeometry args={[WALL, H, bodyD]} />
        {mat}
      </mesh>
      <mesh position={[W / 2 - WALL / 2, H / 2, zc]}>
        <boxGeometry args={[WALL, H, bodyD]} />
        {mat}
      </mesh>
      <mesh position={[0, H - WALL / 2, zc]}>
        <boxGeometry args={[W, WALL, bodyD]} />
        {mat}
      </mesh>
      <mesh position={[0, WALL / 2, zc]}>
        <boxGeometry args={[W, WALL, bodyD]} />
        {mat}
      </mesh>
      <mesh position={[0, H / 2, -D / 2 + WALL / 2]}>
        <boxGeometry args={[W, H, WALL]} />
        {inner}
      </mesh>
      {/* 칸막이 */}
      {shape.dividers.map((dv, i) =>
        dv.dir === 'h' ? (
          <mesh key={i} position={[-W / 2 + WALL + ((dv.from + dv.to) / 2) * iw, H - WALL - dv.at * ih, zc]}>
            <boxGeometry args={[(dv.to - dv.from) * iw, 0.05, bodyD]} />
            {inner}
          </mesh>
        ) : (
          <mesh key={i} position={[-W / 2 + WALL + dv.at * iw, H - WALL - ((dv.from + dv.to) / 2) * ih, zc]}>
            <boxGeometry args={[0.04, (dv.to - dv.from) * ih, bodyD]} />
            {inner}
          </mesh>
        ),
      )}
    </group>
  )
}

// ---------- 카메라 ----------

function CameraRig({ shape, preset, nonce }: { shape: FridgeShape; preset: CameraPreset; nonce: number }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, invalidate, size } = useThree()
  const H = shape.height / 1000
  const W = shape.width / 1000
  const goal = useRef<THREE.Vector3 | null>(null)
  const center = useMemo(() => new THREE.Vector3(0, H / 2, 0), [H])

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const fov = (cam.fov * Math.PI) / 180
    // 문을 연 상태(폭 ≈ 2.6배)까지 화면에 들어오게
    const fitH = (H * 1.08) / 2 / Math.tan(fov / 2)
    const fitW = (W * 1.7) / 2 / Math.tan(fov / 2) / aspect
    const dist = Math.max(fitH, fitW) + shape.depth / 1000
    const dir =
      preset === 'front'
        ? new THREE.Vector3(0, 0.12, 1)
        : preset === 'left'
          ? new THREE.Vector3(-0.8, 0.2, 0.75)
          : preset === 'right'
            ? new THREE.Vector3(0.8, 0.2, 0.75)
            : new THREE.Vector3(0, 1.4, 0.7)
    goal.current = dir.normalize().multiplyScalar(dist).add(center)
    controls.current?.target.copy(center)
    invalidate()
  }, [preset, nonce, shape, camera, size, H, W, center, invalidate])

  useFrame((state, dt) => {
    if (!goal.current) return
    camera.position.lerp(goal.current, Math.min(1, dt * 6))
    controls.current?.update()
    if (camera.position.distanceTo(goal.current) < 0.002) goal.current = null
    else state.invalidate()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      minDistance={0.6}
      maxDistance={8}
      maxPolarAngle={Math.PI * 0.58}
      target={center}
    />
  )
}

// ---------- 장면 ----------

export default function Fridge3D(props: Props) {
  const { shape, compartments, itemsByCompartment, selectedId, doorOpen, camera, cameraNonce, onSelect, onToggleDoor, onOpenItem } = props

  const placed = compartments.filter((c) => c.layout)
  const cabinet = placed.filter((c) => !isDoorCompartment(c))
  const pocketsByDoor = new Map<string, Compartment[]>()
  for (const c of placed.filter(isDoorCompartment)) {
    const d = doorOf(shape, c)
    if (d) pocketsByDoor.set(d.id, [...(pocketsByDoor.get(d.id) ?? []), c])
  }

  const warningsBehind = (door: DoorSpec) => {
    let n = 0
    for (const c of placed) {
      if (!behindDoor(shape, door, c)) continue
      for (const i of itemsByCompartment.get(c.id) ?? []) {
        const lv = expiryLevel(i.expiry_date)
        if (lv === 'expired' || lv === 'urgent') n++
      }
    }
    return n
  }

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 35, near: 0.05, far: 50, position: [0, 1, 4] }}
      onPointerMissed={(e) => e.type === 'click' && onSelect(null)}
    >
      <color attach="background" args={['#eef2f7']} />
      <hemisphereLight args={['#ffffff', '#cbd5e1', 1.4]} />
      <directionalLight position={[2, 4, 5]} intensity={1.6} />
      <directionalLight position={[-3, 2, 2]} intensity={0.5} />
      <pointLight position={[0, (shape.height / 1000) * 0.9, 0]} intensity={0.6} distance={2} />
      <CameraRig shape={shape} preset={camera} nonce={cameraNonce} />

      <Cabinet shape={shape} />
      {cabinet.map((c) => (
        <CabinetCompartment
          key={c.id}
          c={c}
          shape={shape}
          items={itemsByCompartment.get(c.id) ?? []}
          selected={selectedId === c.id}
          onSelect={onSelect}
          onOpen={onOpenItem}
        />
      ))}
      {shape.doors.map((d) => (
        <Door
          key={d.id}
          door={d}
          shape={shape}
          open={doorOpen[d.id] ?? true}
          pockets={pocketsByDoor.get(d.id) ?? []}
          itemsByCompartment={itemsByCompartment}
          hiddenWarnings={warningsBehind(d)}
          selectedId={selectedId}
          onToggle={() => onToggleDoor(d.id)}
          onSelect={onSelect}
          onOpen={onOpenItem}
        />
      ))}
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color="#dfe5ec" />
      </mesh>
    </Canvas>
  )
}
