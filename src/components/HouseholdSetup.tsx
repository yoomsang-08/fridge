import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCode } from '../lib/code'
import { Button, Chip, Logo, TextInput } from './ui'

type Step =
  /** 집 코드 넣기 */
  | { kind: 'code' }
  /** 누구인지 고르기. names 가 있으면 기존 식구로 이어 쓰기 */
  | { kind: 'who'; mode: 'join' | 'create'; names: string[] }

/** 이 기기에서 처음 열었을 때: 집 코드를 넣고 누구인지 골라 합류하거나, 우리 집을 새로 만들기 */
export function HouseholdSetup({ sb, onDone }: { sb: SupabaseClient; onDone: () => void }) {
  const [step, setStep] = useState<Step>({ kind: 'code' })
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 붙여 넣거나 하이픈을 섞어 써도 12자리 영숫자만 남기고, 4자리씩 끊어 보여 준다
  const raw = code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 12)

  /** 코드가 맞는지 보고, 그 집 식구 이름을 받아 온다 */
  const checkCode = async () => {
    setBusy(true)
    setError(null)
    const { data, error } = await sb.rpc('household_member_names', { p_code: raw })
    setBusy(false)
    // 0013 마이그레이션 전이면 함수가 없으니 이름을 새로 받는다
    if (error && error.code !== 'PGRST202') return setError('집 코드를 다시 확인해 주세요.')
    setStep({ kind: 'who', mode: 'join', names: ((data ?? []) as { name: string }[]).map((r) => r.name) })
  }

  const enter = async (mode: 'join' | 'create', name: string) => {
    setBusy(true)
    setError(null)
    const { error } =
      mode === 'create'
        ? await sb.rpc('create_household', { p_name: '우리 집', p_display_name: name })
        : await sb.rpc('join_household', { p_code: raw, p_display_name: name })
    setBusy(false)
    if (error) setError(mode === 'join' ? '집 코드를 다시 확인해 주세요.' : error.message)
    else onDone()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div className="flex flex-col gap-4">
        <Logo size={56} />
        {step.kind === 'code' ? (
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
        ) : (
          <div>
            <h1 className="text-2xl leading-snug font-extrabold tracking-tight">누구세요?</h1>
            <p className="mt-1.5 text-[15px] text-muted">
              {step.names.length
                ? '이름을 누르면 쓰던 그대로 이어져요.'
                : '이 앱에서 부를 이름을 알려 주세요.'}
            </p>
          </div>
        )}
      </div>

      {step.kind === 'code' ? (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (raw) checkCode()
          }}
        >
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
            다음
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          {step.names.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {step.names.map((name) => (
                <Chip
                  key={name}
                  disabled={busy}
                  onClick={() => enter(step.mode, name)}
                  className="h-12 px-5 text-base font-bold"
                >
                  {name}
                </Chip>
              ))}
            </div>
          )}
          <form
            className="flex flex-col gap-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              const name = displayName.trim()
              if (name) enter(step.mode, name)
            }}
          >
            <TextInput
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={step.names.length ? '처음 왔다면 이름 (예: 할머니)' : '이름 (예: 민상, 지선)'}
            />
            {error && <p className="text-center text-sm text-expired">{error}</p>}
            <Button
              type="submit"
              variant={step.names.length ? 'ghost' : 'primary'}
              className="w-full"
              disabled={busy || !displayName.trim()}
            >
              {step.names.length ? '새 식구로 들어가기' : '들어가기'}
            </Button>
          </form>
        </div>
      )}

      <p className="text-center text-sm text-muted">
        {step.kind === 'code' ? (
          <>
            아직 집 코드가 없다면{' '}
            <button
              disabled={busy}
              onClick={() => setStep({ kind: 'who', mode: 'create', names: [] })}
              className="font-bold text-accent disabled:opacity-50"
            >
              우리 집 새로 만들기
            </button>
          </>
        ) : (
          <button
            disabled={busy}
            onClick={() => {
              setError(null)
              setStep({ kind: 'code' })
            }}
            className="font-bold text-accent disabled:opacity-50"
          >
            집 코드 다시 넣기
          </button>
        )}
      </p>
    </div>
  )
}
