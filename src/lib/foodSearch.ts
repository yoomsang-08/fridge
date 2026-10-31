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
