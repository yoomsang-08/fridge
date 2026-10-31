import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/** 이 기기에서 처음 열었을 때: 집 코드를 넣어 합류하거나, 우리 집을 새로 만들기 */
export function HouseholdSetup({ sb, onDone }: { sb: SupabaseClient; onDone: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: 'create_household' | 'join_household') => {
    setBusy(true)
    setError(null)
    const args =
      fn === 'create_household'
        ? { p_name: '우리 집', p_display_name: displayName }
        : { p_code: code, p_display_name: displayName }
    const { error } = await sb.rpc(fn, args)
    setBusy(false)
    if (error) setError(fn === 'join_household' ? '집 코드를 다시 확인해 주세요.' : error.message)
    else onDone()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6">
      <div className="text-center">
        <div className="text-6xl">🧊</div>
        <h1 className="mt-3 text-2xl font-extrabold">냉장고를 부탁해</h1>
        <p className="mt-1 text-sm text-slate-500">이 기기에서 처음 여셨네요. 우리 집 코드를 한 번만 넣어 주세요.</p>
      </div>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="누가 쓰나요? (예: 민상, 아내)"
        className="rounded-xl border border-slate-300 px-3 py-3"
      />
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="우리 집 코드 12자리"
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-300 px-3 py-3 text-center font-mono uppercase tracking-widest"
        />
        <button
          disabled={busy || !code.trim()}
          onClick={() => run('join_household')}
          className="mt-3 w-full rounded-xl bg-sky-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          들어가기
        </button>
      </div>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      <div className="text-center">
        <p className="text-sm text-slate-500">아직 우리 집 코드가 없다면</p>
        <button
          disabled={busy}
          onClick={() => run('create_household')}
          className="mt-1 text-sm font-semibold text-sky-700 disabled:opacity-50"
        >
          우리 집 새로 만들기
        </button>
      </div>
    </div>
  )
}
