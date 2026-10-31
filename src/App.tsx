import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { createLocalRepo, createSupabaseRepo, LOCAL_HOUSEHOLD } from './lib/repo'
import { disablePush } from './lib/push'
import { createDemoSmartThings, createSmartThings } from './lib/smartthings'
import type { Household } from './lib/types'
import { HouseholdSetup } from './components/HouseholdSetup'
import { Main } from './components/Main'

export default function App() {
  if (!supabase) return <Main repo={localRepo} household={LOCAL_HOUSEHOLD} smartthings={demoSmartThings} isLocal />
  return <SupabaseApp sb={supabase} />
}

const localRepo = createLocalRepo()
const demoSmartThings = createDemoSmartThings()

function SupabaseApp({ sb }: { sb: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [household, setHousehold] = useState<Household | null | undefined>(undefined)
  const [authError, setAuthError] = useState<string | null>(null)
  const repo = useMemo(() => (household ? createSupabaseRepo(sb, household) : null), [sb, household])
  const smartthings = useMemo(() => (household ? createSmartThings(sb, household.id) : null), [sb, household])

  useEffect(() => {
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // 기기 연결 해제 뒤에는 새 익명 계정으로 다시 접속해 집 코드 화면을 띄운다
      if (event === 'SIGNED_OUT') {
        setHousehold(undefined)
        sb.auth.signInAnonymously().then(({ error }) => error && setAuthError(error.message))
      }
    })
    // 로그인 화면 없이 기기마다 익명 계정으로 자동 접속. 우리 집 데이터 접근은 집 코드로 합류해야 열림
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session) return setSession(data.session)
      const { error } = await sb.auth.signInAnonymously()
      if (error) setAuthError(error.message)
    })
    return () => data.subscription.unsubscribe()
  }, [sb])

  const loadHousehold = useCallback(async () => {
    const { data, error } = await sb.from('households').select('id, name, invite_code').limit(1).maybeSingle()
    if (error) console.error(error)
    setHousehold(data ?? null)
  }, [sb])

  useEffect(() => {
    if (session) loadHousehold()
  }, [session, loadHousehold])

  if (authError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-2 px-6 text-center">
        <p className="text-lg font-extrabold">서버에 접속하지 못했어요</p>
        <p className="text-sm text-muted">
          Supabase의 Authentication 설정에서 Anonymous sign-ins 가 켜져 있는지 확인해 주세요.
        </p>
        <p className="text-xs text-faint">{authError}</p>
      </div>
    )
  }
  if (!session || household === undefined) {
    return <div className="flex min-h-dvh items-center justify-center text-faint">불러오는 중…</div>
  }

  if (!household || !repo || !smartthings) {
    return <HouseholdSetup sb={sb} onDone={loadHousehold} />
  }

  return (
    <Main
      key={household.id}
      repo={repo}
      household={household}
      smartthings={smartthings}
      onSignOut={async () => {
        // 이 기기로 오던 알림을 끊고, 식구 목록에서도 빠진 뒤 로그아웃
        await disablePush(sb).catch(() => {})
        await sb.from('household_members').delete().eq('household_id', household.id).eq('user_id', session.user.id)
        await sb.auth.signOut()
      }}
    />
  )
}
