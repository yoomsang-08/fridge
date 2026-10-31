// 웹 푸시 공용 헬퍼. 알림을 보내는 함수는 모두 이걸 쓴다.
// 필요한 함수 Secret: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (GitHub Secret → supabase-functions 워크플로가 옮김)
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

export interface PushPayload {
  title: string
  body: string
  /** 눌렀을 때 열 앱 안 경로. 예: './?tab=list' */
  url?: string
  /** 같은 tag 알림은 새 것으로 바뀐다 */
  tag?: string
}

export interface PushTarget {
  /** 이 사람들(user_id)의 기기에만 */
  onlyUserIds?: string[]
  /** 이 이름(household_members.display_name)인 사람의 기기에만. 한 사람이 기기마다 다른 계정이라 이름으로 고른다 */
  onlyDisplayNames?: string[]
  /** 이 사람들(user_id)은 빼고. 보통 보낸 사람 자신 */
  excludeUserIds?: string[]
  /** 아침 기한 알림을 끈 기기는 빼기 */
  expiryDigestOnly?: boolean
}

let configured = false
function configure() {
  if (configured) return
  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!pub || !priv) throw new Error('VAPID keys missing')
  webpush.setVapidDetails('mailto:sunnyside-up@users.noreply.github.com', pub, priv)
  configured = true
}

/** service role 클라이언트. RLS 를 거치지 않으니 함수 안에서만 */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

/** 한 집의 기기들에 알림을 보낸다. 만료된 구독은 지운다. 보낸 기기 수를 돌려준다 */
export async function sendToHousehold(
  householdId: string,
  payload: PushPayload,
  target: PushTarget = {},
  sb: SupabaseClient = adminClient(),
): Promise<number> {
  configure()
  let q = sb.from('push_subscriptions').select('endpoint, user_id, p256dh, auth').eq('household_id', householdId)
  if (target.expiryDigestOnly) q = q.eq('expiry_digest', true)
  const { data: subs, error } = await q
  if (error) throw error

  let userIds: Set<string> | null = target.onlyUserIds ? new Set(target.onlyUserIds) : null
  if (target.onlyDisplayNames) {
    const { data: members } = await sb
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId)
      .in('display_name', target.onlyDisplayNames)
    const byName = new Set((members ?? []).map((m) => m.user_id as string))
    userIds = userIds ? new Set([...userIds].filter((u) => byName.has(u))) : byName
  }
  const excluded = new Set(target.excludeUserIds ?? [])
  const targets = (subs ?? []).filter((s) => (!userIds || userIds.has(s.user_id)) && !excluded.has(s.user_id))

  const body = JSON.stringify(payload)
  let sent = 0
  await Promise.all(
    targets.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 60 * 12,
        })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // 앱을 지웠거나 알림을 끈 기기
        if (status === 404 || status === 410) await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        else console.error('push failed', status, (e as Error).message)
      }
    }),
  )
  return sent
}
