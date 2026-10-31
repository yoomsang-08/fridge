/** 이 기기 종류. 웹앱은 기기 고유 번호를 알 수 없어서, 식구 목록에서 알아보기 쉽게 종류만 남긴다 */
export function deviceLabel(ua = navigator.userAgent): string {
  if (/iPhone/.test(ua)) return '아이폰'
  if (/iPad/.test(ua)) return '아이패드'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? '안드로이드 폰' : '안드로이드 태블릿'
  // 아이패드 사파리는 데스크톱(Mac)으로 자신을 소개하는데, 터치가 되면 아이패드로 본다
  if (/Macintosh/.test(ua)) return navigator.maxTouchPoints > 1 ? '아이패드' : 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  if (/Linux/.test(ua)) return 'Linux PC'
  return '기기'
}

/** '오늘', '어제', '3일 전' */
export function seenLabel(iso: string | null): string {
  if (!iso) return '기록 없음'
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  return `${days}일 전`
}
