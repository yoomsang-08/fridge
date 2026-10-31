import * as THREE from 'three'
import type { Shape3D } from './fridgeShape'

/* 3D 장면에서만 쓰는 용기 치수와 색. three 를 쓰니 3D 청크에서만 불러온다 */

/** 모양별 높이(s 배). 이름표를 어디에 붙일지 정할 때 쓴다 */
export const SHAPE_HEIGHT: Record<Shape3D, number> = {
  bottle: 1.25,
  jar: 0.72,
  carton: 1.05,
  can: 0.62,
  tub: 0.52,
  box: 0.6,
  bag: 0.8,
  tray: 0.24,
  loose: 0.6,
  egg: 0.3,
}

/**
 * 분류 tint 는 아주 옅어서 3D 에선 다 흰색처럼 보인다. 색상(hue)은 그대로 두고, 명도는 공간 배경과 대비되게 정한다.
 * 냉장고(흰 내부)는 L 0.60~0.72 로 내려서 또렷하게, 팬트리(원목)는 도자기처럼 L 0.88~0.93 으로 올려 선반에서 떠 보이게.
 * 그 범위 안에서 모양마다 명도를 조금씩 달리해 나란히 놓여도 구분되게 한다
 */
const TONE: Record<Shape3D, [saturation: number, step: number]> = {
  bottle: [0.42, 0.5],
  jar: [0.38, 0.8],
  carton: [0.3, 1],
  can: [0.34, 0.1],
  tub: [0.32, 0.7],
  box: [0.36, 0.6],
  bag: [0.44, 0.3],
  tray: [0.4, 0.2],
  loose: [0.5, 0],
  egg: [0.3, 0.9],
}

const LIGHTNESS = { fridge: [0.6, 0.72], pantry: [0.88, 0.93] } as const

export function bodyColor(tint: string, shape: Shape3D, space: keyof typeof LIGHTNESS): string {
  const hsl = { h: 0, s: 0, l: 0 }
  new THREE.Color(tint).getHSL(hsl)
  const [s, step] = TONE[shape]
  const [lo, hi] = LIGHTNESS[space]
  return `#${new THREE.Color().setHSL(hsl.h, hsl.s < 0.05 ? 0.04 : s, lo + (hi - lo) * step).getHexString()}`
}
