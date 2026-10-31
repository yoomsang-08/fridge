/**
 * 품목제조보고의 소비기한(POG_DAYCNT)은 자유 입력 문구라 형식이 제각각이다.
 * 예: "제조일로부터 12개월", "1년", "90일", "제조일로부터 18개월까지", "별도표시"
 * 숫자로 읽을 수 있는 경우에만 일수로 바꾸고, 나머지는 null (원문은 따로 보여준다).
 */
export function parseShelfLifeDays(text: string | null | undefined): number | null {
  if (!text) return null
  const s = text.replace(/\s+/g, '')
  const m = s.match(/(\d+(?:\.\d+)?)(년|개월|월|주|일|시간)/)
  if (!m) {
    // 숫자만 적힌 경우는 일수로 본다
    return /^\d+$/.test(s) ? Number(s) : null
  }
  const n = Number(m[1])
  switch (m[2]) {
    case '년':
      return Math.round(n * 365)
    case '개월':
    case '월':
      return Math.round((n * 365) / 12)
    case '주':
      return Math.round(n * 7)
    case '일':
      return Math.round(n)
    case '시간':
      return Math.max(1, Math.round(n / 24))
  }
  return null
}
