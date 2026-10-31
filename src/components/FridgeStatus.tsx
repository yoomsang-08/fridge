import { DoorClosed, DoorOpen, ExternalLink, Minus, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cx } from '../lib/cx'
import {
  errorText,
  FLEX_MODE_LABEL,
  type DeviceStatus,
  type FridgeCommand,
  type FridgeState,
  type SmartThings,
  type Zone,
} from '../lib/smartthings'
import { useDialog } from './Dialog'
import { Button, Card, Field, IconButton, Switch, TextInput } from './ui'

const ZONE_NAME: Record<Zone, string> = { cooler: '냉장실', freezer: '냉동실' }
const REFRESH_MS = 60_000
/** 명령을 보낸 뒤 냉장고가 바뀐 값을 알려줄 때까지 잠깐 기다린다 */
const SETTLE_MS = 2_000

/** 문이 이만큼 넘게 열려 있으면 경고로 보여준다 */
const DOOR_WARN_MS = 60_000

/**
 * 스마트싱스로 연결한 실제 냉장고의 온도·문·급속 기능 패널.
 * 지금은 '온도' 탭에 있고, 냉장고 보기 탭이 생기면 그 맨 위 '냉장고 상태'로 옮길 수 있게 탭과 분리해 둔다
 */
export function FridgeStatus({ st }: { st: SmartThings }) {
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<number>(0)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatus(await st.status())
      setLoadedAt(Date.now())
      setError(null)
    } catch (e) {
      setError(errorText(e))
    }
  }, [st])

  useEffect(() => {
    load()
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS)
    const onFocus = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [load])

  const send = async (command: FridgeCommand, optimistic: (s: FridgeState) => void) => {
    if (!status?.connected) return
    const next = structuredClone(status)
    optimistic(next.state)
    setStatus(next)
    setBusy(true)
    try {
      await st.send(command)
      setError(null)
      await new Promise((r) => setTimeout(r, SETTLE_MS))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
      load()
    }
  }

  if (!status && !error) {
    return <div className="py-20 text-center text-muted">불러오는 중…</div>
  }

  if (!status?.connected) {
    return (
      <div className="flex flex-col gap-4">
        {error && <ErrorNote text={error} />}
        <ConnectCard st={st} onConnected={load} />
      </div>
    )
  }

  const s = status.state
  return (
    <div className="flex flex-col gap-4">
      {st.demo && (
        <p className="rounded-2xl bg-sunken p-3 text-sm break-keep text-muted">
          체험 모드라 예시 값이에요. Supabase를 연결하고 스마트싱스 토큰을 넣으면 우리 집 냉장고가 보여요.
        </p>
      )}
      {error && <ErrorNote text={error} />}

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-extrabold">{s.label} 온도</h2>
            <p className="text-xs text-muted">{busy ? '냉장고에 보내는 중…' : `${ago(loadedAt)} 확인`}</p>
          </div>
          <IconButton aria-label="새로고침" onClick={load} disabled={busy}>
            <RefreshCw size={18} className={cx(busy && 'animate-spin motion-reduce:animate-none')} />
          </IconButton>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(['cooler', 'freezer'] as const).map((z) => (
            <ZoneTile
              key={z}
              zone={z}
              state={s}
              disabled={busy}
              onApply={(value) =>
                send({ kind: 'setpoint', zone: z, value }, (n) => {
                  n[z].setpoint = value
                })
              }
            />
          ))}
        </div>
      </Card>

      <DoorCard state={s} now={loadedAt} />

      <Card className="p-5">
        <h2 className="text-[15px] font-extrabold">빠르게 차갑게</h2>
        <div className="mt-3 flex flex-col gap-2">
          <SwitchRow
            title="급속냉동"
            hint="장 본 고기·생선을 빨리 얼려요"
            on={s.powerFreeze}
            disabled={busy}
            onToggle={(on) =>
              send({ kind: 'powerFreeze', on }, (n) => {
                n.powerFreeze = on
              })
            }
          />
          <SwitchRow
            title="급속냉장"
            hint="음료나 반찬을 빨리 식혀요"
            on={s.powerCool}
            disabled={busy}
            onToggle={(on) =>
              send({ kind: 'powerCool', on }, (n) => {
                n.powerCool = on
              })
            }
          />
        </div>
      </Card>

      <Card className="grid grid-cols-2 divide-x divide-line p-5">
        <div className="pr-4">
          <p className="text-[13px] font-bold text-muted">이번 달 전기</p>
          <p className="tabular mt-1 text-lg font-extrabold">{s.monthKwh ?? '-'} kWh</p>
          {s.powerW !== null && <p className="tabular text-xs text-muted">지금 {s.powerW}W</p>}
        </div>
        <div className="pl-4">
          <p className="text-[13px] font-bold text-muted">변온실</p>
          <p className="mt-1 text-lg font-extrabold">{(s.flexMode && FLEX_MODE_LABEL[s.flexMode]) ?? '-'}</p>
          <p className="text-xs text-muted">스마트싱스 앱에서 바꿔요</p>
        </div>
      </Card>

      {!st.demo && <LinkCard st={st} linkedAt={status.linkedAt} now={loadedAt} onChanged={load} />}
    </div>
  )
}

function ZoneTile({
  zone,
  state,
  disabled,
  onApply,
}: {
  zone: Zone
  state: FridgeState
  disabled: boolean
  onApply: (value: number) => void
}) {
  const z = state[zone]
  const [draft, setDraft] = useState<number | null>(null)
  const egg = useIceCreamEgg()
  const target = draft ?? z.setpoint
  const changed = draft !== null && draft !== z.setpoint
  const step = (d: number) => {
    if (target === null) return
    setDraft(Math.min(z.max, Math.max(z.min, target + d)))
  }

  return (
    <div className="flex flex-col rounded-2xl border border-line p-4">
      <p className="text-[13px] font-bold text-muted">{ZONE_NAME[zone]}</p>
      <button
        className="tabular mt-1 self-start text-[32px] leading-none font-extrabold tracking-tight"
        onClick={zone === 'freezer' ? egg.tap : undefined}
        tabIndex={-1}
      >
        {z.current ?? '-'}
        <span className="text-lg font-bold text-muted">°C</span>
      </button>
      <p className="mt-1 min-h-4 text-xs break-keep text-muted">{egg.on ? '지선 님 아이스크림 지킴이' : '지금 온도'}</p>

      <p className="mt-4 mb-1.5 text-[13px] font-bold text-muted">설정 온도</p>
      <div className="flex items-center justify-between rounded-xl bg-sunken p-1">
        <IconButton
          aria-label={`${ZONE_NAME[zone]} 설정 온도 내리기`}
          className="text-ink active:bg-surface"
          disabled={disabled || target === null || target <= z.min}
          onClick={() => step(-1)}
        >
          <Minus size={18} strokeWidth={2.4} />
        </IconButton>
        <span className={cx('tabular text-[15px] font-bold whitespace-nowrap', changed && 'text-accent')}>
          {target ?? '-'}°C
        </span>
        <IconButton
          aria-label={`${ZONE_NAME[zone]} 설정 온도 올리기`}
          className="text-ink active:bg-surface"
          disabled={disabled || target === null || target >= z.max}
          onClick={() => step(1)}
        >
          <Plus size={18} strokeWidth={2.4} />
        </IconButton>
      </div>
      <p className="tabular mt-1.5 text-center text-xs text-faint">
        {z.min} ~ {z.max}°C
      </p>

      {changed && (
        <div className="mt-2 flex gap-1.5">
          <Button variant="ghost" size="md" className="px-3 whitespace-nowrap" onClick={() => setDraft(null)}>
            취소
          </Button>
          <Button
            size="md"
            className="flex-1 px-2 whitespace-nowrap"
            disabled={disabled}
            onClick={() => {
              if (draft !== null) onApply(draft)
              setDraft(null)
            }}
          >
            바꾸기
          </Button>
        </div>
      )}
    </div>
  )
}

function SwitchRow({
  title,
  hint,
  on,
  disabled,
  onToggle,
}: {
  title: string
  hint: string
  on: boolean | null
  disabled: boolean
  onToggle: (on: boolean) => void
}) {
  return (
    <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-line px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">{title}</p>
        <p className={cx('text-xs', on ? 'font-semibold text-accent' : 'text-muted')}>{on ? '켜져 있어요' : hint}</p>
      </div>
      <Switch checked={!!on} disabled={disabled || on === null} onChange={onToggle} aria-label={title} />
    </label>
  )
}

function DoorCard({ state: s, now }: { state: FridgeState; now: number }) {
  const changed = s.doorChangedAt ? Date.parse(s.doorChangedAt) : null
  const openFor = s.doorOpen && changed ? now - changed : 0
  const warn = openFor >= DOOR_WARN_MS
  return (
    <Card className={cx('flex items-center gap-3 p-5', warn && 'bg-urgent-soft')}>
      <span
        className={cx(
          'grid h-11 w-11 shrink-0 place-items-center rounded-2xl',
          warn ? 'bg-urgent text-white' : s.doorOpen ? 'bg-ink text-white' : 'bg-sunken text-muted',
        )}
      >
        {s.doorOpen ? <DoorOpen size={22} /> : <DoorClosed size={22} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx('text-[15px] font-bold', warn && 'text-urgent')}>
          {doorText(s)}
          {warn && ` · ${Math.floor(openFor / 60_000)}분째`}
        </p>
        {warn && <p className="text-xs text-urgent/80">닫히면 자동으로 사라져요</p>}
        {changed && !warn && (
          <p className="text-xs text-muted">{s.doorOpen ? '방금 열렸어요' : `${ago(changed, now)} 닫혔어요`}</p>
        )}
      </div>
    </Card>
  )
}

const TOKEN_PAGE = 'https://account.smartthings.com/tokens'

function ConnectCard({ st, onConnected }: { st: SmartThings; onConnected: () => void }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = async () => {
    setBusy(true)
    setError(null)
    try {
      await st.connect(token)
      setToken('')
      onConnected()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-[17px] font-extrabold">스마트싱스 냉장고 연결</h2>
        <p className="mt-1 text-sm text-muted">
          연결하면 냉장고 온도와 문 상태를 보고, 급속냉동을 켜거나 온도를 바꿀 수 있어요.
        </p>
      </div>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>
          <a href={TOKEN_PAGE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">
            스마트싱스 토큰 페이지
            <ExternalLink size={14} />
          </a>
          에서 삼성 계정으로 로그인
        </li>
        <li>새 토큰 만들기 → Devices 항목 모두 체크</li>
        <li>만든 토큰을 아래에 붙여 넣기</li>
      </ol>
      <Field label="토큰">
        <TextInput
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="예: 1a2b3c4d-…"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      {error && <ErrorNote text={error} />}
      <Button disabled={busy || token.trim().length < 20} onClick={connect}>
        {busy ? '연결하는 중…' : '연결'}
      </Button>
      <p className="text-xs text-muted">
        토큰은 우리 집 서버에만 저장되고 앱에서는 다시 볼 수 없어요. 지금 방식의 토큰은 하루가 지나면 만료돼서 그때 새로
        넣어야 해요.
      </p>
    </Card>
  )
}

function LinkCard({
  st,
  linkedAt,
  now,
  onChanged,
}: {
  st: SmartThings
  linkedAt: string
  now: number
  onChanged: () => void
}) {
  const { confirm, dialog } = useDialog()
  const expires = Date.parse(linkedAt) + 24 * 3600_000
  const left = expires - now
  return (
    <Card className="flex items-center gap-3 p-5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">스마트싱스 연결됨</p>
        <p className="text-xs text-muted">
          {left > 0 ? `토큰이 약 ${Math.max(1, Math.round(left / 3600_000))}시간 뒤 만료돼요` : '토큰이 만료됐을 수 있어요'}
        </p>
      </div>
      <Button
        variant="danger"
        size="md"
        onClick={async () => {
          if (await confirm('스마트싱스 연결을 해제할까요?', '저장된 토큰을 지워요. 다시 쓰려면 새 토큰을 넣어야 해요.', '연결 해제')) {
            await st.disconnect()
            onChanged()
          }
        }}
      >
        연결 해제
      </Button>
      {dialog}
    </Card>
  )
}

function ErrorNote({ text }: { text: string }) {
  return <p className="rounded-2xl bg-expired-soft p-3 text-sm text-expired">{text}</p>
}

function doorText(s: FridgeState): string {
  if (s.doorOpen === null) return '문 상태를 알 수 없어요'
  if (!s.doorOpen) return '문이 모두 닫혀 있어요'
  const open = (['cooler', 'freezer'] as const).filter((z) => s[z].doorOpen).map((z) => ZONE_NAME[z])
  return open.length ? `${open.join('·')} 문이 열려 있어요` : '문이 열려 있어요'
}

function ago(t: number, now = Date.now()): string {
  const min = Math.floor((now - t) / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`
}

/** 이스터에그: 냉동실 온도를 1.5초 안에 세 번 누르면 3초 동안 아이스크림 안부를 전한다 */
function useIceCreamEgg() {
  const [on, setOn] = useState(false)
  const taps = useRef<number[]>([])
  const tap = () => {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < 1500), now]
    if (taps.current.length < 3) return
    taps.current = []
    setOn(true)
    setTimeout(() => setOn(false), 3000)
  }
  return { on, tap }
}
