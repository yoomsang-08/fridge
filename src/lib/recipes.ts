import { daysLeft } from './expiry'
import { RECIPE_TABLE } from './recipeData'
import type { Item } from './types'

/**
 * 임박 재료로 만들 수 있는 요리 추천. LLM 없이, 미리 준비한 요리 표(recipeData.ts)와 규칙으로만 고른다.
 * 일주일 안에 기한이 오는 재료를 많이, 급하게 쓰는 요리일수록, 부족한 재료가 적을수록 위에 온다.
 */

/** 늘 집에 있다고 보는 기본 재료. 앱에 없어도 '있음'으로 친다 */
export const STAPLES = new Set([
  '소금', '간장', '식용유', '설탕', '후추', '참기름', '들기름', '고춧가루', '마늘', '양파', '대파', '계란',
  '된장', '고추장', '쌈장', '식초', '깨', '밀가루', '부침가루', '전분', '맛술', '액젓', '케첩', '마요네즈',
  '밥', '물엿', '굴소스',
])

/**
 * 앱에 적은 식품 이름 → 요리 재료 이름. 위에서부터 먼저 맞는 규칙이 이긴다.
 * 가공품(○○소스·○○주스)이 원재료 규칙에 걸리지 않게 위에 두고, null 은 요리 재료로 보지 않는 것.
 */
const INGREDIENTS: [string | null, RegExp][] = [
  [null, /칩$|과자|음료|주스|쥬스|맥주|와인|소주|커피|젤리|초콜릿|사탕|잼|아이스크림|스낵|에이드/],
  ['굴소스', /굴소스/],
  ['액젓', /액젓|참치액|멸치액|까나리/],
  ['케첩', /케첩/],
  ['마요네즈', /마요/],
  [null, /소스|드레싱|시럽/],
  ['참기름', /참기름/],
  ['들기름', /들기름/],
  ['고추장', /고추장/],
  ['고춧가루', /고춧가루|고추가루/],
  ['쌈장', /쌈장/],
  ['된장', /된장/],
  ['간장', /간장/],
  ['식초', /식초/],
  ['소금', /소금/],
  ['설탕', /설탕/],
  ['후추', /후추/],
  ['깨', /^(통|볶음)?깨$|참깨|들깨/],
  ['부침가루', /부침가루|튀김가루/],
  ['밀가루', /밀가루|중력분|박력분/],
  ['전분', /전분/],
  ['맛술', /맛술|미림/],
  ['식용유', /식용유|올리브유|카놀라|포도씨/],
  ['계란', /계란|달걀|메추리알/],
  // 가공·즉석
  ['만두', /만두/],
  ['라면', /라면/],
  ['어묵', /어묵|오뎅/],
  ['게맛살', /맛살|크래미/],
  ['햄', /햄|스팸|런천미트/],
  ['소시지', /소시지|소세지|비엔나|프랑크/],
  ['베이컨', /베이컨/],
  ['참치', /참치/],
  ['김치', /김치|깍두기|겉절이/],
  ['단무지', /단무지|피클|장아찌/],
  ['카레', /카레/],
  ['짜장', /짜장/],
  ['떡', /떡/],
  ['빵', /식빵|모닝빵|베이글|바게트|토스트|빵/],
  ['또띠아', /또띠아|토르티야/],
  ['시리얼', /시리얼|그래놀라|오트밀|뮤즐리/],
  ['우동', /우동/],
  ['냉면', /냉면/],
  ['칼국수면', /칼국수|수제비/],
  ['소면', /소면|국수|잔치/],
  ['파스타', /파스타|스파게티|스파게|펜네|링귀니|푸실리/],
  ['당면', /당면/],
  ['묵', /도토리묵|청포묵|메밀묵|묵$/],
  ['견과', /견과|아몬드|호두|땅콩|캐슈|잣$/],
  // 유제품
  ['우유', /우유|두유/],
  ['치즈', /치즈/],
  ['요거트', /요구르트|요거트|플레인/],
  ['생크림', /생크림|휘핑/],
  ['버터', /버터/],
  // 고기·해산물
  ['다진고기', /다짐육|다진\s?(고기|돼지|소)|간고기|민찌/],
  ['소고기', /소고기|쇠고기|한우|불고기|차돌|등심|안심|양지|사태|우둔|채끝|스테이크|국거리/],
  ['돼지고기', /삼겹|목살|앞다리|뒷다리|돼지|항정|갈매기|등갈비|수육|보쌈|제육/],
  ['닭고기', /닭|치킨|계육/],
  ['오리고기', /오리/],
  ['오징어', /오징어|한치/],
  ['새우', /새우/],
  ['고등어', /고등어/],
  ['갈치', /갈치/],
  ['연어', /연어/],
  ['명태', /명태|동태|북어|황태|코다리|생태/],
  ['흰살생선', /생선|조기|가자미|임연수|대구|광어|우럭|도미|장어|꽁치|아귀|삼치|병어/],
  ['조개', /조개|바지락|홍합|꼬막|관자/],
  ['굴', /굴$|^굴|\s굴/],
  ['멸치', /멸치/],
  ['낙지', /낙지|쭈꾸미|주꾸미|문어/],
  ['꽃게', /꽃게|게$/],
  ['김', /^(구운|조미|김밥)?\s?김$|김밥김|조미김|구운김|김가루/],
  ['미역', /미역/],
  // 채소·과일
  ['고구마', /고구마/],
  ['감자', /감자/],
  ['당근', /당근/],
  ['단호박', /단호박/],
  ['애호박', /애호박|주키니|호박/],
  ['오이', /오이/],
  ['양배추', /양배추/],
  ['배추', /배추|알배기/],
  ['시금치', /시금치/],
  ['콩나물', /콩나물/],
  ['숙주', /숙주/],
  ['열무', /열무/],
  ['무', /^(조선|미니)?무$|무우|^무\s/],
  ['버섯', /버섯|표고|느타리|팽이|새송이|양송이|만가닥|목이/],
  ['브로콜리', /브로콜리/],
  ['파프리카', /파프리카|피망/],
  ['가지', /(^|\s)가지($|\s)/],
  ['토마토', /토마토/],
  ['고추', /고추|청양|꽈리/],
  ['부추', /부추/],
  ['깻잎', /깻잎/],
  ['쌈채소', /상추|쌈채소|쌈\s?채소|로메인|치커리|적근대/],
  ['샐러드채소', /양상추|샐러드|채소믹스|케일|어린잎|루꼴라|로메인/],
  ['쪽파', /쪽파|실파/],
  ['대파', /대파|^파$|^파\s|쪽파/],
  ['양파', /양파/],
  ['마늘', /마늘/],
  ['청경채', /청경채/],
  ['연근', /연근/],
  ['우엉', /우엉/],
  ['고사리', /고사리/],
  ['도라지', /도라지/],
  ['미나리', /미나리/],
  ['옥수수', /옥수수|콘/],
  ['순두부', /순두부/],
  ['두부', /두부/],
  ['사과', /사과/],
  ['바나나', /바나나/],
  ['딸기', /딸기/],
  ['귤', /귤|오렌지|한라봉|천혜향|레드향/],
  ['키위', /키위/],
  ['아보카도', /아보카도/],
  ['레몬', /레몬|라임/],
  ['밥', /밥|쌀|햇반|즉석/],
]

/** 앱 식품 이름 → 요리 재료 이름 (없으면 null) */
export function ingredientOf(name: string): string | null {
  const n = name.trim()
  for (const [key, re] of INGREDIENTS) if (re.test(n)) return key
  return null
}

/** 한 칸: 'A' 또는 'A/B'(둘 중 하나). 파싱하면 후보 목록 */
type Slot = string[]

export type RecipeKind = '국' | '반' | '메' | '밥' | '면' | '간'
export const KIND_LABEL: Record<RecipeKind, string> = {
  국: '국·찌개',
  반: '반찬',
  메: '메인',
  밥: '밥',
  면: '면',
  간: '간단',
}

export interface Recipe {
  name: string
  /** 꼭 필요한 재료(칸마다 둘 중 하나) */
  need: Slot[]
  /** 있으면 좋은 재료 */
  extra: Slot[]
  kind: RecipeKind
}

const slots = (s: string): Slot[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.split('/'))

export const RECIPES: Recipe[] = RECIPE_TABLE.split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((line) => {
    const [name, need, extra, kind] = line.split('|')
    return { name, need: slots(need ?? ''), extra: slots(extra ?? ''), kind: kind as RecipeKind }
  })

export interface UsedItem {
  item: Item
  days: number
  /** 이 요리에서 이 식품이 맡은 재료 이름 */
  key: string
}

export interface Suggestion {
  recipe: Recipe
  /** 일주일 안에 기한이 오는데 이 요리로 쓸 수 있는 식품 (급한 순) */
  used: UsedItem[]
  /** 꼭 필요한데 냉장고에 없는 재료 (기본 재료는 빼고, 0~1개) */
  missing: string[]
  score: number
}

/** 오늘 기준 며칠 안에 쓸 식품을 '임박'으로 보나 */
export const SOON_DAYS = 7

/** 임박 식품: 아직 안 지났고 7일 안. 급한 순 */
export function soonItems(items: Item[], base?: Date): { item: Item; days: number }[] {
  const out: { item: Item; days: number }[] = []
  for (const item of items) {
    if (item.status && item.status !== 'active') continue
    const d = daysLeft(item.expiry_date, base)
    if (d !== null && d >= 0 && d <= SOON_DAYS) out.push({ item, days: d })
  }
  return out.sort((a, b) => a.days - b.days || a.item.name.localeCompare(b.item.name))
}

/** 급할수록 무겁게 */
const urgency = (d: number) => (d <= 1 ? 4 : d <= 3 ? 3 : d <= 5 ? 2 : 1.5)

/**
 * 임박 재료를 쓰는 요리를 점수순으로. focusId 를 주면 그 식품을 쓰는 요리만.
 * - 꼭 필요한 재료가 하나만 모자라도 보여 주고(‘~만 더 있으면’), 둘 이상 모자라면 뺀다
 * - 점수: 임박 재료를 쓸수록(급할수록 더) 오르고, 모자란 재료·안 쓰는 선택 재료가 있으면 조금씩 내려간다
 */
export function suggestRecipes(items: Item[], opts: { focusId?: string | null; base?: Date } = {}): Suggestion[] {
  const soon = soonItems(items, opts.base)
  if (soon.length === 0) return []
  // 재료 이름 → 가진 식품들(전체), 임박한 것들
  const have = new Set<string>()
  const soonByKey = new Map<string, { item: Item; days: number }>()
  for (const item of items) {
    if (item.status && item.status !== 'active') continue
    const k = ingredientOf(item.name)
    if (k) have.add(k)
  }
  for (const s of soon) {
    const k = ingredientOf(s.item.name)
    if (k && !soonByKey.has(k)) soonByKey.set(k, s)
  }

  const out: Suggestion[] = []
  for (const recipe of RECIPES) {
    const used: UsedItem[] = []
    const usedKeys = new Set<string>()
    const claim = (slot: Slot) => {
      for (const key of slot) {
        const s = soonByKey.get(key)
        if (s && !usedKeys.has(key)) {
          usedKeys.add(key)
          used.push({ item: s.item, days: s.days, key })
          return true
        }
      }
      return false
    }
    const missing: string[] = []
    let needSoon = 0
    for (const slot of recipe.need) {
      const hit = claim(slot)
      if (hit) needSoon++
      if (!hit && !slot.some((k) => STAPLES.has(k) || have.has(k))) missing.push(slot[0])
    }
    if (missing.length > 1) continue
    let extraHave = 0
    for (const slot of recipe.extra) {
      if (claim(slot)) extraHave++
      else if (slot.some((k) => !STAPLES.has(k) && have.has(k))) extraHave += 0.4
    }
    if (used.length === 0) continue
    if (opts.focusId && !used.some((u) => u.item.id === opts.focusId)) continue
    used.sort((a, b) => a.days - b.days)
    let score = used.reduce((n, u) => n + urgency(u.days), 0)
    score += needSoon > 0 ? 1 : 0 // 주재료가 임박 재료인 요리
    score += extraHave * 0.4
    score -= missing.length * 4.5
    score -= (recipe.extra.length - Math.floor(extraHave)) * 0.05
    out.push({ recipe, used, missing, score })
  }
  return out.sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name))
}
