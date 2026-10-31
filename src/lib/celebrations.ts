/**
 * 우리 집 생일·기념일과 명절·공휴일. 그날(한국 시간) 냉장고 문에 가랜드와 문구를 걸고,
 * 문에 붙은 메모의 동그란 자석을 그날의 자석으로 바꿔 단다.
 * 써니사이드업 팀이 지선 님네 식구를 위해 넣은 날짜예요.
 */
import type { ArtMagnet, MagnetKind } from './magnets'

export interface Celebration {
  id: string
  /** 큰 글씨 */
  title: string
  /** 작은 글씨 */
  message: string
  kind: 'birthday' | 'anniversary' | 'holiday' | 'flag'
  /** 가랜드에 매다는 장식. 없으면 색 깃발 */
  charms?: ArtMagnet[]
  /** 그날 메모의 기본 자석 */
  magnet?: MagnetKind
  /** false 면 가랜드·문구 없이 자석만 (국경일) */
  banner?: boolean
  /** 가랜드 둘레에 작은 눈송이 */
  snow?: boolean
}

type Family = Celebration & { date: string }

export const CELEBRATIONS: Family[] = [
  { id: 'jiseon', date: '09-04', kind: 'birthday', title: '지선 님, 생일 축하해요', message: '오늘 냉장고는 지선 님 거예요' },
  { id: 'minsang', date: '06-04', kind: 'birthday', title: '민상 님, 생일 축하해요', message: '케이크 자리 비워 뒀어요' },
  { id: 'saebyeol', date: '12-11', kind: 'birthday', title: '새별아, 생일 축하해', message: '반짝반짝 우리 새별이' },
  { id: 'saebom', date: '03-02', kind: 'birthday', title: '새봄아, 생일 축하해', message: '봄처럼 따뜻한 하루 보내' },
  { id: 'wedding', date: '12-26', kind: 'anniversary', title: '결혼기념일 축하해요', message: '오늘도 같은 냉장고를 나눠 써서 고마워요' },
  { id: 'met', date: '10-22', kind: 'anniversary', title: '처음 만난 날이에요', message: '그날부터 냉장고 하나를 둘이 채웠어요' },
]

const H = (c: Omit<Celebration, 'kind'>): Celebration => ({ kind: 'holiday', magnet: c.charms?.[0], ...c })
/** 국경일: 가랜드·축하 없이 태극기 자석과 담담한 한 줄만. 현충일처럼 추모하는 날은 넣지 않는다 */
const FLAG = (id: string, name: string): Celebration => ({ id, title: `오늘은 ${name}이에요`, message: '', kind: 'flag', magnet: 'flag', banner: false })

export const HOLIDAYS = {
  seollal: H({ id: 'seollal', title: '새해 복 많이 받으세요', message: '떡국 재료는 챙기셨나요', charms: ['pouch'] }),
  chuseok: H({ id: 'chuseok', title: '풍성한 한가위 보내세요', message: '냉장고도 꽉 찼어요', charms: ['songpyeon', 'fullmoon'] }),
  christmas: H({ id: 'christmas', title: '메리 크리스마스', message: '케이크 자리 비워 뒀어요', charms: ['tree', 'sparkle'], snow: true }),
  newyear: H({ id: 'newyear', title: '새해에도 냉장고를 부탁해요', message: '올해도 맛있게 채워 봐요', charms: ['sparkle'] }),
  children: H({ id: 'children', title: '새별아 새봄아, 어린이날 축하해', message: '오늘은 간식 한 개 더', charms: ['balloon'] }),
  halloween: H({ id: 'halloween', title: '해피 할로윈', message: '냉장고에 사탕 숨겨 뒀어요', charms: ['pumpkin'] }),
  parents: H({ id: 'parents', title: '어버이날이에요', message: '오늘은 부모님께 전화 한 통', charms: ['carnation'] }),
  pepero: H({ id: 'pepero', title: '빼빼로데이', message: '오늘은 하나씩 나눠 먹기', charms: ['stick'] }),
  dongji: H({ id: 'dongji', title: '오늘은 동지예요', message: '팥죽 한 그릇 어때요', charms: ['redbean'] }),
  bok: H({ id: 'bok', title: '오늘은 복날', message: '보양식 챙겨요', charms: ['samgye'] }),
  boreum: H({ id: 'boreum', title: '정월대보름이에요', message: '부럼 깨셨나요', charms: ['nut', 'fullmoon'] }),
  samil: FLAG('samil', '삼일절'),
  liberation: FLAG('liberation', '광복절'),
  gaecheon: FLAG('gaecheon', '개천절'),
  hangul: FLAG('hangul', '한글날'),
} satisfies Record<string, Celebration>

/** 해마다 바뀌는 날 (설·대보름·추석은 음력, 동지·복날은 절기). 2026–2035, 한국 시간 'MM-DD' */
const MOVABLE: Record<number, { seol: string; boreum: string; chuseok: string; dongji: string; bok: string[] }> = {
  2026: { seol: '02-17', boreum: '03-03', chuseok: '09-25', dongji: '12-22', bok: ['07-15', '07-25', '08-14'] },
  2027: { seol: '02-07', boreum: '02-21', chuseok: '09-15', dongji: '12-22', bok: ['07-20', '07-30', '08-09'] },
  2028: { seol: '01-27', boreum: '02-10', chuseok: '10-03', dongji: '12-21', bok: ['07-14', '07-24', '08-13'] },
  2029: { seol: '02-13', boreum: '02-27', chuseok: '09-22', dongji: '12-21', bok: ['07-19', '07-29', '08-08'] },
  2030: { seol: '02-03', boreum: '02-17', chuseok: '09-12', dongji: '12-22', bok: ['07-14', '07-24', '08-13'] },
  2031: { seol: '01-23', boreum: '02-06', chuseok: '10-01', dongji: '12-22', bok: ['07-19', '07-29', '08-08'] },
  2032: { seol: '02-11', boreum: '02-25', chuseok: '09-19', dongji: '12-21', bok: ['07-13', '07-23', '08-12'] },
  2033: { seol: '01-31', boreum: '02-14', chuseok: '09-08', dongji: '12-21', bok: ['07-18', '07-28', '08-07'] },
  2034: { seol: '02-19', boreum: '03-05', chuseok: '09-27', dongji: '12-22', bok: ['07-13', '07-23', '08-12'] },
  2035: { seol: '02-08', boreum: '02-22', chuseok: '09-16', dongji: '12-22', bok: ['07-18', '07-28', '08-17'] },
}

const FIXED: Record<string, Celebration> = {
  '01-01': HOLIDAYS.newyear,
  '03-01': HOLIDAYS.samil,
  '05-05': HOLIDAYS.children,
  '05-08': HOLIDAYS.parents,
  '08-15': HOLIDAYS.liberation,
  '10-03': HOLIDAYS.gaecheon,
  '10-09': HOLIDAYS.hangul,
  '10-31': HOLIDAYS.halloween,
  '11-11': HOLIDAYS.pepero,
  '12-24': HOLIDAYS.christmas,
  '12-25': HOLIDAYS.christmas,
}

/** 'YYYY-MM-DD' 에서 n 일 뒤의 'MM-DD' */
const shift = (ymd: string, n: number) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 864e5).toISOString().slice(5, 10)

/** 그날의 축하. 우리 집 날 > 설·추석(연휴 사흘) > 그 밖의 명절 > 국경일 */
export function celebrationOn(ymd: string): Celebration | null {
  const md = ymd.slice(5)
  const family = CELEBRATIONS.find((c) => c.date === md)
  if (family) return family
  const m = MOVABLE[Number(ymd.slice(0, 4))]
  if (m) {
    // 연휴 사흘: 전날·당일·다음날이 그날이면 오늘이 연휴
    const around = (d: string) => [-1, 0, 1].some((n) => shift(ymd, n) === d)
    if (around(m.seol)) return HOLIDAYS.seollal
    if (around(m.chuseok)) return HOLIDAYS.chuseok
  }
  const fixed = FIXED[md]
  if (fixed && fixed.kind !== 'flag') return fixed
  if (m) {
    if (md === m.boreum) return HOLIDAYS.boreum
    if (md === m.dongji) return HOLIDAYS.dongji
    const b = m.bok.indexOf(md)
    if (b >= 0) return { ...HOLIDAYS.bok, title: `오늘은 ${['초복', '중복', '말복'][b]}` }
  }
  return fixed ?? null
}

const PREVIEW_KEY = 'fridge-celebrate-preview'

/** 한국 시간 오늘 'YYYY-MM-DD' */
export const ymdKST = (now = Date.now()) => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10)

/** 한국 시간 오늘 'MM-DD' */
export const todayKST = (now = Date.now()) => ymdKST(now).slice(5)

/** 한국 시간 지금 몇 시 (0–23) */
export const hourKST = (now = Date.now()) => new Date(now + 9 * 3600 * 1000).getUTCHours()

/** 한국 시간 요일 (0 = 일요일) */
export const weekdayKST = (now = Date.now()) => new Date(now + 9 * 3600 * 1000).getUTCDay()

/**
 * 오늘의 축하. 미리 보려면 주소에 ?celebrate=09-04 또는 ?celebrate=2027-02-07
 * (이 탭에서만 기억, ?celebrate=off 로 끔)
 */
export function celebrationToday(now = Date.now()): Celebration | null {
  const q = new URLSearchParams(location.search).get('celebrate')
  if (q === 'off') sessionStorage.removeItem(PREVIEW_KEY)
  else if (q && /^(\d{4}-)?\d\d-\d\d$/.test(q)) sessionStorage.setItem(PREVIEW_KEY, q)
  const today = ymdKST(now)
  const p = sessionStorage.getItem(PREVIEW_KEY)
  const ymd = p ? (p.length === 5 ? `${today.slice(0, 4)}-${p}` : p) : today
  return celebrationOn(ymd)
}

/** 오늘 메모에 달 자석 (없으면 기본 동그라미) */
export const todaysMagnet = (): MagnetKind | undefined => celebrationToday()?.magnet

/** 가랜드 깃발 색 (메모 종이 토큰을 돌려 쓴다) */
export const BUNTING = ['note-yellow', 'note-pink', 'note-mint', 'note-sky'] as const
