// 앱이 알림을 켤 때 부른다: 푸시 공개키를 돌려준다(처음이면 키를 만든다).
// 로그인(익명 포함)한 기기만 부를 수 있게 기본 JWT 확인을 그대로 둔다.
import { ensureVapid } from '../_shared/push.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const publicKey = await ensureVapid()
    return Response.json({ publicKey }, { headers: cors })
  } catch (e) {
    console.error(e)
    return Response.json({ error: 'push_unavailable' }, { status: 500, headers: cors })
  }
})
