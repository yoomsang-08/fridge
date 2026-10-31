import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Edges, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { categoryOf } from '../lib/categories'
import { expiryLevel } from '../lib/expiry'
import {
  behindDoor,
  doorOf,
  isBin,
  isDoorCompartment,
  LEVEL_RING,
  pocketRectInDoor,
  shapeOfItem,
  sortByUrgency,
  tintHex,
  token,
  type DoorSpec,
  type FridgeShape,
} from '../lib/fridgeShape'
import { BUNTING, type Celebration } from '../lib/celebrations'
import { magnetOf } from '../lib/notes'
import { bodyColor, SHAPE_HEIGHT } from '../lib/container3d'
import { Container3D } from './Container3D'
import type { Compartment, FridgePhoto, Item, Note } from '../lib/types'

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
  /** 이스터에그: 안쪽 천장 조명을 연달아 누르면 */
  onEgg: () => void
  /** 이스터에그가 켜져 있는 동안 맨 위 칸에 반숙 달걀 */
  egg: boolean
  /** 첫 번째 문 앞면에 붙일 메모. 누르면 onOpenNotes */
  notes?: Note[]
  onOpenNotes?: () => void
  /** 두 번째 문(없으면 첫 번째 문) 앞면에 붙일 사진 */
  photos?: FridgePhoto[]
  /** 오늘이 생일·기념일이면 닫힌 문 위쪽에 가랜드와 축하 문구 */
  celebration?: Celebration | null
}

const WALL = 0.03
const PANEL = 0.05
const POCKET_DEPTH = 0.11
const OPEN_ANGLE = (105 * Math.PI) / 180
const NOTE_TILT = [-0.05, 0.035, -0.025]
/** 문 앞 메모 크기(m). 닫힌 문 정면에서 폰 글자가 11px 이상 되게 */
const NOTE_SIZE = 0.21
const NOTE_STEP = 0.215
/** 드래그(회전)와 탭을 구분하는 거리(px) */
const TAP_SLOP = 6

const isTap = (e: ThreeEvent<MouseEvent>) => e.delta <= TAP_SLOP

// ---------- 이모지 텍스처 ----------

const textureCache = new Map<string, THREE.CanvasTexture>()

function cachedTexture(key: string, draw: (g: CanvasRenderingContext2D) => void, w = 128, h = 128) {
  const hit = textureCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  textureCache.set(key, t)
  return t
}

const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif'
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

/** 식품 앞면: 분류 tint 동그라미 + 이모지, 기한 단계면 테두리 */
function chipTexture(emoji: string, tint: string, ring?: string) {
  return cachedTexture(`chip|${emoji}|${tint}|${ring ?? ''}`, (g) => {
    g.fillStyle = tint
    g.beginPath()
    g.arc(64, 64, 58, 0, Math.PI * 2)
    g.fill()
    if (ring) {
      g.strokeStyle = ring
      g.lineWidth = 10
      g.stroke()
    }
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `72px ${EMOJI_FONT}`
    g.fillText(emoji, 64, 70)
  })
}

/** 작은 알약 배지: soft 바탕 + 진한 글자 */
function pillTexture(text: string, bg: string, fg: string) {
  return cachedTexture(
    `pill|${text}|${bg}|${fg}`,
    (g) => {
      g.fillStyle = bg
      g.beginPath()
      g.roundRect(4, 4, 248, 120, 60)
      g.fill()
      g.fillStyle = fg
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `bold 64px ${FONT}`
      g.fillText(text, 128, 68)
    },
    256,
    128,
  )
}

/** 밝은 새틴 문 앞면: 위에서 아래로 아주 옅게 어두워진다 */
function satinTexture(base: string) {
  return cachedTexture(
    `satin|${base}`,
    (g) => {
      const c = new THREE.Color(base)
      const top = c.clone().lerp(new THREE.Color('#ffffff'), 0.35)
      const bottom = c.clone().multiplyScalar(0.96)
      const grad = g.createLinearGradient(0, 0, 0, 256)
      grad.addColorStop(0, `#${top.getHexString()}`)
      grad.addColorStop(1, `#${bottom.getHexString()}`)
      g.fillStyle = grad
      g.fillRect(0, 0, 8, 256)
    },
    8,
    256,
  )
}

/** 냉장고 문에 붙은 메모: 종이색 + 자석 + 앞 몇 줄 */
function noteTexture(note: Note) {
  return cachedTexture(
    `note|${note.id}|${note.color}|${note.body}`,
    (g) => {
      g.fillStyle = token(`note-${note.color}`)
      g.beginPath()
      g.roundRect(0, 0, 256, 256, 10)
      g.fill()
      const magnet = magnetOf(note.body)
      g.textAlign = 'center'
      if (magnet === 'heart') {
        g.fillStyle = token('accent')
        g.font = `44px ${FONT}`
        g.fillText('♥', 128, 46)
      } else if (magnet === 'cake') {
        g.fillStyle = token('accent')
        g.beginPath()
        g.roundRect(104, 22, 48, 28, 5)
        g.fill()
        g.fillRect(126, 6, 4, 16)
      } else if (magnet === 'egg') {
        g.fillStyle = '#ffffff'
        g.beginPath()
        g.ellipse(128, 26, 22, 18, 0, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#f6c343'
        g.beginPath()
        g.arc(128, 26, 9, 0, Math.PI * 2)
        g.fill()
      } else {
        g.fillStyle = token('accent')
        g.beginPath()
        g.arc(128, 24, 13, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = token('ink')
      g.font = `bold 44px ${FONT}`
      g.textAlign = 'left'
      // 어절(띄어쓰기) 단위로 줄바꿈(keep-all). 한 어절이 한 줄보다 길 때만 글자 단위로 자른다
      const MAX = 226
      const lines: string[] = []
      let line = ''
      for (const word of note.body.trim().split(/\s+/)) {
        const next = line ? `${line} ${word}` : word
        if (g.measureText(next).width <= MAX) {
          line = next
          continue
        }
        if (line) lines.push(line)
        line = ''
        for (const ch of word) {
          if (line && g.measureText(line + ch).width > MAX) {
            lines.push(line)
            line = ch
          } else line += ch
        }
      }
      lines.push(line)
      const shown = lines.slice(0, 4)
      if (lines.length > 4) shown[3] = shown[3].slice(0, -1) + '…'
      shown.forEach((l, i) => g.fillText(l, 15, 90 + i * 50))
    },
    256,
    256,
  )
}

/** 문에 붙인 사진 한 장: 흰 테두리(폴라로이드) + 사진. 사진은 4:5 로 가운데를 잘라 보인다 */
const PHOTO_TILT = [0.035, -0.03]
const PHOTO_W = 0.22

function usePhotoTexture(url: string, aspect: number) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let alive = true
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(url, (t) => {
      if (!alive) return t.dispose()
      t.colorSpace = THREE.SRGBColorSpace
      // object-fit: cover 처럼 가운데를 4:5 로 자른다
      const img = t.image as { width: number; height: number }
      const ia = img.width / img.height
      if (ia > aspect) {
        t.repeat.set(aspect / ia, 1)
        t.offset.set((1 - aspect / ia) / 2, 0)
      } else {
        t.repeat.set(1, ia / aspect)
        t.offset.set(0, (1 - ia / aspect) / 2)
      }
      setTex(t)
      invalidate()
    })
    return () => {
      alive = false
    }
  }, [url, aspect, invalidate])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}

function DoorPhoto({ photo, position, tilt, onOpen }: { photo: FridgePhoto; position: [number, number, number]; tilt: number; onOpen?: () => void }) {
  const pad = PHOTO_W * 0.06
  const iw = PHOTO_W - pad * 2
  const ih = iw * 1.25
  const fh = ih + pad + pad * 3.2
  const tex = usePhotoTexture(photo.url, iw / ih)
  return (
    <group
      position={position}
      rotation={[0, 0, tilt]}
      onClick={(e) => {
        if (!isTap(e)) return
        e.stopPropagation()
        onOpen?.()
      }}
    >
      <mesh>
        <planeGeometry args={[PHOTO_W, fh]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[0, fh / 2 - pad - ih / 2, 0.0005]}>
        <planeGeometry args={[iw, ih]} />
        {tex ? <meshBasicMaterial key="photo" map={tex} toneMapped={false} /> : <meshBasicMaterial key="blank" color="#e5e7e6" />}
      </mesh>
      <mesh position={[0, fh / 2 - 0.004, 0.001]}>
        <circleGeometry args={[0.011, 20]} />
        <meshBasicMaterial color={token('accent')} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** 기념일 현수막: 위에는 깃발 가랜드, 아래에는 축하 문구 */
function bannerTexture(c: Celebration) {
  return cachedTexture(
    `banner|${c.id}`,
    (g) => {
      const w = 1040
      // 가랜드: 처진 줄에 깃발
      g.strokeStyle = token('muted')
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(10, 8)
      g.quadraticCurveTo(w / 2, 58, w - 10, 8)
      g.stroke()
      const n = 13
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n
        const x = 10 + (w - 20) * t
        const y = 8 + 100 * t * (1 - t)
        const fw = ((w - 20) / n) * 0.78
        g.fillStyle = token(BUNTING[i % BUNTING.length])
        g.strokeStyle = token('line')
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(x - fw / 2, y)
        g.lineTo(x + fw / 2, y)
        g.lineTo(x, y + fw * 1.05)
        g.closePath()
        g.fill()
        g.stroke()
      }
      // 축하 문구 카드
      g.fillStyle = token('surface')
      g.beginPath()
      g.roundRect(90, 92, w - 180, 160, 30)
      g.fill()
      g.textAlign = 'center'
      g.fillStyle = token('accent')
      g.font = `800 62px ${FONT}`
      g.fillText(c.title, w / 2, 160)
      g.fillStyle = token('muted')
      g.font = `600 44px ${FONT}`
      g.fillText(c.message, w / 2, 226)
    },
    1040,
    260,
  )
}

function CelebrationBanner({ shape, celebration }: { shape: FridgeShape; celebration: Celebration }) {
  const W = shape.width / 1000
  const H = shape.height / 1000
  const D = shape.depth / 1000
  const bw = W * 0.86
  const bh = (bw * 260) / 1040
  return (
    <mesh position={[0, H - 0.012 - bh / 2, D / 2 + 0.006]} renderOrder={2}>
      <planeGeometry args={[bw, bh]} />
      <meshBasicMaterial map={bannerTexture(celebration)} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

// ---------- 식품 ----------

function ItemMesh({
  item,
  size,
  position,
  onOpen,
  space,
}: {
  item: Item
  size: number
  position: [number, number, number]
  onOpen: (i: Item) => void
  space: 'fridge' | 'pantry'
}) {
  const [hover, setHover] = useState(false)
  const lv = expiryLevel(item.expiry_date)
  const ring = LEVEL_RING[lv]
  const cat = categoryOf(item.category)
  const kind = shapeOfItem(item)
  const color = bodyColor(tintHex(cat.tint), kind, space)
  const s = size * (hover ? 1.08 : 1)
  const h = SHAPE_HEIGHT[kind] * s
  return (
    <group
      position={position}
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
      <Container3D shape={kind} s={s} color={color} />
      {/* 누르는 자리: 모양과 상관없이 바닥 한 칸 크기 상자 */}
      <mesh position={[0, Math.max(h, s * 0.4) / 2, 0]} userData={{ item: true }}>
        <boxGeometry args={[s, Math.max(h, s * 0.4), s * 0.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* 접지 그림자: 선반 위에 '놓인' 느낌 */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[s * 0.55, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {/* 기한 링: 지남·3일·7일만, 바닥에 얇게 */}
      {ring && (
        <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[s * 0.44, s * 0.52, 32]} />
          <meshBasicMaterial color={token(ring)} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* 이름표: 작게, 늘 카메라 쪽 */}
      <sprite position={[0, Math.max(h * 0.5, s * 0.3), s * 0.42]} scale={[s * 0.4, s * 0.4, 1]}>
        <spriteMaterial map={chipTexture(cat.emoji, '#ffffff')} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

function MoreBadge({ count, size, position }: { count: number; size: number; position: [number, number, number] }) {
  return (
    <sprite position={[position[0], position[1] + size * 0.3, position[2]]} scale={[size * 1.2, size * 0.6, 1]}>
      <spriteMaterial map={pillTexture(`+${count}`, token('sunken'), token('muted'))} transparent depthWrite={false} />
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
  spread = false,
}: {
  items: Item[]
  width: number
  depth: number
  maxSize: number
  floorY: number
  onOpen: (i: Item) => void
  /** 팬트리처럼 칸이 넓고 얕으면 크게, 칸 폭 전체에 고르게 */
  spread?: boolean
}) {
  if (!items.length) return null
  // 넓게 놓을 땐 크게 그리되, 팬트리는 모자라면 안 되니 칸 바닥에 전부 들어갈 때까지 줄인다
  let size = Math.max(0.035, Math.min(spread ? 0.13 : 0.12, maxSize, spread ? width / 1.2 / Math.min(items.length, 3) : Infinity))
  while (spread && size > 0.035 && Math.floor(width / (size * 1.2)) * Math.max(1, Math.floor(depth / (size * 1.2))) < items.length) size *= 0.92
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
    const x = spread ? (col + 0.5) * (width / used) - width / 2 : (col - (used - 1) / 2) * pitch
    return [x, floorY, depth / 2 - pitch / 2 - row * pitch]
  }
  return (
    <>
      {shown.map((it, i) => (
        <ItemMesh key={it.id} item={it} size={size} position={slot(i)} onOpen={onOpen} space={spread ? 'pantry' : 'fridge'} />
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
  // 문 없는 선반장은 문 포켓 자리가 없으니 앞까지 쓴다
  const z1 = D / 2 - PANEL - (shape.doors.length ? POCKET_DEPTH : 0) - 0.015
  const w = x1 - x0
  const h = yTop - yBot
  const d = z1 - z0
  const bin = isBin(c)
  const binH = Math.min(h * 0.75, 0.3)

  return (
    <group position={[(x0 + x1) / 2, yBot, (z0 + z1) / 2]}>
      {shape.wood ? (
        bin ? (
          <Basket w={w} h={Math.min(h * 0.45, 0.12)} d={d} color={shape.wood.basket} selected={selected} />
        ) : (
          <mesh position={[0, 0.009, 0]}>
            <boxGeometry args={[w + 0.024, 0.018, d + 0.01]} />
            <meshStandardMaterial color={shape.wood.board} roughness={0.75} />
            {selected && <Edges color={token('accent')} />}
          </mesh>
        )
      ) : bin ? (
        <mesh position={[0, binH / 2, 0]}>
          <boxGeometry args={[w, binH, d]} />
          <meshStandardMaterial {...glass} opacity={0.18} depthWrite={false} />
          <Edges color={selected ? token('accent') : '#9aa59f'} />
        </mesh>
      ) : (
        <mesh position={[0, 0.004, 0]}>
          <boxGeometry args={[w + 0.02, 0.008, d]} />
          <meshStandardMaterial {...glass} />
          {selected && <Edges color={token('accent')} />}
        </mesh>
      )}
      {/* 칸 선택용 투명 영역 */}
      <mesh position={[0, h / 2, 0]} {...hitHandlers(c.id, onSelect)}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color={token('accent')} transparent opacity={selected ? 0.12 : 0} depthWrite={false} />
      </mesh>
      <ItemGrid items={items} width={w - 0.02} depth={d} maxSize={h * 0.6} floorY={shape.wood && !bin ? 0.018 : 0.008} onOpen={onOpen} spread={!!shape.wood} />
    </group>
  )
}

/** 팬트리 바구니: 바닥과 네 벽만 있는 둥근 통. 앞 벽을 낮게 해 안의 식품이 보이게 */
function Basket({ w, h, d, color, selected }: { w: number; h: number; d: number; color: string; selected: boolean }) {
  const t = 0.012
  const front = h * 0.4
  const mat = <meshStandardMaterial color={color} roughness={0.85} />
  const edge = selected ? <Edges color={token('accent')} /> : null
  return (
    <group>
      <RoundedBox args={[w, t, d]} radius={t / 2} position={[0, t / 2, 0]}>
        {mat}
      </RoundedBox>
      {[-1, 1].map((side) => (
        <RoundedBox key={side} args={[t, h, d]} radius={t / 2} position={[side * (w / 2 - t / 2), h / 2, 0]}>
          {mat}
          {edge}
        </RoundedBox>
      ))}
      <RoundedBox args={[w, h, t]} radius={t / 2} position={[0, h / 2, -d / 2 + t / 2]}>
        {mat}
      </RoundedBox>
      <RoundedBox args={[w, front, t]} radius={t / 2} position={[0, front / 2, d / 2 - t / 2]}>
        {mat}
        {edge}
      </RoundedBox>
    </group>
  )
}

// ---------- 문 ----------

const GROOVE = '#1c1d20'
/** 무광 문 앞면 기본색 (디자인 가이드: 밝은 새틴) */
const SATIN = '#e9ecea'

/** 손잡이: 비스포크는 위아래 문 사이 가로 홈, 쿠쿠는 경첩 반대쪽 옆면의 세로 홈 */
function Handle({ shape, door, dw, dh, sign }: { shape: FridgeShape; door: DoorSpec; dw: number; dh: number; sign: number }) {
  if (shape.handle === 'groove-h') {
    // 다른 문과 맞닿는 가로 모서리 쪽에 홈
    const atBottom = door.rect.y + door.rect.h < 0.999
    const y = atBottom ? -dh / 2 + 0.012 : dh / 2 - 0.012
    return (
      <>
        <mesh position={[0, y, PANEL + 0.002]}>
          <boxGeometry args={[dw - 0.004, 0.024, 0.004]} />
          <meshStandardMaterial color={GROOVE} roughness={0.7} />
        </mesh>
        {/* 문 안쪽 가장자리의 얇은 세로 손잡이 (2D와 같은 자리) */}
        <mesh position={[sign * (dw / 2 - 0.006), atBottom ? -dh * 0.18 : dh * 0.18, PANEL + 0.002]}>
          <boxGeometry args={[0.006, Math.min(dh * 0.3, 0.3), 0.004]} />
          <meshStandardMaterial color={GROOVE} roughness={0.7} />
        </mesh>
      </>
    )
  }
  return (
    <mesh position={[sign * (dw / 2 - 0.006), dh * 0.1, PANEL + 0.002]}>
      <boxGeometry args={[0.012, Math.min(dh * 0.3, 0.35), 0.004]} />
      <meshStandardMaterial color={GROOVE} roughness={0.7} />
    </mesh>
  )
}

/** 문 앞 표시창(쿠쿠 상단 디스플레이). 정면 비율 좌표를 이 문의 로컬 좌표로 옮긴다 */
function DoorDisplay({ shape, door, dw, dh }: { shape: FridgeShape; door: DoorSpec; dw: number; dh: number }) {
  const d = shape.display!
  const cx = d.x + d.w / 2
  const cy = d.y + d.h / 2
  if (cx < door.rect.x || cx > door.rect.x + door.rect.w || cy < door.rect.y || cy > door.rect.y + door.rect.h) return null
  const lx = ((cx - door.rect.x) / door.rect.w - 0.5) * dw
  const ly = (0.5 - (cy - door.rect.y) / door.rect.h) * dh
  const w = (d.w / door.rect.w) * dw
  const h = (d.h / door.rect.h) * dh
  return (
    <group position={[lx, ly, PANEL + 0.002]}>
      <mesh>
        <boxGeometry args={[w, h, 0.003]} />
        <meshStandardMaterial color="#111214" roughness={0.3} />
      </mesh>
      {[0.28, 0.05, -0.18].map((t) => (
        <mesh key={t} position={[0, h * t, 0.002]}>
          <planeGeometry args={[w * 0.55, h * 0.08]} />
          <meshBasicMaterial color="#9aa3ad" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

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
  notes = [],
  photos = [],
  drop = 0,
  onOpenNotes,
}: {
  door: DoorSpec
  shape: FridgeShape
  open: boolean
  /** 문 앞면에 붙일 메모 */
  notes?: Note[]
  photos?: FridgePhoto[]
  /** 기념일 현수막이 걸리면 메모·사진을 그만큼 아래로 (m) */
  drop?: number
  onOpenNotes?: () => void
  pockets: Compartment[]
  itemsByCompartment: Map<string, Item[]>
  /** 문이 닫혀 있을 때 앞에 띄울 경고: 가장 급한 단계와 그 개수 */
  hiddenWarnings: { level: 'expired' | 'urgent'; count: number } | null
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
          <meshStandardMaterial color={shape.door.frame} metalness={0.3} roughness={0.5} />
        </mesh>
        {/* 문 앞판: 테두리를 살짝 남기고 덮는다 */}
        <mesh position={[0, 0, PANEL + 0.0006]}>
          <planeGeometry args={[dw - 0.006, dh - 0.006]} />
          {shape.door.metal ? (
            <meshStandardMaterial color={shape.door.color} metalness={0.55} roughness={0.38} />
          ) : (
            // 조명에 회색으로 죽지 않게 자체 밝기를 조금 더한 새틴
            <meshStandardMaterial
              map={satinTexture(SATIN)}
              emissiveMap={satinTexture(SATIN)}
              emissive="#ffffff"
              emissiveIntensity={0.55}
              metalness={0.05}
              roughness={0.45}
            />
          )}
        </mesh>
        <Handle shape={shape} door={door} dw={dw} dh={dh} sign={sign} />
        {shape.display && <DoorDisplay shape={shape} door={door} dw={dw} dh={dh} />}
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
        {!open && hiddenWarnings && (
          <sprite position={[0, dh / 2 - 0.12, PANEL + 0.03]} scale={[0.16, 0.08, 1]}>
            <spriteMaterial
              map={pillTexture(
                `${hiddenWarnings.level === 'expired' ? '지남' : '3일'} ${hiddenWarnings.count}`,
                token(`${hiddenWarnings.level}-soft`),
                token(hiddenWarnings.level),
              )}
              transparent
            />
          </sprite>
        )}
        {notes.map((n, i) => (
          <mesh
            key={n.id}
            // 문 가운데에 지그재그로 (손잡이와 겹치지 않게 가운데 쪽)
            position={[(i % 2 ? 1 : -1) * Math.min(0.05, dw * 0.1), dh * 0.2 - drop - i * NOTE_STEP, PANEL + 0.002 + i * 0.0004]}
            rotation={[0, 0, NOTE_TILT[i % NOTE_TILT.length]]}
            onClick={(e) => {
              if (!isTap(e)) return
              e.stopPropagation()
              onOpenNotes?.()
            }}
          >
            <planeGeometry args={[NOTE_SIZE, NOTE_SIZE]} />
            <meshBasicMaterial map={noteTexture(n)} toneMapped={false} />
          </mesh>
        ))}
        {photos.map((p, i) => (
          <DoorPhoto
            key={p.id}
            photo={p}
            // 문 위쪽 가운데, 두 번째 장은 아래로 살짝 겹쳐서
            position={[(i % 2 ? -1 : 1) * Math.min(0.04, dw * 0.08), dh * 0.16 - drop * 1.6 - i * 0.24, PANEL + 0.003 + i * 0.0004]}
            tilt={PHOTO_TILT[i % PHOTO_TILT.length]}
            onOpen={onOpenNotes}
          />
        ))}
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
              {selected && <Edges color={token('accent')} />}
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
        <meshBasicMaterial color={token('accent')} transparent opacity={selected ? 0.15 : 0} depthWrite={false} />
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
  const mat = shape.wood ? (
    <meshStandardMaterial color={shape.body} roughness={0.75} />
  ) : (
    <meshStandardMaterial color={shape.body} metalness={0.3} roughness={0.5} />
  )
  // 팬트리 안쪽은 그늘져도 밝게 보이도록 같은 색으로 살짝 빛나게 해서 식품이 앞으로 떠 보이게
  const inner = shape.wood ? (
    <meshStandardMaterial color={shape.wood.inner} emissive={shape.wood.inner} emissiveIntensity={0.35} roughness={0.9} />
  ) : (
    <meshStandardMaterial color="#f8fafc" roughness={0.8} />
  )
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
      {/* 안쪽 흰 내벽: 바깥 몸체 색과 상관없이 안은 밝게 */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (W / 2 - WALL - 0.0005), H / 2, zc]} rotation={[0, (-side * Math.PI) / 2, 0]}>
          <planeGeometry args={[bodyD, H - WALL * 2]} />
          {inner}
        </mesh>
      ))}
      {[WALL + 0.0005, H - WALL - 0.0005].map((y, i) => (
        <mesh key={y} position={[0, y, zc]} rotation={[i === 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W - WALL * 2, bodyD]} />
          {inner}
        </mesh>
      ))}
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

// ---------- 이스터에그 ----------

/** 반숙 달걀(써니사이드업) 그림. ui.tsx 의 SunnyEgg 와 같은 모양 */
function eggTexture() {
  return cachedTexture('egg', (g) => {
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.ellipse(64, 66, 56, 48, -0.2, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = token('line')
    g.lineWidth = 3
    g.stroke()
    g.fillStyle = '#f6c343'
    g.beginPath()
    g.arc(62, 64, 22, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,.7)'
    g.beginPath()
    g.arc(55, 57, 6, 0, Math.PI * 2)
    g.fill()
  })
}

/** 안쪽 천장 조명: 2초 안에 다섯 번 누르면 onEgg */
function CeilingLight({ shape, onEgg }: { shape: FridgeShape; onEgg: () => void }) {
  const taps = useRef<number[]>([])
  const W = shape.width / 1000
  const H = shape.height / 1000
  const D = shape.depth / 1000
  return (
    <mesh
      position={[0, H - WALL - 0.004, -PANEL / 2 - 0.05]}
      rotation={[Math.PI / 2, 0, 0]}
      onClick={(e) => {
        if (!isTap(e)) return
        e.stopPropagation()
        const now = performance.now()
        taps.current = [...taps.current.filter((t) => now - t < 2000), now]
        if (taps.current.length >= 5) {
          taps.current = []
          onEgg()
        }
      }}
    >
      <planeGeometry args={[W * 0.4, D * 0.3]} />
      {/* 팬트리엔 조명이 없으니 안 보이게만 두고 누르는 자리는 그대로 */}
      <meshBasicMaterial color="#ffffff" transparent={!!shape.wood} opacity={shape.wood ? 0 : 1} />
    </mesh>
  )
}

// ---------- 카메라 ----------

/** 칸을 고르면 카메라가 다가갈 상자(월드 좌표, m) */
interface Focus {
  x: number
  y: number
  w: number
  h: number
}

function CameraRig({
  shape,
  preset,
  nonce,
  closed,
  focus,
}: {
  shape: FridgeShape
  preset: CameraPreset
  nonce: number
  closed: boolean
  focus: Focus | null
}) {
  // 매 렌더마다 새 객체가 와도 같은 칸이면 다시 움직이지 않게 숫자로 비교한다
  const fx0 = focus?.x
  const fy0 = focus?.y
  const fw0 = focus?.w
  const fh0 = focus?.h
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, invalidate, size } = useThree()
  const H = shape.height / 1000
  const W = shape.width / 1000
  const goal = useRef<THREE.Vector3 | null>(null)
  const goalTarget = useRef<THREE.Vector3 | null>(null)
  // 문이 한쪽으로만 열리면(쿠쿠) 열린 문까지 화면 가운데 오도록 그쪽으로 조금 옮긴다
  const hinges = new Set(shape.doors.map((d) => d.hinge))
  const shiftX = hinges.size === 1 ? (hinges.has('right') ? 0.4 : -0.4) * W : 0
  // 문이 모두 닫힌 정면은 메모가 주인공: 냉장고가 화면 폭의 85%를 차지하게 당기고, 메모가 붙은 위쪽을 가운데로
  // (세로 화면은 위아래가 조금 잘려도 폭을 채우고, 가로 화면은 냉장고 전체 높이를 맞춘다)
  const closeUp = closed && preset === 'front'
  const portrait = size.width < size.height
  const center = useMemo(
    () => new THREE.Vector3(closeUp ? 0 : shiftX, closeUp && portrait ? H * 0.62 : H / 2, 0),
    [H, shiftX, closeUp, portrait],
  )

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const fov = (cam.fov * Math.PI) / 180
    if (fx0 !== undefined && fy0 !== undefined && fw0 !== undefined && fh0 !== undefined) {
      // 고른 칸이 화면 폭을 거의 채우도록(높이는 60%까지), 살짝 위에서 내려다보는 정면으로
      const fx = fw0 / 0.92 / 2 / Math.tan(fov / 2) / aspect
      const fy = fh0 / 0.6 / 2 / Math.tan(fov / 2)
      const target = new THREE.Vector3(fx0, fy0, 0)
      goal.current = new THREE.Vector3(0, 0.25, 1).normalize().multiplyScalar(Math.max(fx, fy) + shape.depth / 2000).add(target)
      goalTarget.current = target
      invalidate()
      return
    }
    // 문을 연 상태(폭 ≈ 2.6배)까지 화면에 들어오게
    const open = shape.doors.length === 0
    const fitH = (H * (open ? 1.02 : 1.0)) / 2 / Math.tan(fov / 2)
    // 비스듬히 볼 땐 열린 문이 화면 옆으로 더 나오니 여유를 둔다
    // 문 없는 선반장은 문 몫의 여유가 필요 없어 카드 폭 80~85%까지 당긴다
    // 문 연 냉장고 정면은 열린 문 끝이 살짝 걸칠 만큼만 여유를 둬서 식품이 크게 보이게
    const spanW = open ? (preset === 'left' || preset === 'right' ? 1.5 : 1.2) : preset === 'left' || preset === 'right' ? 2.9 : 1.3
    const fitW = (W * spanW) / 2 / Math.tan(fov / 2) / aspect
    const fitClosed = W / 0.85 / 2 / Math.tan(fov / 2) / aspect
    const dist = closeUp
      ? (portrait ? fitClosed : Math.max(fitClosed, fitH)) + shape.depth / 2000
      : Math.max(fitH, fitW) + shape.depth / 1000
    const dir =
      preset === 'front'
        ? new THREE.Vector3(0, 0.12, 1)
        : preset === 'left'
          ? new THREE.Vector3(-0.8, 0.2, 0.75)
          : preset === 'right'
            ? new THREE.Vector3(0.8, 0.2, 0.75)
            : new THREE.Vector3(0, 1.4, 0.7)
    goal.current = dir.normalize().multiplyScalar(dist).add(center)
    goalTarget.current = center.clone()
    invalidate()
  }, [preset, nonce, shape, camera, size, H, W, center, closeUp, portrait, fx0, fy0, fw0, fh0, invalidate])

  useFrame((state, dt) => {
    if (!goal.current) return
    const k = Math.min(1, dt * 6)
    camera.position.lerp(goal.current, k)
    // 바라보는 곳도 같이 옮겨야 칸으로 다가갈 때 화면이 튀지 않는다
    if (goalTarget.current) controls.current?.target.lerp(goalTarget.current, k)
    controls.current?.update()
    if (camera.position.distanceTo(goal.current) < 0.002) {
      if (goalTarget.current) controls.current?.target.copy(goalTarget.current)
      goal.current = null
      goalTarget.current = null
    } else state.invalidate()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      minDistance={0.25}
      maxDistance={8}
      maxPolarAngle={Math.PI * 0.58}
      target={center}
    />
  )
}

// ---------- 장면 ----------

export default function Fridge3D(props: Props) {
  const { shape, compartments, itemsByCompartment, selectedId, doorOpen, camera, cameraNonce, onSelect, onToggleDoor, onOpenItem, onEgg, egg, notes = [], onOpenNotes, photos = [], celebration } =
    props
  const H = shape.height / 1000

  const placed = compartments.filter((c) => c.layout)
  // 몸체 칸을 고르면 그 칸으로 다가간다. 문 포켓은 문과 함께 움직여서 제외
  const picked = placed.find((c) => c.id === selectedId && !isDoorCompartment(c))
  const focus: Focus | null = (() => {
    if (!picked?.layout) return null
    const W = shape.width / 1000
    const iw = W - WALL * 2
    const ih = H - WALL * 2
    const l = picked.layout
    return { x: -W / 2 + WALL + (l.x + l.w / 2) * iw, y: H - WALL - (l.y + l.h / 2) * ih, w: l.w * iw, h: l.h * ih }
  })()
  const cabinet = placed.filter((c) => !isDoorCompartment(c))
  const pocketsByDoor = new Map<string, Compartment[]>()
  for (const c of placed.filter(isDoorCompartment)) {
    const d = doorOf(shape, c)
    if (d) pocketsByDoor.set(d.id, [...(pocketsByDoor.get(d.id) ?? []), c])
  }

  const warningsBehind = (door: DoorSpec) => {
    const n = { expired: 0, urgent: 0 }
    for (const c of placed) {
      if (!behindDoor(shape, door, c)) continue
      for (const i of itemsByCompartment.get(c.id) ?? []) {
        const lv = expiryLevel(i.expiry_date)
        if (lv === 'expired' || lv === 'urgent') n[lv]++
      }
    }
    if (n.expired) return { level: 'expired' as const, count: n.expired }
    if (n.urgent) return { level: 'urgent' as const, count: n.urgent }
    return null
  }

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 35, near: 0.05, far: 50, position: [0, 1, 4] }}
      onPointerMissed={(e) => e.type === 'click' && onSelect(null)}
    >
      <color attach="background" args={[token('bg')]} />
      {/* 팬트리는 냉장고보다 살짝 따뜻한 빛 */}
      <hemisphereLight args={shape.wood ? ['#fff6ea', '#d9cbb6', 1.4] : ['#ffffff', '#cbd5e1', 1.4]} />
      <directionalLight position={[2, 4, 5]} intensity={1.6} />
      <directionalLight position={[-3, 2, 2]} intensity={0.5} />
      {!shape.wood && <pointLight position={[0, (shape.height / 1000) * 0.9, 0]} intensity={0.6} distance={2} />}
      {/* 문 없는 팬트리는 '닫힘' 클로즈업 대상이 아니다 */}
      <CameraRig
        shape={shape}
        preset={camera}
        nonce={cameraNonce}
        closed={shape.doors.length > 0 && !shape.doors.some((d) => doorOpen[d.id])}
        focus={focus}
      />

      <Cabinet shape={shape} />
      {celebration && !shape.doors.some((d) => doorOpen[d.id]) && <CelebrationBanner shape={shape} celebration={celebration} />}
      <CeilingLight shape={shape} onEgg={onEgg} />
      {egg && (
        <sprite position={[0, H * 0.9, 0.05]} scale={[0.14, 0.14, 1]}>
          <spriteMaterial map={eggTexture()} transparent />
        </sprite>
      )}
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
          open={doorOpen[d.id] ?? false}
          pockets={pocketsByDoor.get(d.id) ?? []}
          itemsByCompartment={itemsByCompartment}
          hiddenWarnings={warningsBehind(d)}
          selectedId={selectedId}
          onToggle={() => onToggleDoor(d.id)}
          onSelect={onSelect}
          onOpen={onOpenItem}
          notes={d === shape.doors[0] ? notes : undefined}
          photos={d === (shape.doors[1] ?? shape.doors[0]) ? photos : undefined}
          drop={celebration ? 0.035 : 0}
          onOpenNotes={onOpenNotes}
        />
      ))}
      {/* 바닥: 배경과 같은 색, 냉장고 밑에만 옅은 그림자 */}
      <ContactShadows position={[0, 0, 0]} scale={4} blur={2.4} far={1.2} opacity={0.28} frames={1} />
    </Canvas>
  )
}
