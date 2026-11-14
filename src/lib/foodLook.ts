import type { Item } from './types'

/** src/assets/food/*.png — 파일이 있는 것만 들어온다. 없으면 빈 객체라 이모지로 대체된다 */
const IMAGES = import.meta.glob('../assets/food/*.png', { eager: true, import: 'default', query: '?url' }) as Record<string, string>
const IMAGE_OF: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGES).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.png$/, ''), url]),
)

/**
 * 자주 쓰는 식품의 '실제 모습'. 이름(정규식)으로 찾아 이모지·3D 색·특징 모양을 정한다.
 * 위에 있는 규칙이 먼저 맞는다(구체적인 것 → 일반적인 것). 못 찾으면 분류 기본(이모지·옅은 색·용기)을 그대로 쓴다.
 * 2D(이모지)와 3D(색·모양)가 같은 표를 보므로 이 표 한 곳만 고치면 둘 다 바뀐다.
 */

/** 3D 에서 용기 위에 얹는 특징 모양 */
export type LookVariant =
  | 'apple' // 둥근 열매 + 꼭지 (사과·토마토·귤…)
  | 'carrot' // 뾰족한 원뿔
  | 'long' // 누운 긴 원통 (오이·호박·대파)
  | 'potato' // 납작한 타원 (감자·고구마)
  | 'banana' // 휜 길쭉이
  | 'label' // 용기 가운데 띠 라벨 (우유·생수·소스)

export interface FoodLook {
  /** 그림 파일 이름(영문 kebab). src/assets/food/<id>.png 가 있으면 이모지 대신 그 그림을 쓴다 */
  id: string
  emoji: string
  /** 실제 색(#rrggbb). 3D 몸체의 색상·채도. 명도는 공간 배경과 대비되게 따로 맞춘다 */
  color?: string
  variant?: LookVariant
  /** variant 'label' 의 띠 색 */
  band?: string
}

const RULES: [RegExp, FoodLook][] = [
  // 가공품: 원재료 이름이 들어간 것(토마토케첩·딸기잼·사과주스·배추김치)이 아래 채소·과일 규칙에 먼저 걸리지 않게 맨 위
  [/소시지|햄|베이컨|스팸/, { id: 'sausage', emoji: '🌭', color: '#d4766a' }],
  [/요구르트|요거트|플레인/, { id: 'yogurt', emoji: '🥛', color: '#f1e9f2', variant: 'label', band: '#c25b8a' }],
  [/김치|깍두기|겉절이/, { id: 'kimchi', emoji: '🥬', color: '#c9402b' }],
  [/라면|국수|파스타|우동|냉면|칼국수|짜장면|짬뽕|^면$/, { id: 'noodle', emoji: '🍜', color: '#e8c98a' }],
  [/밥|햇반|죽$/, { id: 'rice', emoji: '🍚', color: '#f2ede0' }],
  [/빵|식빵|베이글|모닝빵/, { id: 'bread', emoji: '🍞', color: '#d9a05b' }],
  [/만두/, { id: 'dumpling', emoji: '🥟', color: '#efe3c9' }],
  [/피자/, { id: 'pizza', emoji: '🍕', color: '#e0a54a' }],
  [/떡/, { id: 'rice-cake', emoji: '🍡', color: '#f4e9e4' }],
  [/아이스크림/, { id: 'ice-cream', emoji: '🍦', color: '#f3dfc0' }],
  [/맥주/, { id: 'beer', emoji: '🍺', color: '#d9a02a' }],
  [/콜라/, { id: 'cola', emoji: '🥤', color: '#7a2a24' }],
  [/사이다|탄산/, { id: 'soda', emoji: '🥤', color: '#a9d6b6' }],
  [/생수|워터|^물$/, { id: 'water', emoji: '💧', color: '#bfdcef', variant: 'label', band: '#3b7fc4' }],
  [/주스|쥬스/, { id: 'juice', emoji: '🧃', color: '#f2a33a' }],
  [/와인/, { id: 'wine', emoji: '🍷', color: '#6a2a3a' }],
  [/커피/, { id: 'coffee', emoji: '☕', color: '#7a5a44' }],
  [/케첩/, { id: 'ketchup', emoji: '🍅', color: '#cf3326', variant: 'label', band: '#f4f0e6' }],
  [/마요/, { id: 'mayo', emoji: '🧴', color: '#f1e6c0', variant: 'label', band: '#d33a2c' }],
  [/간장/, { id: 'soy-sauce', emoji: '🧂', color: '#4a2d22', variant: 'label', band: '#d33a2c' }],
  [/고추장|쌈장|된장/, { id: 'gochujang', emoji: '🥫', color: '#b8452a' }],
  [/식용유|올리브|참기름|들기름|오일|기름/, { id: 'cooking-oil', emoji: '🫒', color: '#c9a62e', variant: 'label', band: '#5b8a3c' }],
  [/꿀/, { id: 'honey', emoji: '🍯', color: '#e2a42a' }],
  [/잼/, { id: 'jam', emoji: '🍓', color: '#b02a44' }],
  // 원재료
  [/단호박/, { id: 'kabocha', emoji: '🎃', color: '#d98a2b', variant: 'apple' }],
  [/우유|두유/, { id: 'milk', emoji: '🥛', color: '#f3f1ea', variant: 'label', band: '#3b7fc4' }],
  [/치즈/, { id: 'cheese', emoji: '🧀', color: '#f2c94c' }],
  [/버터/, { id: 'butter', emoji: '🧈', color: '#f4dc7a' }],
  [/사과/, { id: 'apple', emoji: '🍎', color: '#d2392f', variant: 'apple' }],
  [/^(나주|신고|황금)?배$/, { id: 'pear', emoji: '🍐', color: '#c9c75a', variant: 'apple' }],
  [/귤|오렌지|한라봉|천혜향/, { id: 'tangerine', emoji: '🍊', color: '#f08a1c', variant: 'apple' }],
  [/레몬/, { id: 'lemon', emoji: '🍋', color: '#f2d02b', variant: 'apple' }],
  [/바나나/, { id: 'banana', emoji: '🍌', color: '#f2d24b', variant: 'banana' }],
  [/딸기/, { id: 'strawberry', emoji: '🍓', color: '#e0334a', variant: 'apple' }],
  [/포도|샤인/, { id: 'grape', emoji: '🍇', color: '#6b4aa0', variant: 'apple' }],
  [/수박/, { id: 'watermelon', emoji: '🍉', color: '#4f9a4a', variant: 'apple' }],
  [/키위/, { id: 'kiwi', emoji: '🥝', color: '#8aa83a', variant: 'apple' }],
  [/아보카도/, { id: 'avocado', emoji: '🥑', color: '#58733a', variant: 'apple' }],
  [/토마토/, { id: 'tomato', emoji: '🍅', color: '#dc3a2c', variant: 'apple' }],
  [/당근/, { id: 'carrot', emoji: '🥕', color: '#f08a24', variant: 'carrot' }],
  [/고구마/, { id: 'sweet-potato', emoji: '🍠', color: '#a8553a', variant: 'potato' }],
  [/감자/, { id: 'potato', emoji: '🥔', color: '#b98a55', variant: 'potato' }],
  [/오이|애호박|주키니|호박/, { id: 'cucumber', emoji: '🥒', color: '#4f9440', variant: 'long' }],
  [/대파|쪽파|^파$/, { id: 'green-onion', emoji: '🌱', color: '#6fae4f', variant: 'long' }],
  [/파프리카|피망|고추/, { id: 'pepper', emoji: '🫑', color: '#4fa04a', variant: 'apple' }],
  [/양파/, { id: 'onion', emoji: '🧅', color: '#d9a85a', variant: 'apple' }],
  [/마늘/, { id: 'garlic', emoji: '🧄', color: '#efe6d2', variant: 'apple' }],
  [/브로콜리/, { id: 'broccoli', emoji: '🥦', color: '#4d8f45', variant: 'apple' }],
  [/상추|깻잎|시금치|배추|양배추|청경채|쌈/, { id: 'leafy', emoji: '🥬', color: '#68b250' }],
  [/버섯/, { id: 'mushroom', emoji: '🍄', color: '#b9a58f' }],
  [/옥수수/, { id: 'corn', emoji: '🌽', color: '#f2c63a' }],
  [/삼겹|목살|등심|안심|갈비|소고기|돼지|한우|불고기|앞다리|뒷다리|다짐육/, { id: 'pork', emoji: '🥩', color: '#d9626b' }],
  [/닭|치킨/, { id: 'chicken', emoji: '🍗', color: '#e6a98f' }],
  [/연어|생선|고등어|갈치|조기|^회|참치회/, { id: 'fish', emoji: '🐟', color: '#e98f78' }],
  [/새우/, { id: 'shrimp', emoji: '🦐', color: '#ec8a6a' }],
  [/오징어|낙지|문어/, { id: 'squid', emoji: '🦑', color: '#d7b8c0' }],
  [/두부/, { id: 'tofu', emoji: '🧊', color: '#f6f1df' }],
  [/계란|달걀/, { id: 'egg', emoji: '🥚', color: '#e6c9a0' }],
]

export function lookOfName(name: string): FoodLook | null {
  const n = name.trim()
  if (!n) return null
  return RULES.find(([re]) => re.test(n))?.[1] ?? null
}

/** 식품 한 개의 이모지. 이름으로 못 찾으면 분류 이모지 */
export function emojiOfItem(item: Pick<Item, 'name'>, categoryEmoji: string): string {
  const look = lookOfName(item.name)
  if (!look) return categoryEmoji
  return look.emoji
}

/** 식품 한 개의 그림 주소. 그림 파일이 없으면 null(이모지로 대체) */
export function imageOfItem(item: Pick<Item, 'name'>): string | null {
  const look = lookOfName(item.name)
  return (look && IMAGE_OF[look.id]) || null
}

/** 요청서(docs/food-image-request.md)에 적을 규칙 id 전체. 그림이 아직 없는 것은 missingFoodIds */
export const FOOD_IDS = RULES.map(([, l]) => l.id)
export const missingFoodIds = () => FOOD_IDS.filter((id) => !IMAGE_OF[id])
