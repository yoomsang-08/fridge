import { useEffect, useState } from 'react'
import { disablePush, enablePush, pushAvailable, pushState, type PushState } from '../lib/push'
import { supabase } from '../lib/supabase'
import { Card, Switch } from './ui'

const HINT: Partial<Record<PushState, string>> = {
  'needs-install': '아이폰은 공유 버튼에서 "홈 화면에 추가"한 앱에서만 알림을 받을 수 있어요.',
  unsupported: '이 브라우저에서는 알림을 받을 수 없어요.',
  denied: '알림이 막혀 있어요. 폰(브라우저) 설정에서 이 앱의 알림을 허용해 주세요.',
}

/** 이 기기의 아침 기한 알림 켜고 끄기 */
export function PushSettings({ householdId }: { householdId: string }) {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'))
  }, [])

  if (!supabase || !pushAvailable()) return null
  const sb = supabase

  const toggle = async (on: boolean) => {
    setBusy(true)
    setError(null)
    try {
      setState(on ? await enablePush(sb, householdId) : await disablePush(sb))
    } catch {
      setError('알림 설정을 저장하지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const hint = state ? HINT[state] : undefined
  return (
    <Card className="p-5">
      <label className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-extrabold">아침 알림</h2>
          <p className="mt-1 text-sm text-muted">매일 아침 8시 반쯤, 오늘까지·3일 안에 먹어야 할 식품을 알려 드려요. 이 기기에만 적용돼요.</p>
        </div>
        <Switch
          checked={state === 'on'}
          disabled={busy || !state || !!hint}
          onChange={toggle}
          aria-label="아침 알림"
        />
      </label>
      {hint && <p className="mt-3 rounded-xl bg-sunken p-3 text-sm text-muted">{hint}</p>}
      {error && <p className="mt-3 rounded-xl bg-expired-soft p-3 text-sm text-expired">{error}</p>}
    </Card>
  )
}
