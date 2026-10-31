import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function Login({ sb }: { sb: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const redirectTo = window.location.origin + window.location.pathname

  const google = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) setError(error.message)
  }

  const magicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <div className="text-6xl">🧊</div>
        <h1 className="mt-3 text-2xl font-extrabold">냉장고를 부탁해</h1>
        <p className="mt-1 text-slate-500">우리 집 냉장고 재고와 유통기한 관리</p>
      </div>
      <button
        onClick={google}
        className="rounded-xl border border-slate-300 bg-white py-3 font-semibold shadow-sm active:bg-slate-50"
      >
        Google 계정으로 로그인
      </button>
      <form onSubmit={magicLink} className="flex flex-col gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일 주소"
          className="rounded-xl border border-slate-300 px-3 py-3"
        />
        <button className="rounded-xl bg-slate-800 py-3 font-semibold text-white">이메일로 로그인 링크 받기</button>
        {sent && <p className="text-sm text-emerald-700">메일함에서 로그인 링크를 눌러 주세요.</p>}
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
