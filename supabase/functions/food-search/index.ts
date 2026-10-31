// 식품 검색 프록시 (Supabase Edge Function, Deno)
//
// 브라우저에서 식품안전나라 Open API 를 바로 부르지 않는 이유:
//  - 인증키가 앱 코드에 그대로 노출된다
//  - CORS 허용 헤더가 없고, http 주소는 https 페이지에서 mixed content 로 막힌다
//
// GET /functions/v1/food-search?q=신라면        제품명 검색 (품목제조보고 I1250)
// GET /functions/v1/food-search?barcode=880...  바코드 조회 (바코드연계제품정보 C005 → Open Food Facts)
//
// 필요한 secret: FOODSAFETY_API_KEY (식품안전나라 인증키)

import { parseShelfLifeDays } from '../_shared/shelfLife.ts'

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const FOODSAFETY_HOSTS = ['https://openapi.foodsafetykorea.go.kr', 'http://openapi.foodsafetykorea.go.kr']

type Row = Record<string, string | null | undefined>

class UpstreamError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
  }
}

/** 식품안전나라 Open API 호출. 데이터가 없으면 빈 배열 */
async function foodsafety(service: string, params: Record<string, string>, size: number): Promise<Row[]> {
  const key = Deno.env.get('FOODSAFETY_API_KEY')
  if (!key) throw new UpstreamError('FOODSAFETY_API_KEY 가 설정되지 않았습니다', 'NO_KEY')

  const filters = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const path = `/api/${key}/${service}/json/1/${size}${filters ? `/${filters}` : ''}`

  let lastError: unknown
  for (const host of FOODSAFETY_HOSTS) {
    try {
      const res = await fetch(host + path, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new UpstreamError(`식품안전나라 응답 ${res.status}`)
      const body = await res.json()
      const data = body[service]
      // 키가 틀리면 서비스 이름 대신 RESULT 만 온다
      const result = data?.RESULT ?? body.RESULT
      const code: string | undefined = result?.CODE
      if (code === 'INFO-200') return [] // 해당하는 데이터가 없습니다
      if (code && code !== 'INFO-000') throw new UpstreamError(result?.MSG ?? code, code)
      return (data?.row ?? []) as Row[]
    } catch (e) {
      // 응답을 받았는데 거절된 경우(키 오류 등)는 http 로 다시 시도해도 같다
      if (e instanceof UpstreamError) throw e
      lastError = e
    }
  }
  throw new UpstreamError(`식품안전나라 연결 실패: ${String(lastError)}`, 'NETWORK')
}

function fromFoodsafety(source: 'I1250' | 'C005', r: Row): FoodProduct {
  const shelfLifeText = r.POG_DAYCNT?.trim() || null
  return {
    source,
    name: (r.PRDLST_NM ?? '').trim(),
    maker: r.BSSH_NM?.trim() || null,
    foodType: r.PRDLST_DCNM?.trim() || null,
    shelfLifeText,
    shelfLifeDays: parseShelfLifeDays(shelfLifeText),
    reportNo: r.PRDLST_REPORT_NO?.trim() || null,
    barcode: r.BAR_CD?.trim() || null,
  }
}

async function searchByName(q: string, size: number): Promise<FoodProduct[]> {
  const rows = await foodsafety('I1250', { PRDLST_NM: q }, size)
  // 생산 종료된 품목은 뒤로
  return rows
    .map((r) => ({ p: fromFoodsafety('I1250', r), ended: r.PRODUCTION === '아니오' }))
    .sort((a, b) => Number(a.ended) - Number(b.ended))
    .map((x) => x.p)
}

async function openFoodFacts(barcode: string): Promise<FoodProduct | null> {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json` +
    '?fields=product_name,product_name_ko,brands,quantity,categories'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'fridge-app/0.1 (https://github.com/yoomsang-08/fridge)' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const body = await res.json()
  const p = body.status === 1 ? body.product : null
  const name = p?.product_name_ko || p?.product_name
  if (!name) return null
  return {
    source: 'openfoodfacts',
    name: p.quantity ? `${name} ${p.quantity}` : name,
    maker: p.brands || null,
    foodType: null,
    shelfLifeText: null,
    shelfLifeDays: null,
    reportNo: null,
    barcode,
  }
}

async function searchByBarcode(barcode: string): Promise<FoodProduct[]> {
  const rows = await foodsafety('C005', { BAR_CD: barcode }, 5).catch((e) => {
    // 키가 없어도 Open Food Facts 는 쓸 수 있게
    if (e instanceof UpstreamError && e.code === 'NO_KEY') return [] as Row[]
    throw e
  })
  if (rows.length > 0) return rows.map((r) => fromFoodsafety('C005', r))
  const off = await openFoodFacts(barcode).catch(() => null)
  return off ? [off] : []
}

function json(body: unknown, status = 200, cache = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      ...(cache ? { 'Cache-Control': 'public, max-age=86400' } : {}),
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  let q = url.searchParams.get('q')
  let barcode = url.searchParams.get('barcode')
  if (req.method === 'POST') {
    // supabase.functions.invoke 는 body 로 보낸다
    const body = await req.json().catch(() => ({}))
    q ??= body.q ?? null
    barcode ??= body.barcode ?? null
  }

  try {
    if (barcode) {
      const digits = barcode.replace(/\D/g, '')
      if (digits.length < 8 || digits.length > 14) return json({ error: '바코드는 8~14자리 숫자입니다' }, 400)
      return json({ items: await searchByBarcode(digits) }, 200, true)
    }
    const term = q?.trim() ?? ''
    if (term.length < 2) return json({ error: '검색어를 2글자 이상 입력하세요' }, 400)
    return json({ items: await searchByName(term, 20) }, 200, true)
  } catch (e) {
    const code = e instanceof UpstreamError ? e.code : undefined
    return json({ error: e instanceof Error ? e.message : String(e), code }, 502)
  }
})
