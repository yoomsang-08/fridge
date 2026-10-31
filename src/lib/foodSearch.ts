import { FunctionRegion } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** supabase/functions/food-search 가 돌려주는 제품 정보 */
export interface FoodProduct {
  source: 'I1250' | 'C005' | 'openfoodfacts'
  name: string
  maker: string | null
  foodType: string | null
  /** 소비기한 원문 (예: "제조일로부터 12개월") */
  shelfLifeText: string | null
  /** 원문을 일수로 읽을 수 있을 때만 값이 있다 */
  shelfLifeDays: number | null
  reportNo: string | null
  barcode: string | null
}

/** 체험 모드(Supabase 없음)에서는 검색할 수 없다 */
export const foodSearchAvailable = supabase !== null

async function call(body: { q?: string; barcode?: string }): Promise<FoodProduct[]> {
  if (!supabase) return []
  const { data, error } = await supabase.functions.invoke<{ items: FoodProduct[] }>('food-search', {
    body,
    // 식품안전나라는 국내에서 부르는 편이 안전하므로 서울 리전에서 실행
    region: FunctionRegion.ApNortheast2,
  })
  if (error) throw error
  return data?.items ?? []
}

export const searchFoodByName = (q: string) => call({ q })
export const searchFoodByBarcode = (barcode: string) => call({ barcode })

const CATEGORY_RULES: [RegExp, string][] = [
  [/음료|주스|커피|다류|생수|탄산|두유/, 'drink'],
  [/빙과|아이스크림|냉동/, 'frozen'],
  [/우유|발효유|치즈|버터|유가공|유크림|요구르트/, 'dairy'],
  [/알가공|계란|달걀/, 'egg'],
  [/김치|절임|젓갈|조림|반찬/, 'side'],
  [/식육|햄|소시지|베이컨|육가공|양념육/, 'meat'],
  [/장류|간장|된장|고추장|소스|조미|양념|식초|드레싱|케첩|마요네즈|식용유|참기름|소금|설탕|당류/, 'sauce'],
  [/어육|어묵|수산|건포류/, 'seafood'],
  [/과일|과채가공/, 'fruit'],
]

/** 식품유형(예: "유탕면", "발효유")으로 앱의 분류를 추측. 모르면 가공식품 */
export function guessCategory(p: FoodProduct): string {
  const text = `${p.foodType ?? ''} ${p.name}`
  return CATEGORY_RULES.find(([re]) => re.test(text))?.[1] ?? 'processed'
}
