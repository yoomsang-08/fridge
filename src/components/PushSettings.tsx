import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { disablePush, enablePush, getDigestPrefs, pushState, setDigestPrefs, type DigestPrefs, type PushState } from '../lib/push'
import { supabase } from '../lib/supabase'
import { cx } from '../lib/cx'
import { Card, Switch } from './ui'

const HINT: Partial<Record<PushState, string>> = {
  'needs-install': '아이폰은 공유 버튼에서 "홈 화면에 추가"한 앱에서만 알림을 받을 수 있어요.',
  unsupported: '이 브라우저에서는 알림을 받을 수 없어요.',
  denied: '알림이 막혀 있어요. 폰(브라우저) 설정에서 이 앱의 알림을 허용해 주세요.',
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const hourLabel = (h: number) => `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시`

/** 이 기기의 알림: 받기 여부, 아침 기한 알림 여부와 시각 */
export function PushSettings({ householdId }: { householdId: string }) {
  const [state, setState] = useState<PushState | null>(null)
  const [prefs, setPrefs] = useState<DigestPrefs | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'))
  }, [])

  useEffect(() => {
    if (state !== 'on' || !supabase) return
    // 구독은 있는데 내 계정 줄이 없으면(다시 접속해 계정이 바뀐 기기) 꺼진 것으로 보여 다시 켜게 한다
    getDigestPrefs(supabase).then(
      (p) => (p ? setPrefs(p) : setState('off')),
      () => setPrefs(null),
    )
  }, [state])

  if (!supabase) return null
  const sb = supabase

  const run = async (job: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await job()
    } catch {
      setError('알림 설정을 저장하지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (on: boolean) =>
    run(async () => {
      setState(on ? await enablePush(sb, householdId) : await disablePush(sb))
      if (!on) setPrefs(null)
    })

  const savePrefs = (next: DigestPrefs) =>
    run(async () => {
      const prev = prefs
      setPrefs(next)
      try {
        await setDigestPrefs(sb, next)
      } catch (e) {
        setPrefs(prev)
        throw e
      }
    })

  const hint = state ? HINT[state] : undefined
  return (
    <Card className="p-5">
      <label className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-extrabold">알림</h2>
          <p className="mt-1 text-sm text-muted">이 기기로 기한 알림과 식구가 보낸 메모 알림을 받아요. 기기마다 따로 켜요.</p>
        </div>
        <Switch
          checked={state === 'on'}
          disabled={busy || !state || !!hint}
          onChange={toggle}
          aria-label="알림 받기"
        />
      </label>

      {state === 'on' && prefs && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <label className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold">아침 기한 알림</h3>
              <p className="mt-0.5 text-sm text-muted">오늘까지·3일 안에 먹어야 할 식품을 매일 알려 드려요.</p>
            </div>
            <Switch
              checked={prefs.on}
              disabled={busy}
              onChange={(on) => savePrefs({ ...prefs, on })}
              aria-label="아침 기한 알림"
            />
          </label>
          <div className={cx('flex items-center gap-3', !prefs.on && 'opacity-40')}>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold">받을 시각</h3>
              <p className="mt-0.5 text-xs text-muted">몇 분쯤 늦게 올 수 있어요.</p>
            </div>
            <label className="relative">
              <select
                value={prefs.hour}
                disabled={busy || !prefs.on}
                onChange={(e) => savePrefs({ ...prefs, hour: Number(e.target.value) })}
                aria-label="아침 알림 받을 시각"
                className="tabular h-11 appearance-none rounded-xl border border-line bg-surface pr-8 pl-3 text-base font-semibold"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted"
              />
            </label>
          </div>
        </div>
      )}

      {hint && <p className="mt-3 rounded-xl bg-sunken p-3 text-sm text-muted">{hint}</p>}
      {error && <p className="mt-3 rounded-xl bg-expired-soft p-3 text-sm text-expired">{error}</p>}
    </Card>
  )
}
