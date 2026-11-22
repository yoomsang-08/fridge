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
  | 'banana' | 'broccoli' | 'corn' | 'cucumber' | 'garlic' | 'grape' | 'green-onion'
  | 'kabocha' | 'lemon' | 'mushroom' | 'pear' | 'pepper' | 'watermelon'
  | 'asparagus' | 'bean-sprout' | 'blueberry' | 'bread' | 'burdock' | 'butter' | 'cabbage' | 'cheese' | 'cherry' | 'chive' | 'cooked-rice'
  | 'crab' | 'duck' | 'dumpling' | 'eggplant' | 'fishcake' | 'ginger' | 'grapefruit' | 'ice-cream' | 'lotus-root' | 'mango' | 'melon'
  | 'peach' | 'persimmon' | 'pineapple' | 'pizza' | 'radish' | 'rice-cake' | 'sausage' | 'seaweed' | 'shellfish' | 'shrimp' | 'squid'

export type ModelKey = { kind: 'container'; name: ContainerModel } | { kind: 'food'; name: FoodModel }

/** 모델 전체 높이(s 배). 이름표·누르는 자리 높이에 쓴다 */
export const MODEL_HEIGHT: Record<ContainerModel | FoodModel, number> = {
  bottle: 1.25, 'oil-bottle': 1.15, 'sauce-bottle': 1.05, 'wine-bottle': 1.25,
  jar: 0.72, carton: 1.05, can: 0.62, tub: 0.52, box: 0.6, bag: 0.8, tray: 0.24, egg: 0.337, 'egg-tray': 0.3,
  apple: 0.606, avocado: 0.75, carrot: 0.52, chicken: 0.305, fish: 0.33, kimchi: 0.558,
  milk: 1.0, onion: 0.593, pork: 0.314, potato: 0.401, tofu: 0.466, tomato: 0.43,
  banana: 0.62, broccoli: 0.62, corn: 0.62, cucumber: 0.236, garlic: 0.62, grape: 0.62, 'green-onion': 0.62,
  kabocha: 0.62, lemon: 0.353, mushroom: 0.62, pear: 0.62, pepper: 0.62, watermelon: 0.57,
  // 3순위 추가 납품 33종: 납품 크기가 이미 앱 식품과 같아 줄이지 않는다(높이 0.6 이하·가로 0.74 이하)
  asparagus: 0.59, 'bean-sprout': 0.428, blueberry: 0.398, bread: 0.41,
  burdock: 0.385, butter: 0.263, cabbage: 0.425, cheese: 0.278,
  cherry: 0.577, chive: 0.562, 'cooked-rice': 0.352, crab: 0.25,
  duck: 0.326, dumpling: 0.247, eggplant: 0.586, fishcake: 0.19,
  ginger: 0.335, grapefruit: 0.554, 'ice-cream': 0.558, 'lotus-root': 0.227,
  mango: 0.565, melon: 0.577, peach: 0.548, persimmon: 0.445,
  pineapple: 0.609, pizza: 0.167, radish: 0.609, 'rice-cake': 0.242,
  sausage: 0.328, seaweed: 0.278, shellfish: 0.251, shrimp: 0.241,
  squid: 0.253,
}

/**
 * 2순위 채소·과일은 납품 크기가 커서(높이 0.8~1.4, 오이 가로 1.6) 앱에서 1순위 식품과 비슷한 크기가 되도록 줄인다.
 * 높이 0.62 이하·가로 0.8 이하. MODEL_HEIGHT 는 이미 줄인 뒤의 높이. 없는 모델은 1배
 */
export const MODEL_SCALE: Partial<Record<FoodModel, number>> = {
  banana: 0.489, broccoli: 0.508, corn: 0.646, cucumber: 0.491, garlic: 0.795, grape: 0.471, 'green-onion': 0.456,
  kabocha: 0.715, lemon: 0.63, mushroom: 0.738, pear: 0.518, pepper: 0.616, watermelon: 0.667,
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
  [/단호박/, 'kabocha', (l) => l.variant === 'apple'],
  [/오이|애호박|주키니|^호박/, 'cucumber', (l) => l.variant === 'long'],
  [/대파|쪽파|^파$/, 'green-onion', (l) => l.variant === 'long'],
  [/마늘/, 'garlic', (l) => l.variant === 'apple'],
  [/브로콜리/, 'broccoli', (l) => l.variant === 'apple'],
  [/파프리카|피망|고추/, 'pepper', (l) => l.variant === 'apple'],
  [/바나나/, 'banana', (l) => l.variant === 'banana'],
  [/포도|샤인/, 'grape', (l) => l.variant === 'apple'],
  [/수박/, 'watermelon', (l) => l.variant === 'apple'],
  [/레몬/, 'lemon', (l) => l.variant === 'apple'],
  [/^(나주|신고|황금)?배$/, 'pear', (l) => l.variant === 'apple'],
  [/버섯/, 'mushroom', () => true],
  [/옥수수/, 'corn', () => true],
  [/당근/, 'carrot', (l) => l.variant === 'carrot'],
  [/감자/, 'potato', (l) => l.variant === 'potato'],
  [/양파/, 'onion', (l) => l.variant === 'apple'],
  // 3순위 추가 납품 33종. 위 규칙이 먼저 맞으니, 아래는 겹칠 수 있는 이름만 앞쪽(밥 → 김, 피자 → 치즈, 어묵 → 게)에 둔다
  [/밥|햇반/, 'cooked-rice', () => true],
  [/^김$|김자반|조미김|구운김|김가루|미역|다시마|파래/, 'seaweed', () => true],
  [/피자(?!치즈)/, 'pizza', () => true],
  [/치즈/, 'cheese', () => true],
  [/(^|무염|가염)버터/, 'butter', () => true],
  [/빵|식빵|베이글|모닝빵/, 'bread', () => true],
  [/만두/, 'dumpling', () => true],
  [/떡/, 'rice-cake', () => true],
  [/아이스크림/, 'ice-cream', () => true],
  [/소시지|소세지|비엔나|햄(?!버거)|스팸/, 'sausage', () => true],
  [/어묵|오뎅|맛살/, 'fishcake', () => true],
  [/^게$|꽃게|대게|킹크랩|게살/, 'crab', () => true],
  [/새우(?!젓|깡|칩)|쉬림프/, 'shrimp', () => true],
  [/오징어|낙지|문어|쭈꾸미|주꾸미|한치/, 'squid', () => true],
  [/조개|바지락|홍합|^굴$|생굴|전복|가리비|꼬막/, 'shellfish', () => true],
  [/^오리(고기|탕)?$|훈제오리/, 'duck', () => true],
  [/복숭아|천도/, 'peach', (l) => l.variant === 'apple'],
  [/체리|앵두/, 'cherry', (l) => l.variant === 'apple'],
  [/블루베리/, 'blueberry', (l) => l.variant === 'apple'],
  [/망고/, 'mango', (l) => l.variant === 'apple'],
  [/자몽/, 'grapefruit', (l) => l.variant === 'apple'],
  [/참외|멜론/, 'melon', (l) => l.variant === 'apple'],
  [/파인애플/, 'pineapple', (l) => l.variant === 'apple'],
  [/^감$|단감|홍시|곶감/, 'persimmon', (l) => l.variant === 'apple'],
  [/^가지|가지나물/, 'eggplant', () => true],
  [/^(총각|알타리|열)?무$|무우/, 'radish', () => true],
  [/양배추|배추/, 'cabbage', () => true],
  [/부추/, 'chive', () => true],
  [/아스파라거스/, 'asparagus', () => true],
  [/콩나물|숙주/, 'bean-sprout', () => true],
  [/우엉/, 'burdock', () => true],
  [/연근/, 'lotus-root', () => true],
  [/생강/, 'ginger', () => true],
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
