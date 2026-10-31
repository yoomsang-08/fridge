// 식품 검색 프록시 (Supabase Edge Function, Deno)
//
// 브라우저에서 식품안전나라 Open API 를 바로 부르지 않는 이유:
//  - 인증키가 앱 코드에 그대로 노출된다
//  - http 로만 열려 있어(https 는 403, 2026-10 확인) https 페이지에서 mixed content 로 막힌다
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

// https 는 403 을 돌려주므로 http 만 쓴다
const FOODSAFETY_BASE = 'http://openapi.foodsafetykorea.go.kr'

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

  let res: Response
  try {
    res = await fetch(FOODSAFETY_BASE + path, { signal: AbortSignal.timeout(8000) })
  } catch (e) {
    throw new UpstreamError(`식품안전나라 연결 실패: ${String(e)}`, 'NETWORK')
  }
  if (!res.ok) throw new UpstreamError(`식품안전나라 응답 ${res.status}`, 'HTTP')
  const body = await res.json()
  const data = body[service]
  // 키가 틀리면 서비스 이름 대신 RESULT 만 온다
  const result = data?.RESULT ?? body.RESULT
  const code: string | undefined = result?.CODE
  if (code === 'INFO-200') return [] // 해당하는 데이터가 없습니다
  // INFO-110: 키는 맞지만 이 서비스를 활용신청하지 않음 (서비스마다 따로 신청해야 한다)
  if (code && code !== 'INFO-000') throw new UpstreamError(result?.MSG ?? code, code)
  return (data?.row ?? []) as Row[]
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

/**
 * I1250 은 부분 일치로 찾고 순서가 제멋대로라 ("신라면" → 144건, 수출용 스프 원료가 먼저 나옴)
 * 넉넉히 받아서 장바구니에 있을 법한 제품이 먼저 오도록 점수를 매긴다.
 */
function rank(q: string, r: Row): number {
  const name = (r.PRDLST_NM ?? '').replace(/\s+/g, '')
  const term = q.replace(/\s+/g, '')
  let score = 0
  if (name === term) score += 100
  else if (name.startsWith(term)) score += 50
  if (r.PRODUCTION === '아니오') score -= 30 // 생산 중단
  if (/수출|원료|스프|분말|혼합/.test(name)) score -= 40 // 업체용 원료, 수출품
  if (/복합조미식품|식품첨가물/.test(r.PRDLST_DCNM ?? '')) score -= 20
  score -= name.length / 10 // 비슷하면 짧은 이름이 먼저
  return score
}

async function searchByName(q: string, size: number): Promise<FoodProduct[]> {
  const rows = await foodsafety('I1250', { PRDLST_NM: q }, 200)
  return rows
    .map((r) => ({ r, score: rank(q, r) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, size)
    .map(({ r }) => fromFoodsafety('I1250', r))
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
  // C005 가 안 되더라도(키 없음, 활용신청 안 함, 장애) Open Food Facts 로 넘어간다
  const rows = await foodsafety('C005', { BAR_CD: barcode }, 5).catch((e) => {
    console.warn('C005 실패', e instanceof UpstreamError ? e.code : '', String(e))
    return [] as Row[]
  })
  if (rows.length > 0) {
    // 같은 바코드가 공장마다 따로 보고되어 여러 건 나온다 (신라면 4건).
    // 생산 중이고 폐업하지 않은 것을 먼저, 이름이 같으면 하나만 남긴다.
    const live = (r: Row) => Number(!r.END_DT) + Number(!r.CLSBIZ_DT)
    const seen = new Set<string>()
    return rows
      .sort((a, b) => live(b) - live(a))
      .map((r) => fromFoodsafety('C005', r))
      .filter((p) => {
        const k = p.name.replace(/[\s()辛]/g, '')
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
  }
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
