// 스마트싱스 냉장고 프록시.
// 토큰은 smartthings_links 테이블(service role 전용)에만 두고, 앱에는 필요한 값만 정리해서 내려준다.
// POST: 앱에서 부르는 동작. 호출한 사람이 그 집(household) 구성원인지 먼저 확인한다.
// GET:  삼성 계정 로그인(OAuth)이 끝나고 스마트싱스가 돌려보내는 곳. 그래서 이 함수는 verify_jwt 를 끄고 배포한다.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { findRefrigerator, toFridgeState, toSmartThingsCommand } from './fridge.ts'

const API = 'https://api.smartthings.com/v1'
const OAUTH = 'https://api.smartthings.com/oauth'
const SCOPES = 'r:devices:* x:devices:*'
/** 로그인 시작부터 돌아올 때까지 허용하는 시간 */
const STATE_TTL_MS = 10 * 60_000
/** 만료 이만큼 전이면 미리 갱신한다 */
const REFRESH_EARLY_MS = 5 * 60_000

// 복사해 붙일 때 딸려 온 공백·줄바꿈은 지운다
const CLIENT_ID = (Deno.env.get('SMARTTHINGS_CLIENT_ID') ?? '').trim()
const CLIENT_SECRET = (Deno.env.get('SMARTTHINGS_CLIENT_SECRET') ?? '').trim()
const APP_URL = Deno.env.get('APP_URL') ?? 'https://yoomsang-08.github.io/fridge/'
const oauthReady = () => !!(CLIENT_ID && CLIENT_SECRET)
const redirectUri = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/smartthings`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** 앱이 문구를 고를 수 있도록 오류는 코드로 돌려준다 */
const fail = (code: string, status = 400) => reply({ error: code }, status)

class StError extends Error {
  constructor(public code: string, public status: number) {
    super(code)
  }
}

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

interface Link {
  household_id: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  device_id: string
  device_label: string | null
  updated_at: string
}

/** 인가 코드나 갱신 토큰으로 새 토큰을 받는다 */
async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  })
  if (!res.ok) throw new StError('token_invalid', 401)
  const t = await res.json()
  return {
    access_token: t.access_token as string,
    refresh_token: t.refresh_token as string,
    expires_at: new Date(Date.now() + (t.expires_in ?? 86400) * 1000).toISOString(),
  }
}

/**
 * 쓸 수 있는 접근 토큰을 돌려준다. OAuth 로 연결했으면 만료 전에 갱신해서 저장한다.
 * 갱신 토큰은 한 번 쓰면 바뀌므로, 다른 기기가 먼저 갱신했으면 그 값을 다시 읽어 쓴다.
 */
async function accessToken(admin: SupabaseClient, link: Link, force = false): Promise<string> {
  if (!link.refresh_token || !link.expires_at) return link.access_token
  if (!force && Date.parse(link.expires_at) - Date.now() > REFRESH_EARLY_MS) return link.access_token
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: link.refresh_token })
    await admin
      .from('smartthings_links')
      .update({ ...t, updated_at: new Date().toISOString() })
      .eq('household_id', link.household_id)
      .eq('refresh_token', link.refresh_token)
    return t.access_token
  } catch (e) {
    const { data } = await admin.from('smartthings_links').select('*').eq('household_id', link.household_id).maybeSingle()
    if (data && data.refresh_token !== link.refresh_token) return data.access_token
    throw e
  }
}

/** 로그인 후 돌아오는 곳: 코드를 토큰으로 바꾸고 냉장고를 찾아 저장한 뒤 앱으로 돌려보낸다 */
async function oauthCallback(req: Request, admin: SupabaseClient) {
  const q = new URL(req.url).searchParams
  const back = (result: string) => Response.redirect(`${APP_URL}?smartthings=${result}`, 302)
  const state = q.get('state')
  const code = q.get('code')
  if (!state || !code) return back('cancelled')

  const { data: pending } = await admin.from('smartthings_oauth_states').select('*').eq('state', state).maybeSingle()
  await admin.from('smartthings_oauth_states').delete().eq('state', state)
  if (!pending || Date.now() - Date.parse(pending.created_at) > STATE_TTL_MS) return back('expired')

  try {
    const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() })
    const list = await st(t.access_token, '/devices')
    const fridge = findRefrigerator(list.items ?? [])
    if (!fridge) return back('no_refrigerator')
    const { error } = await admin.from('smartthings_links').upsert({
      household_id: pending.household_id,
      ...t,
      device_id: fridge.deviceId,
      device_label: fridge.label,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    return back('connected')
  } catch (e) {
    console.error(e)
    return back('failed')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  if (req.method === 'GET') return oauthCallback(req, admin)
  if (req.method !== 'POST') return fail('method_not_allowed', 405)

  let body: { action?: string; household_id?: string; token?: string; command?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail('bad_request')
  }

  // 주간 작업(GitHub Actions): 오래 안 열어도 갱신 토큰(29일)이 끊기지 않게 미리 갱신
  if (body.action === 'keepalive') {
    if (!oauthReady() || req.headers.get('x-keepalive') !== CLIENT_SECRET) return fail('forbidden', 403)
    const { data: links } = await admin.from('smartthings_links').select('*').not('refresh_token', 'is', null)
    let ok = 0
    for (const link of (links ?? []) as Link[]) {
      try {
        await accessToken(admin, link, true)
        ok++
      } catch (e) {
        console.error('keepalive', link.household_id, e)
      }
    }
    return reply({ ok, total: links?.length ?? 0 })
  }

  const hid = body.household_id
  if (!hid) return fail('bad_request')

  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: member } = await user.rpc('is_member', { hid })
  if (member !== true) return fail('forbidden', 403)

  try {
    if (body.action === 'oauth_start') {
      if (!oauthReady()) return fail('oauth_unavailable')
      const state = crypto.randomUUID()
      const { error } = await admin.from('smartthings_oauth_states').insert({ state, household_id: hid })
      if (error) throw error
      const q = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirectUri(),
        scope: SCOPES,
        state,
      })
      return reply({ url: `${OAUTH}/authorize?${q}` })
    }

    if (body.action === 'connect') {
      const token = body.token?.trim()
      if (!token) return fail('bad_request')
      const list = await st(token, '/devices')
      const fridge = findRefrigerator(list.items ?? [])
      if (!fridge) return fail('no_refrigerator', 404)
      const { error } = await admin.from('smartthings_links').upsert({
        household_id: hid,
        access_token: token,
        refresh_token: null,
        expires_at: null,
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

    const { data } = await admin.from('smartthings_links').select('*').eq('household_id', hid).maybeSingle()
    const link = data as Link | null
    if (!link) return reply({ connected: false, oauth: oauthReady() })

    const token = await accessToken(admin, link)
    const status = await st(token, `/devices/${link.device_id}/status`)
    const state = toFridgeState(status, link.device_label ?? '냉장고')

    if (body.action === 'status') {
      return reply({
        connected: true,
        auth: link.refresh_token ? 'oauth' : 'token',
        oauth: oauthReady(),
        linkedAt: link.updated_at,
        state,
      })
    }

    if (body.action === 'command') {
      const command = toSmartThingsCommand(body.command, state)
      if (!command) return fail('command_not_allowed')
      await st(token, `/devices/${link.device_id}/commands`, {
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
