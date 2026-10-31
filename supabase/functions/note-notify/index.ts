// 메모 해시태그 알림. 메모에 #지선 처럼 식구 이름을 붙이면 그 사람 기기로 푸시를 보낸다.
// #모두 / #다같이 는 나를 뺀 식구 모두에게.
// 앱이 메모를 붙인 직후 { note_id } 로 부른다. 로그인 토큰으로 부른 사람을 확인한다.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { adminClient, sendToHousehold } from '../_shared/push.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** 앱의 src/lib/notes.ts hashtagsOf 와 같은 규칙 */
const TAG = /#([0-9A-Za-z가-힣_]+)/g
const EVERYONE = new Set(['모두', '다같이', '다들'])
export const hashtagsOf = (body: string) => [...new Set([...body.matchAll(TAG)].map((m) => m[1]))]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405)

  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: auth } = await user.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return reply({ error: 'unauthorized' }, 401)

  let noteId: string | undefined
  try {
    noteId = (await req.json()).note_id
  } catch {
    // 아래에서 처리
  }
  if (!noteId) return reply({ error: 'bad_request' }, 400)

  // RLS 를 거쳐 읽으니 같은 집 식구만 읽힌다. 내가 방금 붙인 메모만 알림을 보낸다
  const { data: note } = await user
    .from('notes')
    .select('id, household_id, body, author_id, author_name, created_at')
    .eq('id', noteId)
    .maybeSingle()
  if (!note || note.author_id !== uid) return reply({ error: 'forbidden' }, 403)
  if (Date.now() - new Date(note.created_at).getTime() > 10 * 60 * 1000) return reply({ sent: 0 })

  const tags = hashtagsOf(note.body)
  if (tags.length === 0) return reply({ sent: 0 })

  const sb = adminClient()
  const { data: members } = await sb.from('household_members').select('display_name').eq('household_id', note.household_id)
  const names = new Set((members ?? []).map((m) => m.display_name as string | null).filter((n): n is string => !!n))
  const others = [...names].filter((n) => n !== note.author_name)
  const targets = tags.some((t) => EVERYONE.has(t)) ? others : tags.filter((t) => names.has(t) && t !== note.author_name)
  if (targets.length === 0) return reply({ sent: 0 })

  // 받는 쪽 앱 아이콘 숫자: 이 사람이 붙인 안 읽은 메모 + 3일 안에 챙길 식품 (앱의 배지와 같은 기준)
  const soon = new Date(Date.now() + (9 + 72) * 3600 * 1000).toISOString().slice(0, 10)
  const [{ count: notes }, { count: items }] = await Promise.all([
    sb.from('notes').select('id', { count: 'exact', head: true })
      .eq('household_id', note.household_id).eq('author_name', note.author_name ?? '').is('read_at', null),
    sb.from('items').select('id', { count: 'exact', head: true })
      .eq('household_id', note.household_id).eq('status', 'active').lte('expiry_date', soon),
  ])

  const sent = await sendToHousehold(
    note.household_id,
    {
      title: `${note.author_name ?? '식구'}님이 냉장고에 메모를 붙였어요`,
      body: note.body,
      url: './?tab=notes',
      tag: `note-${note.id}`,
      badge: (notes ?? 1) + (items ?? 0),
    },
    // 이름으로 골라서, 같은 이름을 쓰는 내 다른 기기에는 가지 않는다
    { onlyDisplayNames: targets, excludeUserIds: [uid] },
    sb,
  )
  return reply({ sent })
})
