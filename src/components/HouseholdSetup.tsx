import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCode } from '../lib/code'
import { Button, Logo, TextInput } from './ui'

/** 이 기기에서 처음 열었을 때: 집 코드를 넣어 합류하거나, 우리 집을 새로 만들기 */
export function HouseholdSetup({ sb, onDone }: { sb: SupabaseClient; onDone: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 붙여 넣거나 하이픈을 섞어 써도 12자리 영숫자만 남기고, 4자리씩 끊어 보여 준다
  const raw = code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 12)

  const run = async (fn: 'create_household' | 'join_household') => {
    setBusy(true)
    setError(null)
    const args =
      fn === 'create_household'
        ? { p_name: '우리 집', p_display_name: displayName }
        : { p_code: raw, p_display_name: displayName }
    const { error } = await sb.rpc(fn, args)
    setBusy(false)
    if (error) setError(fn === 'join_household' ? '집 코드를 다시 확인해 주세요.' : error.message)
    else onDone()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div className="flex flex-col gap-4">
        <Logo size={56} />
        <div>
          <h1 className="text-2xl leading-snug font-extrabold tracking-tight">
            우리 집 냉장고에
            <br />
            들어가 볼까요?
          </h1>
          <p className="mt-1.5 text-[15px] text-muted">
            이 기기에서 처음 여셨네요. 집 코드를 한 번만 넣으면 다음부턴 바로 열려요.
          </p>
        </div>
      </div>
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (raw) run('join_household')
        }}
      >
        <TextInput
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="누가 쓰나요? (예: 민상, 아내)"
        />
        <TextInput
          id="household-code"
          value={formatCode(raw)}
          onChange={(e) => setCode(e.target.value)}
          placeholder="집 코드 12자리"
          aria-label="우리 집 코드"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="tabular h-14 text-center font-mono text-lg font-bold tracking-[0.2em]"
        />
        {error && <p className="text-center text-sm text-expired">{error}</p>}
        <Button type="submit" className="mt-1 w-full" disabled={busy || !raw}>
          들어가기
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        아직 집 코드가 없다면{' '}
        <button
          disabled={busy}
          onClick={() => run('create_household')}
          className="font-bold text-accent disabled:opacity-50"
        >
          우리 집 새로 만들기
        </button>
      </p>
    </div>
  )
}
