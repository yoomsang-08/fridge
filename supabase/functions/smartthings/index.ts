// 스마트싱스 냉장고 프록시.
// 토큰은 smartthings_links 테이블(service role 전용)에만 두고, 앱에는 필요한 값만 정리해서 내려준다.
// 호출한 사람이 그 집(household) 구성원인지 먼저 확인한다.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { findRefrigerator, toFridgeState, toSmartThingsCommand } from './fridge.ts'

const API = 'https://api.smartthings.com/v1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** 앱이 문구를 고를 수 있도록 오류는 코드로 돌려준다 */
const fail = (code: string, status = 400) => reply({ error: code }, status)

async function st(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  if (res.status === 401) throw new StError('token_invalid', 401)
  if (res.status === 403) throw new StError('token_scope', 403)
  if (res.status === 429) throw new StError('rate_limited', 429)
  if (!res.ok) throw new StError('smartthings_error', 502)
  return res.json()
}

class StError extends Error {
  constructor(public code: string, public status: number) {
    super(code)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('method_not_allowed', 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let body: { action?: string; household_id?: string; token?: string; command?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail('bad_request')
  }
  const hid = body.household_id
  if (!hid) return fail('bad_request')

  const { data: member } = await user.rpc('is_member', { hid })
  if (member !== true) return fail('forbidden', 403)

  try {
    if (body.action === 'connect') {
      const token = body.token?.trim()
      if (!token) return fail('bad_request')
      const list = await st(token, '/devices')
      const fridge = findRefrigerator(list.items ?? [])
      if (!fridge) return fail('no_refrigerator', 404)
      const { error } = await admin.from('smartthings_links').upsert({
        household_id: hid,
        access_token: token,
        device_id: fridge.deviceId,
        device_label: fridge.label,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      return reply({ ok: true, label: fridge.label })
    }

    if (body.action === 'disconnect') {
      await admin.from('smartthings_links').delete().eq('household_id', hid)
      return reply({ ok: true })
    }

    const { data: link } = await admin
      .from('smartthings_links')
      .select('access_token, device_id, device_label, updated_at')
      .eq('household_id', hid)
      .maybeSingle()
    if (!link) return reply({ connected: false })

    const status = await st(link.access_token, `/devices/${link.device_id}/status`)
    const state = toFridgeState(status, link.device_label ?? '냉장고')

    if (body.action === 'status') {
      return reply({ connected: true, linkedAt: link.updated_at, state })
    }

    if (body.action === 'command') {
      const command = toSmartThingsCommand(body.command, state)
      if (!command) return fail('command_not_allowed')
      await st(link.access_token, `/devices/${link.device_id}/commands`, {
        method: 'POST',
        body: JSON.stringify({ commands: [command] }),
      })
      return reply({ ok: true })
    }

    return fail('bad_request')
  } catch (e) {
    if (e instanceof StError) return fail(e.code, e.status)
    console.error(e)
    return fail('server_error', 500)
  }
})
