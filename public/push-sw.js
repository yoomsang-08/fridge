// 웹 푸시 수신. vite-plugin-pwa 가 만든 서비스워커에 importScripts 로 붙는다.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data && event.data.text() }
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title || '냉장고를 부탁해', {
      body: data.body || '',
      tag: data.tag,
      icon: scope + 'pwa-192.png',
      badge: scope + 'pwa-192.png',
      data: { url: new URL(data.url || './', scope).href },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope))
      if (open) {
        open.navigate(url)
        return open.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
