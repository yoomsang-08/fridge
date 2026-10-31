import type { SupabaseClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState =
  /** 이 브라우저는 알림을 못 받음 */
  | 'unsupported'
  /** 아이폰은 홈 화면에 추가한 앱에서만 받을 수 있음 */
  | 'needs-install'
  /** 브라우저 설정에서 알림을 막아 둠 */
  | 'denied'
  | 'off'
  | 'on'

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function pushAvailable(): boolean {
  return !!VAPID_PUBLIC_KEY
}

export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** 알림 켜기: 권한을 묻고, 이 기기를 우리 집 알림 대상으로 등록 */
export async function enablePush(sb: SupabaseClient, householdId: string): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }))
  const json = sub.toJSON()
  const { error } = await sb.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    household_id: householdId,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  })
  if (error) {
    await sub.unsubscribe()
    throw error
  }
  return 'on'
}

export async function disablePush(sb: SupabaseClient): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
  return 'off'
}
