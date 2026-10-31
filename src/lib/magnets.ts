/**
 * 메모 자석과 명절 가랜드 장식 그림. 24×24 칸에 토큰 색으로만 그린다.
 * 2D(SVG)와 3D(캔버스 Path2D)가 같은 그림을 쓴다.
 */
import type { Token } from './fridgeShape'

/** 원래 있던 자석(그리는 코드가 따로 있음) */
export type BasicMagnet = 'heart' | 'egg' | 'cake' | 'dot'

export const MAGNET_ART = {
  // 메모 내용 이스터에그
  spoon: [
    { d: 'M5 6a3 4 0 1 0 6 0a3 4 0 1 0 -6 0Z', fill: 'muted' },
    { d: 'M7.2 9h1.6v13h-1.6Z', fill: 'muted' },
    { d: 'M14 2h1.4l1.2 20h-1.2Z', fill: 'soon' },
    { d: 'M18.2 2h1.4l-0.6 20h-1.2Z', fill: 'soon' },
  ],
  moon: [{ d: 'M15 2.5a9.5 9.5 0 1 0 6.5 15.5a7.5 7.5 0 1 1 -6.5 -15.5Z', fill: 'soon' }],
  // 명절
  pouch: [
    { d: 'M7 10c-4 3-4 11.5 5 11.5s9-8.5 5-11.5Z', fill: 'expired' },
    { d: 'M8 9.5l-2-6 3 2 3-3 3 3 3-2-2 6Z', fill: 'expired' },
    { d: 'M6.5 9h11v2.4h-11Z', fill: 'soon' },
    { d: 'M12 13l1.6 2.2-1.6 2.2-1.6-2.2Z', fill: 'soon' },
  ],
  songpyeon: [{ d: 'M2.5 16c0-6.5 5-10.5 9.5-10.5s9.5 4 9.5 10.5c-4 2.6-15 2.6-19 0Z', fill: 'note-mint', stroke: 'accent', w: 1.4 }],
  fullmoon: [{ d: 'M2.5 12a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0 -19 0Z', fill: 'soon' }],
  tree: [
    { d: 'M12 2.5l5.5 7.5h-3.2l5.2 7.5h-15l5.2-7.5h-3.2Z', fill: 'accent' },
    { d: 'M10.6 17.5h2.8v4.5h-2.8Z', fill: 'urgent' },
  ],
  sparkle: [{ d: 'M12 1.5l2.4 8.1 8.1 2.4-8.1 2.4-2.4 8.1-2.4-8.1-8.1-2.4 8.1-2.4Z', fill: 'soon' }],
  balloon: [
    { d: 'M5 9.5a7 7.5 0 1 0 14 0a7 7.5 0 1 0 -14 0Z', fill: 'expired' },
    { d: 'M10.8 16.8h2.4l-1.2 1.6Z', fill: 'expired' },
    { d: 'M12 18.4c-2 1.6 2 2.2 0 4', stroke: 'muted', w: 1.2 },
  ],
  pumpkin: [
    { d: 'M12 7c-5.5 0-9.5 3-9.5 7.5S6.5 21.5 12 21.5s9.5-2.5 9.5-7S17.5 7 12 7Z', fill: 'urgent' },
    { d: 'M12 7.5c-2.5 2-2.5 12 0 13.5M12 7.5c2.5 2 2.5 12 0 13.5', stroke: 'soon', w: 1.2 },
    { d: 'M11 2.5h2.2l.3 5h-2.8Z', fill: 'accent' },
  ],
  carnation: [
    { d: 'M4.5 7.5l2.2-4.5 2.6 2.6L12 2.2l2.7 3.4 2.6-2.6 2.2 4.5c0 3.3-3.2 5.5-7.5 5.5s-7.5-2.2-7.5-5.5Z', fill: 'expired' },
    { d: 'M11.2 13h1.6v9h-1.6Z', fill: 'accent' },
    { d: 'M12.5 18c2-2.2 4.2-2.4 5.5-1.2-1.2 2-3.4 2.4-5.5 1.2Z', fill: 'accent' },
  ],
  stick: [
    { d: 'M3 19.5l1.5 1.5 6-6-1.5-1.5Z', fill: 'soon' },
    { d: 'M9 13.5l1.5 1.5 10-10-1.5-1.5Z', fill: 'ink' },
    { d: 'M7 21.5l1.5 1.5 4-4-1.5-1.5Z', fill: 'soon' },
    { d: 'M11 17.5l1.5 1.5 9-9-1.5-1.5Z', fill: 'ink' },
  ],
  redbean: [
    { d: 'M2.5 11h19c0 6.5-4.5 10.5-9.5 10.5S2.5 17.5 2.5 11Z', fill: 'surface', stroke: 'muted', w: 1.4 },
    { d: 'M3.5 11.2c2.5-2.6 14.5-2.6 17 0Z', fill: 'expired' },
    { d: 'M8.6 9.6a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM12.8 9.4a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0Z', fill: 'surface' },
  ],
  samgye: [
    { d: 'M7 9.5c0-3.5 3-5 5.5-4s3.5 3.5 3.5 4Z', fill: 'note-yellow', stroke: 'soon', w: 1.2 },
    { d: 'M2.5 11h19c0 6.5-4.5 10.5-9.5 10.5S2.5 17.5 2.5 11Z', fill: 'surface', stroke: 'muted', w: 1.4 },
    { d: 'M8 1.5c-1 1.2 1 2 0 3.2M16 1.5c-1 1.2 1 2 0 3.2', stroke: 'muted', w: 1 },
  ],
  nut: [
    { d: 'M12 2.5c5 0 8 4 8 9.5s-3 9.5-8 9.5-8-4-8-9.5 3-9.5 8-9.5Z', fill: 'soon' },
    { d: 'M12 2.5v19M8 7.5c2 1 2 3 0 4.5M16 7.5c-2 1-2 3 0 4.5M8 14c2 1 2 3 0 4.5M16 14c-2 1-2 3 0 4.5', stroke: 'urgent', w: 1.1 },
  ],
  flag: [
    { d: 'M1.5 5h21v14h-21Z', fill: 'surface', stroke: 'line', w: 1.2 },
    { d: 'M8.4 12a3.6 3.6 0 0 1 7.2 0Z', fill: 'expired' },
    { d: 'M8.4 12a3.6 3.6 0 0 0 7.2 0Z', fill: 'festive-blue' },
    { d: 'M3.6 8.6l2.2-1.6.5.6-2.2 1.6ZM18.2 7l2.2 1.6-.5.6-2.2-1.6ZM3.6 15.4l2.2 1.6.5-.6-2.2-1.6ZM18.2 17l2.2-1.6-.5-.6-2.2 1.6Z', fill: 'ink' },
  ],
} satisfies Record<string, { d: string; fill?: Token; stroke?: Token; w?: number }[]>

export type ArtMagnet = keyof typeof MAGNET_ART
export type MagnetKind = BasicMagnet | ArtMagnet

export const isArt = (k: MagnetKind): k is ArtMagnet => k in MAGNET_ART

type Part = { d: string; fill?: Token; stroke?: Token; w?: number }
export const partsOf = (k: ArtMagnet): Part[] => MAGNET_ART[k]

/** 캔버스에 그림을 (x, y) 가운데, 한 변 size 로 */
export function drawArt(g: CanvasRenderingContext2D, k: ArtMagnet, x: number, y: number, size: number, color: (t: Token) => string) {
  g.save()
  g.translate(x - size / 2, y - size / 2)
  g.scale(size / 24, size / 24)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const p of partsOf(k)) {
    const path = new Path2D(p.d)
    if (p.fill) {
      g.fillStyle = color(p.fill)
      g.fill(path)
    }
    if (p.stroke) {
      g.strokeStyle = color(p.stroke)
      g.lineWidth = p.w ?? 1.2
      g.stroke(path)
    }
  }
  g.restore()
}
