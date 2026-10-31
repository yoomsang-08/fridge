import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/** 처음 로그인했을 때: 우리 집을 새로 만들거나, 배우자가 준 초대코드로 합류 */
export function HouseholdSetup({ sb, defaultName, onDone }: { sb: SupabaseClient; defaultName: string; onDone: () => void }) {
  const [displayName, setDisplayName] = useState(defaultName)
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
    if (error) setError(fn === 'join_household' ? '초대코드를 다시 확인해 주세요.' : error.message)
    else onDone()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-xl font-bold">처음 오셨네요</h1>
      <label className="flex flex-col gap-1 text-sm text-slate-600">
        앱에서 보일 내 이름
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-3 text-base text-slate-900"
        />
      </label>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-semibold">새로 시작하기</p>
        <p className="mt-1 text-sm text-slate-500">우리 집을 만들고, 설정에서 초대코드를 배우자에게 보내 주세요.</p>
        <button
          disabled={busy}
          onClick={() => run('create_household')}
          className="mt-3 w-full rounded-xl bg-sky-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          우리 집 만들기
        </button>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-semibold">초대코드로 합류하기</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="예: 3F9A1C2B"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 uppercase tracking-widest"
        />
        <button
          disabled={busy || !code.trim()}
          onClick={() => run('join_household')}
          className="mt-3 w-full rounded-xl bg-slate-800 py-3 font-semibold text-white disabled:opacity-50"
        >
          합류하기
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
