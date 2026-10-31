// 매일 아침 기한 임박 알림. GitHub Actions(expiry-digest.yml)가 매시 부르고,
// 그 시각(한국 시간)을 고른 기기에만 보낸다. { all: true } 로 부르면 시각과 상관없이 모두에게(시험용).
// 브라우저에서 부르는 함수가 아니라 JWT 대신 CRON_SECRET 으로 확인한다.
import { adminClient, sendToHousehold } from '../_shared/push.ts'

interface Row {
  household_id: string
  name: string
  expiry_date: string
}

/** 한국 날짜 기준 오늘 + n일 (YYYY-MM-DD) */
function kstDate(addDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000 + addDays * 86400 * 1000)
  return d.toISOString().slice(0, 10)
}

const kstHour = () => new Date(Date.now() + 9 * 3600 * 1000).getUTCHours()

function listNames(rows: Row[], max = 3): string {
  const names = rows.slice(0, max).map((r) => r.name)
  return rows.length > max ? `${names.join(', ')} 외 ${rows.length - max}개` : names.join(', ')
}

/** 알림 한 장 문구. 챙길 게 없으면 null */
export function digestMessage(rows: Row[], today: string): { title: string; body: string } | null {
  const expired = rows.filter((r) => r.expiry_date < today)
  const todayRows = rows.filter((r) => r.expiry_date === today)
  const soon = rows.filter((r) => r.expiry_date > today)
  if (!expired.length && !todayRows.length && !soon.length) return null

  const parts: string[] = []
  if (todayRows.length) parts.push(`오늘까지 ${todayRows.length}개`)
  if (soon.length) parts.push(`3일 안에 ${soon.length}개`)
  if (expired.length) parts.push(`기한 지남 ${expired.length}개`)
  const first = [...todayRows, ...soon, ...expired]
  return { title: `먼저 먹을 것: ${parts.join(' · ')}`, body: listNames(first) }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 })

  let all = false
  try {
    all = (await req.json())?.all === true
  } catch {
    // 본문 없음 = 예약 실행
  }
  const hour = all ? undefined : kstHour()

  const sb = adminClient()
  // 이 시각에 받을 기기가 있는 집만
  let subs = sb.from('push_subscriptions').select('household_id').eq('expiry_digest', true)
  if (hour !== undefined) subs = subs.eq('digest_hour', hour)
  const { data: subRows, error: subError } = await subs
  if (subError) return new Response(subError.message, { status: 500 })
  const households = [...new Set((subRows ?? []).map((r) => r.household_id as string))]
  if (!households.length) return Response.json({ hour, households: 0, sent: 0 })

  const today = kstDate()
  const { data, error } = await sb
    .from('items')
    .select('household_id, name, expiry_date')
    .in('household_id', households)
    .eq('status', 'active')
    .not('expiry_date', 'is', null)
    .lte('expiry_date', kstDate(3))
    .order('expiry_date')
  if (error) return new Response(error.message, { status: 500 })

  const byHousehold = new Map<string, Row[]>()
  for (const r of data as Row[]) byHousehold.set(r.household_id, [...(byHousehold.get(r.household_id) ?? []), r])

  let sent = 0
  for (const [hid, rows] of byHousehold) {
    const msg = digestMessage(rows, today)
    if (!msg) continue
    sent += await sendToHousehold(hid, { ...msg, url: './', tag: 'expiry-digest' }, { expiryDigestOnly: true, digestHour: hour }, sb)
  }
  return Response.json({ hour, households: byHousehold.size, sent })
})
