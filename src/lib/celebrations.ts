/**
 * 우리 집 생일·기념일. 그날(한국 시간) 냉장고 문에 가랜드와 축하 문구를 건다.
 * 써니사이드업 팀이 지선 님네 식구를 위해 넣은 날짜예요.
 */
export interface Celebration {
  id: string
  /** 'MM-DD' */
  date: string
  /** 큰 글씨 */
  title: string
  /** 작은 글씨 */
  message: string
  kind: 'birthday' | 'anniversary'
}

export const CELEBRATIONS: Celebration[] = [
  { id: 'jiseon', date: '09-04', kind: 'birthday', title: '지선 님, 생일 축하해요', message: '오늘 냉장고는 지선 님 거예요' },
  { id: 'minsang', date: '06-04', kind: 'birthday', title: '민상 님, 생일 축하해요', message: '케이크 자리 비워 뒀어요' },
  { id: 'saebyeol', date: '12-11', kind: 'birthday', title: '새별아, 생일 축하해', message: '반짝반짝 우리 새별이' },
  { id: 'saebom', date: '03-02', kind: 'birthday', title: '새봄아, 생일 축하해', message: '봄처럼 따뜻한 하루 보내' },
  { id: 'wedding', date: '12-26', kind: 'anniversary', title: '결혼기념일 축하해요', message: '오늘도 같은 냉장고를 나눠 써서 고마워요' },
  { id: 'met', date: '10-22', kind: 'anniversary', title: '처음 만난 날이에요', message: '그날부터 냉장고 하나를 둘이 채웠어요' },
]

const PREVIEW_KEY = 'fridge-celebrate-preview'

/** 한국 시간 오늘 'MM-DD' */
export function todayKST(now = Date.now()): string {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(5, 10)
}

/** 한국 시간 지금 몇 시 (0–23) */
export const hourKST = (now = Date.now()) => new Date(now + 9 * 3600 * 1000).getUTCHours()

/**
 * 오늘의 축하. 미리 보려면 주소에 ?celebrate=09-04 (이 탭에서만 기억, ?celebrate=off 로 끔)
 */
export function celebrationToday(now = Date.now()): Celebration | null {
  const q = new URLSearchParams(location.search).get('celebrate')
  if (q === 'off') sessionStorage.removeItem(PREVIEW_KEY)
  else if (q && /^\d\d-\d\d$/.test(q)) sessionStorage.setItem(PREVIEW_KEY, q)
  const date = sessionStorage.getItem(PREVIEW_KEY) ?? todayKST(now)
  return CELEBRATIONS.find((c) => c.date === date) ?? null
}

/** 가랜드 깃발 색 (메모 종이 토큰을 돌려 쓴다) */
export const BUNTING = ['note-yellow', 'note-pink', 'note-mint', 'note-sky'] as const
