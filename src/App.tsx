import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { createLocalRepo, createSupabaseRepo, LOCAL_HOUSEHOLD } from './lib/repo'
import type { Household } from './lib/types'
import { Login } from './components/Login'
import { HouseholdSetup } from './components/HouseholdSetup'
import { Main } from './components/Main'

export default function App() {
  if (!supabase) return <Main repo={localRepo} household={LOCAL_HOUSEHOLD} isLocal />
  return <SupabaseApp sb={supabase} />
}

const localRepo = createLocalRepo()

function SupabaseApp({ sb }: { sb: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [household, setHousehold] = useState<Household | null | undefined>(undefined)
  const repo = useMemo(() => (household ? createSupabaseRepo(sb, household) : null), [sb, household])

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s))
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

  if (session === undefined || (session && household === undefined)) {
    return <div className="flex min-h-dvh items-center justify-center text-slate-400">불러오는 중…</div>
  }
  if (!session) return <Login sb={sb} />

  if (!household || !repo) {
    const meta = session.user.user_metadata
    return (
      <HouseholdSetup
        sb={sb}
        defaultName={meta.full_name ?? meta.name ?? session.user.email?.split('@')[0] ?? ''}
        onDone={loadHousehold}
      />
    )
  }

  return (
    <Main
      key={household.id}
      repo={repo}
      household={household}
      onSignOut={() => sb.auth.signOut()}
    />
  )
}
