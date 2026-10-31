import { registerSW } from 'virtual:pwa-register'

// 새 버전이 배포되면 받아서 바로 새로고침해 적용.
// 홈 화면 앱은 오래 켜 두는 경우가 많아 앱으로 돌아올 때마다 업데이트를 확인한다.
export function setupPwa() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
    },
  })
}
