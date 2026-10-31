import { categoryOf } from '../lib/categories'
import { expiryLevel } from '../lib/expiry'
import {
  behindDoor,
  doorOf,
  isDoorCompartment,
  LEVEL_COLOR,
  pocketRectInDoor,
  sortByUrgency,
  type DoorSpec,
  type FridgeShape,
} from '../lib/fridgeShape'
import type { Compartment, Item, Layout } from '../lib/types'

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
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const RING: Record<string, string> = { ...LEVEL_COLOR, ok: '#94a3b8', none: '#cbd5e1' }
const STROKE = '#64748b'

/** 칸 사각형 안에 식품 동그라미를 채운다. 넘치면 마지막 자리에 +N */
function Chips({ box, items, onOpen, label }: { box: Box; items: Item[]; onOpen: (i: Item) => void; label?: string }) {
  const labelH = label ? Math.min(46, box.h * 0.26) : 0
  const pad = 8
  const area = { x: box.x + pad, y: box.y + labelH + pad / 2, w: box.w - pad * 2, h: box.h - labelH - pad }
  const d = Math.max(30, Math.min(100, area.h * 0.92, area.w / 2.2))
  const pitch = d * 1.08
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
        <text x={box.x + pad} y={box.y + labelH * 0.8} fontSize={labelH * 0.72} fill="#475569" className="pointer-events-none select-none">
          {label}
        </text>
      )}
      {shown.map((it, i) => {
        const { cx, cy } = pos(i)
        const lv = expiryLevel(it.expiry_date)
        const warn = lv === 'expired' || lv === 'urgent' || lv === 'soon'
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
            <circle cx={cx} cy={cy} r={d / 2 - 2} fill={warn ? RING[lv] : '#fff'} stroke={RING[lv]} strokeWidth={warn ? 0 : 3} />
            <text x={cx} y={cy + d * 0.04} fontSize={d * 0.56} textAnchor="middle" dominantBaseline="middle" className="select-none">
              {categoryOf(it.category).emoji}
            </text>
          </g>
        )
      })}
      {sorted.length > cap &&
        (() => {
          const { cx, cy } = pos(cap - 1)
          return (
            <g className="pointer-events-none">
              <circle cx={cx} cy={cy} r={d / 2 - 2} fill="#334155" />
              <text x={cx} y={cy + 2} fontSize={d * 0.38} fill="#fff" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
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
  fill = '#ffffff',
  label = c.name,
}: {
  box: Box
  c: Compartment
  items: Item[]
  selected: boolean
  onSelect: (id: string) => void
  onOpen: (i: Item) => void
  fill?: string
  label?: string
}) {
  return (
    <g onClick={() => onSelect(c.id)} className="cursor-pointer">
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={10}
        fill={selected ? '#e0f2fe' : fill}
        stroke={selected ? '#0284c7' : '#cbd5e1'}
        strokeWidth={selected ? 6 : 2}
      />
      <Chips box={box} items={items} onOpen={onOpen} label={label} />
    </g>
  )
}

const ZONE_FILL = { fridge: '#ffffff', freezer: '#eff6ff', flex: '#f5f3ff' } as const

const rectProps = (b: Box) => ({ x: b.x, y: b.y, width: b.w, height: b.h })

function scale(l: Layout, outer: Box): Box {
  return { x: outer.x + l.x * outer.w, y: outer.y + l.y * outer.h, w: l.w * outer.w, h: l.h * outer.h }
}

export function Fridge2D({ view, shape, compartments, itemsByCompartment, selectedId, onSelect, onOpenItem, onOpenDoors }: Props) {
  const W = shape.width
  const H = shape.height
  const placed = compartments.filter((c) => c.layout)
  const cabinet = placed.filter((c) => !isDoorCompartment(c))
  const pockets = placed.filter(isDoorCompartment)
  const itemsOf = (c: Compartment) => itemsByCompartment.get(c.id) ?? []
  const svgClass = 'mx-auto block max-h-[68dvh] w-full touch-manipulation'

  if (view === 'closed') {
    const behind = (d: DoorSpec) => placed.filter((c) => behindDoor(shape, d, c)).flatMap(itemsOf)
    return (
      <svg viewBox={`-20 -20 ${W + 40} ${H + 60}`} className={svgClass} role="img" aria-label="문 닫힌 정면">
        <rect x={0} y={0} width={W} height={H} rx={18} fill={shape.body} />
        {shape.doors.map((d) => {
          const b = scale(d.rect, { x: 0, y: 0, w: W, h: H })
          const items = behind(d)
          const count = (lv: string) => items.filter((i) => expiryLevel(i.expiry_date) === lv).length
          const free = d.hinge === 'left' ? b.x + b.w - 4 : b.x + 4
          const atBottom = d.rect.y + d.rect.h < 0.999
          // 표시창이 있으면 글자를 그 아래로
          const top = shape.display ? Math.max(b.y, (shape.display.y + shape.display.h) * H + 10) : b.y
          const badges = (['expired', 'urgent', 'soon'] as const).filter((lv) => count(lv) > 0)
          return (
            <g key={d.id} className="cursor-pointer" onClick={onOpenDoors}>
              <rect x={b.x + 4} y={b.y + 4} width={b.w - 8} height={b.h - 8} rx={10} fill={shape.door.color} stroke={shape.door.frame} strokeWidth={6} />
              {shape.handle === 'groove-h' ? (
                <rect x={b.x + 4} y={atBottom ? b.y + b.h - 26 : b.y + 4} width={b.w - 8} height={22} fill="#1c1d20" />
              ) : (
                <rect x={d.hinge === 'left' ? free - 12 : free} y={b.y + b.h * 0.25} width={12} height={Math.min(b.h * 0.3, 350)} fill="#1c1d20" />
              )}
              {shape.display && (
                <rect {...rectProps(scale(shape.display, { x: 0, y: 0, w: W, h: H }))} rx={8} fill="#111214" />
              )}
              <text x={b.x + b.w / 2} y={top + 80} fontSize={44} textAnchor="middle" fill="#334155" fontWeight="bold">
                {d.label}
              </text>
              <text x={b.x + b.w / 2} y={top + 140} fontSize={38} textAnchor="middle" fill="#64748b">
                {items.length}개
              </text>
              {badges.map((lv, i) => (
                <g key={lv} transform={`translate(${b.x + b.w / 2 + (i - (badges.length - 1) / 2) * 110}, ${top + 220})`}>
                  <circle r={46} fill={RING[lv]} />
                  <text y={4} fontSize={44} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fill={lv === 'soon' ? '#451a03' : '#fff'}>
                    {count(lv)}
                  </text>
                </g>
              ))}
            </g>
          )
        })}
        <text x={W / 2} y={H + 34} fontSize={30} textAnchor="middle" fill="#94a3b8">
          문을 누르면 안을 볼 수 있어요
        </text>
      </svg>
    )
  }

  if (view === 'open') {
    // 가운데 몸체, 열린 문은 경첩 쪽 바깥으로 펼쳐서 안쪽 포켓이 보이게
    const flap = 0.62
    const leftDoors = shape.doors.filter((d) => d.hinge === 'left')
    const rightDoors = shape.doors.filter((d) => d.hinge === 'right')
    const maxW = (ds: DoorSpec[]) => Math.max(0, ...ds.map((d) => d.rect.w * W * flap))
    const lw = maxW(leftDoors)
    const rw = maxW(rightDoors)
    const gap = 24
    const bodyX = lw ? lw + gap : 0
    const total = bodyX + W + (rw ? gap + rw : 0)
    const wall = 26
    const inner = { x: bodyX + wall, y: wall, w: W - wall * 2, h: H - wall * 2 }
    return (
      <svg viewBox={`-10 -10 ${total + 20} ${H + 20}`} className={svgClass} role="img" aria-label="문 열린 정면">
        <g onClick={() => onSelect(null)}>
          <rect x={bodyX} y={0} width={W} height={H} rx={18} fill={shape.body} />
          <rect {...rectProps(inner)} rx={8} fill="#f1f5f9" />
        </g>
        {shape.dividers.map((dv, i) =>
          dv.dir === 'h' ? (
            <rect key={i} x={inner.x + dv.from * inner.w} y={inner.y + dv.at * inner.h - 10} width={(dv.to - dv.from) * inner.w} height={20} fill={shape.body} />
          ) : (
            <rect key={i} x={inner.x + dv.at * inner.w - 10} y={inner.y + dv.from * inner.h} width={20} height={(dv.to - dv.from) * inner.h} fill={shape.body} />
          ),
        )}
        {cabinet.map((c) => (
          <Region
            key={c.id}
            box={scale(c.layout!, inner)}
            c={c}
            items={itemsOf(c)}
            selected={selectedId === c.id}
            onSelect={onSelect}
            onOpen={onOpenItem}
            fill={ZONE_FILL[c.zone]}
          />
        ))}
        {shape.doors.map((d) => {
          const dw = d.rect.w * W * flap
          const dx = d.hinge === 'left' ? bodyX - gap - dw : bodyX + W + gap
          const door: Box = { x: dx, y: d.rect.y * H + 4, w: dw, h: d.rect.h * H - 8 }
          const mine = pockets.filter((c) => doorOf(shape, c)?.id === d.id)
          return (
            <g key={d.id}>
              <rect {...rectProps(door)} rx={14} fill={shape.door.color} stroke={STROKE} strokeWidth={4} />
              {mine.map((c) => (
                <Region
                  key={c.id}
                  box={scale(pocketRectInDoor(d, c), door)}
                  c={c}
                  items={itemsOf(c)}
                  selected={selectedId === c.id}
                  onSelect={onSelect}
                  onOpen={onOpenItem}
                  fill="#f1f5f9"
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
  const doorD = 230
  const bodyD = D - doorD
  const wall = 26
  const inner = { x: wall, y: wall, w: bodyD - wall, h: H - wall * 2 }
  const bands = new Map<string, Compartment[]>()
  for (const c of cabinet) {
    const k = `${c.layout!.y}:${c.layout!.h}`
    bands.set(k, [...(bands.get(k) ?? []), c])
  }
  return (
    <svg viewBox={`-10 -10 ${D + 20} ${H + 70}`} className={svgClass} role="img" aria-label="측면 단면">
      <g onClick={() => onSelect(null)}>
        <rect x={0} y={0} width={bodyD} height={H} rx={14} fill={shape.body} />
        <rect {...rectProps(inner)} fill="#f1f5f9" />
      </g>
      {[...bands.values()].map((group) =>
        group.map((c, i) => {
          const l = c.layout!
          const y = inner.y + l.y * inner.h
          const h = l.h * inner.h
          // 같은 높이에 칸이 여러 개면(아래 좌우 서랍) 깊이 방향으로 나눠 보여준다
          const w = inner.w / group.length
          return (
            <Region
              key={c.id}
              box={{ x: inner.x + i * w, y, w, h }}
              c={c}
              items={itemsOf(c)}
              selected={selectedId === c.id}
              onSelect={onSelect}
              onOpen={onOpenItem}
              fill={ZONE_FILL[c.zone]}
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
            <rect {...rectProps(door)} rx={10} fill={shape.door.color} stroke={STROKE} strokeWidth={2} />
            {[...rows.values()].map((cs) => (
              <Region
                key={cs[0].id}
                box={scale(pocketRectInDoor(doorOf(shape, cs[0])!, cs[0]), door)}
                c={cs[0]}
                items={cs.flatMap(itemsOf)}
                selected={cs.some((c) => c.id === selectedId)}
                onSelect={onSelect}
                onOpen={onOpenItem}
                fill="#f8fafc"
                label=""
              />
            ))}
          </g>
        )
      })}
      <text x={D / 2} y={H + 44} fontSize={34} textAnchor="middle" fill="#94a3b8">
        ← 뒤 · 앞(문) →
      </text>
    </svg>
  )
}
