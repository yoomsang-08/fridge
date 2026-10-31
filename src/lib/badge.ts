/**
 * 홈 화면 앱 아이콘의 숫자 배지 (Badging API).
 * 아이폰: iOS 16.4+ 홈 화면에 추가한 앱 + 알림 허용일 때만. 안드로이드 크롬은 숫자 대신 알림 점만.
 * PC(크롬·엣지 설치 앱)는 숫자가 보인다. 지원하지 않는 곳에서는 아무 일도 하지 않는다.
 */
export function setAppBadge(count: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  const p = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.()
  p?.catch(() => {})
}
