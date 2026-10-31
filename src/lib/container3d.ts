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
 * 분류 tint 는 아주 옅어서 3D 에선 다 흰색처럼 보인다. 색상은 그대로 두고 채도·명도를 모양마다 조금씩 달리해
 * 나란히 놓여도 명도 차로 구분되게 한다
 */
const TONE: Record<Shape3D, [number, number]> = {
  bottle: [0.42, 0.7],
  jar: [0.38, 0.76],
  carton: [0.3, 0.86],
  can: [0.34, 0.62],
  tub: [0.32, 0.8],
  box: [0.36, 0.74],
  bag: [0.44, 0.68],
  tray: [0.4, 0.66],
  loose: [0.5, 0.6],
  egg: [0.3, 0.84],
}

export function bodyColor(tint: string, shape: Shape3D): string {
  const hsl = { h: 0, s: 0, l: 0 }
  new THREE.Color(tint).getHSL(hsl)
  const [s, l] = TONE[shape]
  return `#${new THREE.Color().setHSL(hsl.h, hsl.s < 0.05 ? 0.04 : s, l).getHexString()}`
}
