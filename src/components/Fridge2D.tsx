import { categoryOf } from '../lib/categories'
import { expiryLevel, type ExpiryLevel } from '../lib/expiry'
import {
  behindDoor,
  doorOf,
  isDoorCompartment,
  pocketRectInDoor,
  sortByUrgency,
  tintHex,
  type DoorSpec,
  type FridgeShape,
} from '../lib/fridgeShape'
import { magnetOf, notePaper } from '../lib/notes'
import type { Compartment, Item, Layout, Note } from '../lib/types'
import { cx } from '../lib/cx'

export type View2D = 'closed' | 'open' | 'side'

interface Props {
  view: View2D
  shape: FridgeShape
  compartments: Compartment[]
  itemsByCompartment: Map<string, Item[]>
  selectedId: string | null
  onSelect: (compartmentId: string | null) => void
  onOpenItem: (item: Item) => void
  onOpenDoors: () => void
  /** 첫 번째 문 앞면에 붙일 메모 */
  notes?: Note[]
  onOpenNotes?: () => void
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 그림 좌표는 mm. 폰 너비(약 360px)에서 문 펼친 정면이 1500mm 안팎이라 1px ≈ 4mm.
 * 칸 이름이 폰에서 11px 이상 나오도록 46 으로 잡는다.
 */
const LABEL = 46
const ZONE_LABEL_H = 60
const OUTLINE = 'stroke-ink/70'

const RING_STROKE: Partial<Record<ExpiryLevel, string>> = {
  expired: 'stroke-expired',
  urgent: 'stroke-urgent',
  soon: 'stroke-soon',
}

const BADGE: Record<'expired' | 'urgent' | 'soon', { bg: string; text: string; label: string }> = {
  expired: { bg: 'fill-expired-soft', text: 'fill-expired', label: '지남' },
  urgent: { bg: 'fill-urgent-soft', text: 'fill-urgent', label: '3일' },
  soon: { bg: 'fill-soon-soft', text: 'fill-soon', label: '7일' },
}

const rectProps = (b: Box) => ({ x: b.x, y: b.y, width: b.w, height: b.h })

function scale(l: Layout, outer: Box): Box {
  return { x: outer.x + l.x * outer.w, y: outer.y + l.y * outer.h, w: l.w * outer.w, h: l.h * outer.h }
}

/** SVG 글자는 넘쳐도 잘리지 않으니 칸 폭에 맞게 미리 줄인다. 한글은 글자 크기만큼, 영숫자·기호는 그 절반쯤 차지 */
function fitText(text: string, width: number, fontSize: number): string {
  const w = (ch: string) => (/[\u3131-\uD79D]/.test(ch) ? fontSize : fontSize * 0.55)
  let used = 0
  for (let i = 0; i < text.length; i++) {
    used += w(text[i])
    if (used > width) {
      let out = text.slice(0, i)
      used = [...out].reduce((n, ch) => n + w(ch), 0) + fontSize
      while (out && used > width) {
        used -= w(out[out.length - 1])
        out = out.slice(0, -1)
      }
      return `${out.trimEnd()}…`
    }
  }
  return text
}

/** 칸 사각형 안에 식품 동그라미(분류 tint + 기한 단계 테두리)를 채운다. 넘치면 마지막 자리에 +N */
function Chips({ box, items, onOpen, label }: { box: Box; items: Item[]; onOpen: (i: Item) => void; label?: string }) {
  const labelH = label ? Math.min(LABEL * 1.3, box.h * 0.4) : 0
  const pad = 10
  const area = { x: box.x + pad, y: box.y + labelH + pad / 2, w: box.w - pad * 2, h: box.h - labelH - pad }
  const d = Math.max(34, Math.min(104, area.h * 0.92, area.w / 2.2))
  const pitch = d * 1.1
  const cols = Math.max(1, Math.floor(area.w / pitch))
  const rows = Math.max(1, Math.floor(area.h / pitch))
  const cap = cols * rows
  const sorted = sortByUrgency(items)
  const shown = sorted.length > cap ? sorted.slice(0, cap - 1) : sorted
  const pos = (i: number) => ({
    cx: area.x + (i % cols) * pitch + d / 2,
    cy: area.y + Math.floor(i / cols) * pitch + d / 2,
  })
  return (
    <g>
      {label && (
        <text
          x={box.x + pad}
          y={box.y + labelH * 0.8}
          fontSize={Math.min(LABEL, labelH * 0.8)}
          className="pointer-events-none fill-muted font-semibold select-none"
        >
          {fitText(label, box.w - pad * 2, Math.min(LABEL, labelH * 0.8))}
        </text>
      )}
      {shown.map((it, i) => {
        const { cx: x, cy: y } = pos(i)
        const lv = expiryLevel(it.expiry_date)
        const cat = categoryOf(it.category)
        const ring = RING_STROKE[lv]
        return (
          <g
            key={it.id}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(it)
            }}
          >
            <title>{`${it.name} ${it.quantity}${it.unit}${it.expiry_date ? ` · ${it.expiry_date}` : ''}`}</title>
            <circle cx={x} cy={y} r={d / 2 - 5} fill={tintHex(cat.tint)} className={ring ?? 'stroke-line'} strokeWidth={ring ? 9 : 3} />
            <text x={x} y={y + d * 0.04} fontSize={d * 0.5} textAnchor="middle" dominantBaseline="middle" className="select-none">
              {cat.emoji}
            </text>
          </g>
        )
      })}
      {sorted.length > cap &&
        (() => {
          const { cx: x, cy: y } = pos(cap - 1)
          return (
            <g className="pointer-events-none">
              <circle cx={x} cy={y} r={d / 2 - 5} className="fill-sunken" />
              <text x={x} y={y + 2} fontSize={d * 0.36} textAnchor="middle" dominantBaseline="middle" className="fill-muted font-bold">
                +{sorted.length - shown.length}
              </text>
            </g>
          )
        })()}
    </g>
  )
}

function Region({
  box,
  c,
  items,
  selected,
  onSelect,
  onOpen,
  // 아래 칸은 위치로 어느 칸인지 보이니 '냉동실 '·'맞춤보관실 ' 같은 앞말을 빼고 서랍 번호가 보이게
  label = c.section === 'lower' ? c.name.replace(/^\S+ /, '') : c.name,
}: {
  box: Box
  c: Compartment
  items: Item[]
  selected: boolean
  onSelect: (id: string) => void
  onOpen: (i: Item) => void
  label?: string
}) {
  return (
    <g onClick={() => onSelect(c.id)} className="cursor-pointer">
      <rect
        {...rectProps(box)}
        rx={12}
        className={selected ? 'fill-accent-soft stroke-accent' : 'fill-surface stroke-line'}
        strokeWidth={selected ? 8 : 3}
      />
      <Chips box={box} items={items} onOpen={onOpen} label={label} />
    </g>
  )
}

/** 문 닫힌 정면: 문마다 그 안의 식품 수와 기한 단계별 작은 배지 */
function ClosedView({ shape, placed, itemsOf, onOpenDoors, notes, onOpenNotes }: {
  shape: FridgeShape
  placed: Compartment[]
  itemsOf: (c: Compartment) => Item[]
  onOpenDoors: () => void
  notes: Note[]
  onOpenNotes?: () => void
}) {
  const W = shape.width
  const H = shape.height
  return (
    <svg viewBox={`-20 -20 ${W + 40} ${H + 40}`} className="mx-auto block max-h-[64dvh] w-full" role="img" aria-label="문 닫힌 정면">
      <rect x={0} y={0} width={W} height={H} rx={16} className={cx('fill-sunken', OUTLINE)} strokeWidth={4} />
      {shape.doors.map((d) => {
        const b = scale(d.rect, { x: 0, y: 0, w: W, h: H })
        const items = placed.filter((c) => behindDoor(shape, d, c)).flatMap(itemsOf)
        const count = (lv: ExpiryLevel) => items.filter((i) => expiryLevel(i.expiry_date) === lv).length
        const badges = (['expired', 'urgent', 'soon'] as const).filter((lv) => count(lv) > 0)
        const atBottom = d.rect.y + d.rect.h < 0.999
        const free = d.hinge === 'left' ? b.x + b.w - 6 : b.x + 6
        // 표시창이 있으면 글자를 그 아래로
        const top = shape.display ? Math.max(b.y, (shape.display.y + shape.display.h) * H + 10) : b.y
        const cxDoor = b.x + b.w / 2
        return (
          <g key={d.id} className="cursor-pointer" onClick={onOpenDoors}>
            <rect x={b.x + 5} y={b.y + 5} width={b.w - 10} height={b.h - 10} rx={10} className={cx('fill-surface', OUTLINE)} strokeWidth={3} />
            {shape.handle === 'groove-h' ? (
              <rect x={b.x + 5} y={atBottom ? b.y + b.h - 27 : b.y + 5} width={b.w - 10} height={22} className="fill-ink/70" />
            ) : (
              <rect x={d.hinge === 'left' ? free - 12 : free} y={b.y + b.h * 0.25} width={12} height={Math.min(b.h * 0.3, 350)} className="fill-ink/70" />
            )}
            <text x={cxDoor} y={top + 90} fontSize={50} textAnchor="middle" className="fill-ink font-bold">
              {d.label}
            </text>
            <text x={cxDoor} y={top + 150} fontSize={44} textAnchor="middle" className="tabular fill-muted">
              {items.length}개
            </text>
            {badges.map((lv, i) => {
              // 좁은 문에서도 겹치지 않게 세로로 쌓는다
              const bw = 170
              return (
                <g key={lv} transform={`translate(${cxDoor - bw / 2}, ${top + 185 + i * 78})`}>
                  <rect width={bw} height={64} rx={20} className={BADGE[lv].bg} />
                  <text x={bw / 2} y={34} fontSize={38} textAnchor="middle" dominantBaseline="middle" className={cx('tabular font-bold', BADGE[lv].text)}>
                    {BADGE[lv].label} {count(lv)}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
      {shape.display && (
        <rect {...rectProps(scale(shape.display, { x: 0, y: 0, w: W, h: H }))} rx={8} className="fill-ink" />
      )}
      {notes.length > 0 && (
        <DoorNotes door={scale(shape.doors[0].rect, { x: 0, y: 0, w: W, h: H })} notes={notes} onOpen={onOpenNotes} />
      )}
    </svg>
  )
}

const NOTE = 200
const NOTE_TILT = [-2, 1.5, -1]
/** 손으로 붙인 느낌이 나게 좌우로 살짝 엇갈리게 (mm, 폰에서 약 5px) */
const NOTE_SHIFT = [-14, 12, -6]

/** 문 닫힌 정면: 첫 번째 문 아래쪽에 포스트잇 메모. 누르면 메모 탭 */
function DoorNotes({ door, notes, onOpen }: { door: Box; notes: Note[]; onOpen?: () => void }) {
  const cols = Math.max(1, Math.min(notes.length, Math.floor((door.w - 30) / (NOTE + 20))))
  const rowW = cols * NOTE + (cols - 1) * 20
  const rows = Math.ceil(notes.length / cols)
  return (
    <g
      role="button"
      aria-label={`메모 ${notes.length}개 보기`}
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.()
      }}
    >
      {notes.map((n, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = door.x + (door.w - rowW) / 2 + col * (NOTE + 20) + NOTE_SHIFT[i % NOTE_SHIFT.length]
        // 문 아래쪽(손잡이 홈 위)에 모아 붙이고, 최근 메모가 맨 위
        const y = door.y + door.h - 70 - rows * NOTE - (rows - 1) * 24 + row * (NOTE + 24)
        const magnet = magnetOf(n.body)
        return (
          <g key={n.id} transform={`rotate(${NOTE_TILT[i % NOTE_TILT.length]} ${x + NOTE / 2} ${y + NOTE / 2})`}>
            <foreignObject x={x} y={y} width={NOTE} height={NOTE}>
              <div
                className={cx(
                  'h-full w-full overflow-hidden rounded-[6px] px-4 pt-7 pb-3 text-[34px] leading-[1.25] font-bold break-keep text-ink shadow-card',
                  notePaper(n.color),
                )}
              >
                <p className="line-clamp-3">{n.body}</p>
              </div>
            </foreignObject>
            {magnet === 'heart' ? (
              <text x={x + NOTE / 2} y={y + 26} fontSize={34} textAnchor="middle" className="fill-accent">
                ♥
              </text>
            ) : magnet === 'egg' ? (
              <g>
                <ellipse cx={x + NOTE / 2} cy={y + 14} rx={17} ry={14} className="fill-surface stroke-line" strokeWidth={3} />
                <circle cx={x + NOTE / 2} cy={y + 14} r={7} fill="#f6c343" />
              </g>
            ) : (
              <circle cx={x + NOTE / 2} cy={y + 14} r={11} className="fill-accent" />
            )}
          </g>
        )
      })}
    </g>
  )
}

export function Fridge2D({ view, shape, compartments, itemsByCompartment, selectedId, onSelect, onOpenItem, onOpenDoors, notes = [], onOpenNotes }: Props) {
  const W = shape.width
  const H = shape.height
  const placed = compartments.filter((c) => c.layout)
  const cabinet = placed.filter((c) => !isDoorCompartment(c))
  const pockets = placed.filter(isDoorCompartment)
  const itemsOf = (c: Compartment) => itemsByCompartment.get(c.id) ?? []
  const svgClass = 'mx-auto block max-h-[64dvh] w-full touch-manipulation'
  const wall = 26

  if (view === 'closed')
    return <ClosedView shape={shape} placed={placed} itemsOf={itemsOf} onOpenDoors={onOpenDoors} notes={notes} onOpenNotes={onOpenNotes} />

  const dividers = (inner: Box, onlyH = false) =>
    shape.dividers
      .filter((dv) => !onlyH || dv.dir === 'h')
      .map((dv, i) =>
        dv.dir === 'h' ? (
          <rect key={i} x={inner.x + dv.from * inner.w} y={inner.y + dv.at * inner.h - 10} width={(dv.to - dv.from) * inner.w} height={20} className="fill-sunken" />
        ) : (
          <rect key={i} x={inner.x + dv.at * inner.w - 10} y={inner.y + dv.from * inner.h} width={20} height={(dv.to - dv.from) * inner.h} className="fill-sunken" />
        ),
      )

  if (view === 'open') {
    // 가운데 몸체, 열린 문은 경첩 쪽 바깥으로 펼쳐서 안쪽 포켓이 보이게
    const flap = 0.62
    const maxW = (ds: DoorSpec[]) => Math.max(0, ...ds.map((d) => d.rect.w * W * flap))
    const lw = maxW(shape.doors.filter((d) => d.hinge === 'left'))
    const rw = maxW(shape.doors.filter((d) => d.hinge === 'right'))
    const gap = 24
    const bodyX = lw ? lw + gap : 0
    const total = bodyX + W + (rw ? gap + rw : 0)
    const inner = { x: bodyX + wall, y: wall, w: W - wall * 2, h: H - wall * 2 }
    // 문을 펼치면 바깥 문 이름이 안 보이니, 아래 칸 묶음(냉동실·맞춤보관실) 맨 위에 구역 이름 한 줄을 둔다
    const lowerBy = new Map<string, Compartment[]>()
    for (const c of cabinet.filter((c) => c.section === 'lower')) {
      const k = c.name.split(' ')[0]
      lowerBy.set(k, [...(lowerBy.get(k) ?? []), c])
    }
    const zones = [...lowerBy].map(
      ([name, cs]) => {
        const bs = cs.map((c) => scale(c.layout!, inner))
        const x = Math.min(...bs.map((b) => b.x))
        const y = Math.min(...bs.map((b) => b.y))
        const bottom = Math.max(...bs.map((b) => b.y + b.h))
        return { name, ids: new Set(cs.map((c) => c.id)), x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, bottom }
      },
    )
    const boxOf = (c: Compartment): Box => {
      const b = scale(c.layout!, inner)
      const z = zones.find((z) => z.ids.has(c.id))
      if (!z) return b
      // 구역 이름 자리만큼 묶음 전체를 아래로 눌러 담는다
      const k = (z.bottom - z.y - ZONE_LABEL_H) / (z.bottom - z.y)
      return { ...b, y: z.y + ZONE_LABEL_H + (b.y - z.y) * k, h: b.h * k }
    }
    return (
      <svg viewBox={`-10 -10 ${total + 20} ${H + 20}`} className={svgClass} role="img" aria-label="문 열린 정면">
        <g onClick={() => onSelect(null)}>
          <rect x={bodyX} y={0} width={W} height={H} rx={16} className={cx('fill-sunken', OUTLINE)} strokeWidth={4} />
          <rect {...rectProps(inner)} rx={8} className="fill-bg" />
        </g>
        {dividers(inner)}
        {zones.map((z) => (
          <text key={z.name} x={z.x + 6} y={z.y + ZONE_LABEL_H * 0.72} fontSize={LABEL} className="pointer-events-none fill-muted font-semibold select-none">
            {fitText(z.name, z.w - 12, LABEL)}
          </text>
        ))}
        {cabinet.map((c) => (
          <Region
            key={c.id}
            box={boxOf(c)}
            c={c}
            items={itemsOf(c)}
            selected={selectedId === c.id}
            onSelect={onSelect}
            onOpen={onOpenItem}
          />
        ))}
        {shape.doors.map((d) => {
          const dw = d.rect.w * W * flap
          const dx = d.hinge === 'left' ? bodyX - gap - dw : bodyX + W + gap
          const door: Box = { x: dx, y: d.rect.y * H + 4, w: dw, h: d.rect.h * H - 8 }
          const mine = pockets.filter((c) => doorOf(shape, c)?.id === d.id)
          return (
            <g key={d.id}>
              <rect {...rectProps(door)} rx={12} className={cx('fill-sunken', OUTLINE)} strokeWidth={4} />
              {mine.map((c) => (
                <Region
                  key={c.id}
                  box={scale(pocketRectInDoor(d, c), door)}
                  c={c}
                  items={itemsOf(c)}
                  selected={selectedId === c.id}
                  onSelect={onSelect}
                  onOpen={onOpenItem}
                  label={c.name.replace(/^.*문 /, '')}
                />
              ))}
            </g>
          )
        })}
      </svg>
    )
  }

  // 측면 단면: 왼쪽이 뒤, 오른쪽이 앞(문)
  const D = shape.depth
  const doorD = shape.doors.length ? 240 : 0
  const bodyD = D - doorD
  const inner = { x: wall, y: wall, w: bodyD - wall, h: H - wall * 2 }
  const bands = new Map<string, Compartment[]>()
  for (const c of cabinet) {
    const k = `${c.layout!.y}:${c.layout!.h}`
    bands.set(k, [...(bands.get(k) ?? []), c])
  }
  return (
    <svg viewBox={`-10 -10 ${D + 20} ${H + 20}`} className={svgClass} role="img" aria-label="옆에서 본 단면, 왼쪽이 뒤 오른쪽이 문">
      <g onClick={() => onSelect(null)}>
        <rect x={0} y={0} width={bodyD} height={H} rx={14} className={cx('fill-sunken', OUTLINE)} strokeWidth={4} />
        <rect {...rectProps(inner)} className="fill-bg" />
      </g>
      {dividers(inner, true)}
      {[...bands.values()].map((group) =>
        group.map((c, i) => {
          const l = c.layout!
          // 같은 높이에 칸이 여러 개면(아래 좌우 칸) 깊이 방향으로 나눠 보여준다
          const w = inner.w / group.length
          return (
            <Region
              key={c.id}
              box={{ x: inner.x + i * w, y: inner.y + l.y * inner.h, w, h: l.h * inner.h }}
              c={c}
              items={itemsOf(c)}
              selected={selectedId === c.id}
              onSelect={onSelect}
              onOpen={onOpenItem}
            />
          )
        }),
      )}
      {/* 양문형은 좌우 문이 겹쳐 보이므로 같은 높이의 문·포켓을 하나로 묶는다 */}
      {[...new Map(shape.doors.map((d) => [`${d.rect.y}:${d.rect.h}`, d])).values()].map((d) => {
        const door: Box = { x: bodyD + 6, y: d.rect.y * H + 4, w: doorD - 6, h: d.rect.h * H - 8 }
        const rows = new Map<number, Compartment[]>()
        for (const c of pockets) {
          const own = doorOf(shape, c)
          if (!own || own.rect.y !== d.rect.y || own.rect.h !== d.rect.h) continue
          const y = pocketRectInDoor(own, c).y
          rows.set(y, [...(rows.get(y) ?? []), c])
        }
        return (
          <g key={d.id}>
            <rect {...rectProps(door)} rx={10} className={cx('fill-sunken', OUTLINE)} strokeWidth={4} />
            {[...rows.values()].map((cs) => (
              <Region
                key={cs[0].id}
                box={scale(pocketRectInDoor(doorOf(shape, cs[0])!, cs[0]), door)}
                c={cs[0]}
                items={cs.flatMap(itemsOf)}
                selected={cs.some((c) => c.id === selectedId)}
                onSelect={onSelect}
                onOpen={onOpenItem}
                label=""
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}
