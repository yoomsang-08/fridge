import type { Shape3D } from './fridgeShape'
import { lookOfName } from './foodLook'

/**
 * 3D 모델(GLB) 고르기. three 를 쓰지 않아 어디서든 불러도 된다.
 * - 용기 모델(`container3d/<모양>.glb`): 몸통·띠 색만 바꿔 끼우는 틀. 모양(Shape3D)마다 하나, 병은 이름으로 세 갈래.
 * - 식품 모델(`food3d/<이름>.glb`): 색까지 정해진 완성품. 이름으로 알아본 식품이고 용기를 따로 안 골랐을 때만 쓴다.
 * 모델이 없는 식품(귤·키위·고구마·딸기·쌈채소 등)은 지금까지의 도형 그대로 그린다.
 */

export type ContainerModel = Exclude<Shape3D, 'loose' | 'egg'> | 'egg-tray' | 'oil-bottle' | 'sauce-bottle' | 'wine-bottle'
export type FoodModel =
  | 'apple' | 'avocado' | 'carrot' | 'chicken' | 'egg' | 'fish' | 'kimchi'
  | 'milk' | 'onion' | 'pork' | 'potato' | 'tofu' | 'tomato'

export type ModelKey = { kind: 'container'; name: ContainerModel } | { kind: 'food'; name: FoodModel }

/** 모델 전체 높이(s 배). 이름표·누르는 자리 높이에 쓴다 */
export const MODEL_HEIGHT: Record<ContainerModel | FoodModel, number> = {
  bottle: 1.25, 'oil-bottle': 1.15, 'sauce-bottle': 1.05, 'wine-bottle': 1.25,
  jar: 0.72, carton: 1.05, can: 0.62, tub: 0.52, box: 0.6, bag: 0.8, tray: 0.24, egg: 0.337, 'egg-tray': 0.3,
  apple: 0.606, avocado: 0.75, carrot: 0.52, chicken: 0.305, fish: 0.33, kimchi: 0.558,
  milk: 1.0, onion: 0.593, pork: 0.314, potato: 0.401, tofu: 0.466, tomato: 0.43,
}

/** 이름 → 식품 모델. 가공품(사과주스·딸기잼·토마토케첩…)이 원재료로 오인되지 않게 foodLook 이 알아본 모양과 함께 본다 */
const FOOD_RULES: [RegExp, FoodModel, (look: NonNullable<ReturnType<typeof lookOfName>>) => boolean][] = [
  [/우유|두유/, 'milk', (l) => l.variant === 'label'],
  [/김치|깍두기|겉절이/, 'kimchi', () => true],
  [/두부/, 'tofu', () => true],
  [/계란|달걀/, 'egg', () => true],
  [/닭|치킨/, 'chicken', () => true],
  [/삼겹|목살|등심|안심|갈비|소고기|돼지|한우|불고기|앞다리|뒷다리|다짐육|쇠고기|양지|차돌|사태|우둔|채끝|스테이크|수육/, 'pork', () => true],
  [/연어|생선|고등어|갈치|조기|^회|참치회|삼치|광어|우럭|도미|꽁치|명태|동태|대구|장어/, 'fish', () => true],
  [/사과|홍로|부사|아오리|시나노/, 'apple', (l) => l.variant === 'apple'],
  [/아보카도/, 'avocado', (l) => l.variant === 'apple'],
  [/토마토/, 'tomato', (l) => l.variant === 'apple'],
  [/당근/, 'carrot', (l) => l.variant === 'carrot'],
  [/감자/, 'potato', (l) => l.variant === 'potato'],
  [/양파/, 'onion', (l) => l.variant === 'apple'],
]

export function foodModelOfName(name: string): FoodModel | null {
  const look = lookOfName(name)
  if (!look) return null
  // 고구마는 감자와 모양이 달라 원래 도형을 쓴다
  if (/고구마/.test(name)) return null
  return FOOD_RULES.find(([re, , ok]) => re.test(name) && ok(look))?.[1] ?? null
}

/** 병은 이름으로 기름병·소스병·와인병을 가른다 */
function bottleModelOfName(name: string): ContainerModel {
  if (/식용유|올리브|참기름|들기름|오일|기름/.test(name)) return 'oil-bottle'
  if (/간장|케첩|마요|소스/.test(name)) return 'sauce-bottle'
  if (/와인/.test(name)) return 'wine-bottle'
  return 'bottle'
}

/**
 * 한 식품에 쓸 모델. 용기를 직접 골랐으면(`chosen`) 그 용기 모델, 아니면 이름으로 알아본 식품 모델.
 * `shape` 는 지금까지 정해 온 용기 모양(낱개 채소·과일은 'loose')
 */
export function pickModel(name: string, shape: Shape3D, chosen: boolean): ModelKey | null {
  if (!chosen) {
    const food = foodModelOfName(name)
    if (food) return { kind: 'food', name: food }
  }
  if (shape === 'loose') return null
  if (shape === 'egg') return { kind: 'container', name: 'egg-tray' }
  if (shape === 'bottle') return { kind: 'container', name: bottleModelOfName(name) }
  return { kind: 'container', name: shape }
}
