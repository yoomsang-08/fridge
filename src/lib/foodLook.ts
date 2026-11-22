import type { Item } from './types'

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
  emoji: string
  /** 실제 색(#rrggbb). 3D 몸체의 색상·채도. 명도는 공간 배경과 대비되게 따로 맞춘다 */
  color?: string
  variant?: LookVariant
  /** variant 'label' 의 띠 색 */
  band?: string
}

const RULES: [RegExp, FoodLook][] = [
  // 가공품: 원재료 이름이 들어간 것(토마토케첩·딸기잼·사과주스·배추김치)이 아래 채소·과일 규칙에 먼저 걸리지 않게 맨 위
  [/소시지|소세지|비엔나|햄|베이컨|스팸/, { emoji: '🌭', color: '#d4766a' }],
  [/요구르트|요거트|플레인/, { emoji: '🥛', color: '#f1e9f2', variant: 'label', band: '#c25b8a' }],
  [/김치|깍두기|겉절이/, { emoji: '🥬', color: '#c9402b' }],
  [/라면|국수|파스타|우동|냉면|칼국수|짜장면|짬뽕|^면$/, { emoji: '🍜', color: '#e8c98a' }],
  [/밥|햇반|죽$/, { emoji: '🍚', color: '#f2ede0' }],
  [/빵|식빵|베이글|모닝빵/, { emoji: '🍞', color: '#d9a05b' }],
  [/만두/, { emoji: '🥟', color: '#efe3c9' }],
  [/피자/, { emoji: '🍕', color: '#e0a54a' }],
  [/떡/, { emoji: '🍡', color: '#f4e9e4' }],
  [/아이스크림/, { emoji: '🍦', color: '#f3dfc0' }],
  [/맥주/, { emoji: '🍺', color: '#d9a02a' }],
  [/콜라/, { emoji: '🥤', color: '#7a2a24' }],
  [/사이다|탄산/, { emoji: '🥤', color: '#a9d6b6' }],
  [/생수|워터|^물$/, { emoji: '💧', color: '#bfdcef', variant: 'label', band: '#3b7fc4' }],
  [/주스|쥬스|즙/, { emoji: '🧃', color: '#f2a33a' }],
  [/와인/, { emoji: '🍷', color: '#6a2a3a' }],
  [/커피/, { emoji: '☕', color: '#7a5a44' }],
  [/케첩/, { emoji: '🍅', color: '#cf3326', variant: 'label', band: '#f4f0e6' }],
  [/마요/, { emoji: '🧴', color: '#f1e6c0', variant: 'label', band: '#d33a2c' }],
  [/간장/, { emoji: '🧂', color: '#4a2d22', variant: 'label', band: '#d33a2c' }],
  [/고추장|쌈장|된장/, { emoji: '🥫', color: '#b8452a' }],
  [/식용유|올리브|참기름|들기름|오일|기름/, { emoji: '🫒', color: '#c9a62e', variant: 'label', band: '#5b8a3c' }],
  [/꿀/, { emoji: '🍯', color: '#e2a42a' }],
  [/잼/, { emoji: '🍓', color: '#b02a44' }],
  // 원재료
  [/단호박/, { emoji: '🎃', color: '#d98a2b', variant: 'apple' }],
  [/우유|두유/, { emoji: '🥛', color: '#f3f1ea', variant: 'label', band: '#3b7fc4' }],
  [/치즈/, { emoji: '🧀', color: '#f2c94c' }],
  [/버터/, { emoji: '🧈', color: '#f4dc7a' }],
  [/사과|홍로|부사|아오리|시나노/, { emoji: '🍎', color: '#d2392f', variant: 'apple' }],
  [/^(나주|신고|황금)?배$/, { emoji: '🍐', color: '#c9c75a', variant: 'apple' }],
  [/귤|오렌지|한라봉|천혜향/, { emoji: '🍊', color: '#f08a1c', variant: 'apple' }],
  [/레몬/, { emoji: '🍋', color: '#f2d02b', variant: 'apple' }],
  [/바나나/, { emoji: '🍌', color: '#f2d24b', variant: 'banana' }],
  [/딸기/, { emoji: '🍓', color: '#e0334a', variant: 'apple' }],
  [/복숭아|천도/, { emoji: '🍑', color: '#f2a58a', variant: 'apple' }],
  [/체리|앵두/, { emoji: '🍒', color: '#b3203a', variant: 'apple' }],
  [/블루베리/, { emoji: '🫐', color: '#3f4f9a', variant: 'apple' }],
  [/망고/, { emoji: '🥭', color: '#f2a93b', variant: 'apple' }],
  [/자몽/, { emoji: '🍊', color: '#ee7d63', variant: 'apple' }],
  [/참외|멜론/, { emoji: '🍈', color: '#e6d35a', variant: 'apple' }],
  [/파인애플/, { emoji: '🍍', color: '#e8c030', variant: 'apple' }],
  [/^감$|단감|홍시|곶감/, { emoji: '🍊', color: '#e8862a', variant: 'apple' }],
  [/포도|샤인/, { emoji: '🍇', color: '#6b4aa0', variant: 'apple' }],
  [/수박/, { emoji: '🍉', color: '#4f9a4a', variant: 'apple' }],
  [/키위/, { emoji: '🥝', color: '#8aa83a', variant: 'apple' }],
  [/아보카도/, { emoji: '🥑', color: '#58733a', variant: 'apple' }],
  [/토마토/, { emoji: '🍅', color: '#dc3a2c', variant: 'apple' }],
  [/당근/, { emoji: '🥕', color: '#f08a24', variant: 'carrot' }],
  [/감자|고구마/, { emoji: '🥔', color: '#b98a55', variant: 'potato' }],
  [/오이|애호박|주키니|호박/, { emoji: '🥒', color: '#4f9440', variant: 'long' }],
  [/대파|쪽파|^파$/, { emoji: '🌱', color: '#6fae4f', variant: 'long' }],
  [/파프리카|피망|고추/, { emoji: '🫑', color: '#4fa04a', variant: 'apple' }],
  [/양파/, { emoji: '🧅', color: '#d9a85a', variant: 'apple' }],
  [/마늘/, { emoji: '🧄', color: '#efe6d2', variant: 'apple' }],
  [/브로콜리/, { emoji: '🥦', color: '#4d8f45', variant: 'apple' }],
  [/^가지|가지나물/, { emoji: '🍆', color: '#5b3a78' }],
  [/^(총각|알타리|열)?무$|무우/, { emoji: '🥬', color: '#eef0e6' }],
  [/부추/, { emoji: '🌱', color: '#5da648' }],
  [/아스파라거스/, { emoji: '🌱', color: '#78a84a' }],
  [/콩나물|숙주/, { emoji: '🌱', color: '#e9e2b0' }],
  [/우엉/, { emoji: '🥕', color: '#8a6a48' }],
  [/연근/, { emoji: '🌿', color: '#e6d4c0' }],
  [/생강/, { emoji: '🌿', color: '#d9b878' }],
  [/^김$|김자반|조미김|구운김|김가루|미역|다시마|파래/, { emoji: '🌿', color: '#2f4a3a' }],
  [/어묵|오뎅|맛살/, { emoji: '🍥', color: '#f0dcc0' }],
  [/^게$|꽃게|대게|킹크랩|게살/, { emoji: '🦀', color: '#e4573d' }],
  [/조개|바지락|홍합|^굴$|생굴|전복|가리비|꼬막/, { emoji: '🐚', color: '#cdbfae' }],
  [/^오리(고기|탕)?$|훈제오리/, { emoji: '🍗', color: '#c98a5e' }],
  [/상추|깻잎|시금치|배추|양배추|청경채|쌈/, { emoji: '🥬', color: '#68b250' }],
  [/버섯/, { emoji: '🍄', color: '#b9a58f' }],
  [/옥수수/, { emoji: '🌽', color: '#f2c63a' }],
  [/삼겹|목살|등심|안심|갈비|소고기|돼지|한우|불고기|앞다리|뒷다리|다짐육|쇠고기|양지|차돌|사태|우둔|채끝|스테이크|수육/, { emoji: '🥩', color: '#d9626b' }],
  [/닭|치킨/, { emoji: '🍗', color: '#e6a98f' }],
  [/연어|생선|고등어|갈치|조기|^회|참치회|삼치|광어|우럭|도미|꽁치|명태|동태|대구|장어/, { emoji: '🐟', color: '#e98f78' }],
  [/새우|쉬림프/, { emoji: '🦐', color: '#ec8a6a' }],
  [/오징어|낙지|문어|쭈꾸미|주꾸미|한치/, { emoji: '🦑', color: '#d7b8c0' }],
  [/두부/, { emoji: '🧊', color: '#f6f1df' }],
  [/계란|달걀/, { emoji: '🥚', color: '#e6c9a0' }],
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
  // 고구마는 🍠
  return /고구마/.test(item.name) ? '🍠' : look.emoji
}
