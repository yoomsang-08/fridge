import { Check, ChevronDown, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { formatCode } from '../lib/code'
import { FRIDGE_TEMPLATES, ZONE_LABEL } from '../lib/templates'
import type { Repo } from '../lib/repo'
import type { Compartment, Fridge, Household, Me, Member, Zone } from '../lib/types'
import { useDialog } from './Dialog'
import { cx } from '../lib/cx'
import { Button, Card, IconButton } from './ui'

interface Props {
  repo: Repo
  household: Household
  fridges: Fridge[]
  compartments: Compartment[]
  me: Me
  members: Member[]
  isLocal: boolean
  onSignOut?: () => void
  onChanged: () => void
}

export function Settings({ repo, household, fridges, compartments, me, members, isLocal, onSignOut, onChanged }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { ask, confirm, dialog } = useDialog()

  const run = async (fn: () => Promise<void>) => {
    try {
      setError(null)
      await fn()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '실패했어요')
    }
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-2xl bg-expired-soft p-3 text-sm text-expired">{error}</p>}

      <Card className="p-5">
        <h2 className="text-[15px] font-extrabold">우리 집 식구</h2>
        <ul className="mt-3 flex flex-col gap-1">
          {members.map((m) => {
            const mine = m.id === me.id
            return (
              <li key={m.id} className="flex min-h-11 items-center gap-2">
                <span className={cx('font-bold', !m.name && 'text-faint')}>{m.name ?? '이름 없음'}</span>
                {mine && (
                  <span className="rounded-md bg-accent-soft px-1.5 py-px text-[11px] font-bold text-accent">나</span>
                )}
                {mine && (
                  <Button
                    variant="ghost"
                    size="md"
                    className="ml-auto"
                    onClick={async () => {
                      const name = await ask('내 이름', m.name ?? '')
                      if (name) run(() => repo.renameMe(name))
                    }}
                  >
                    이름 바꾸기
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      {!isLocal && (
        <Card className="p-5">
          <h2 className="text-[15px] font-extrabold">우리 집 코드</h2>
          <p className="mt-1 text-sm text-muted">
            다른 폰이나 PC에서 앱을 처음 열 때 이 코드를 넣으면 같은 냉장고를 함께 봐요. 코드가 비밀번호 역할이니
            우리끼리만 공유해 주세요.
          </p>
          <button
            onClick={copyCode}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-sunken py-4 transition active:brightness-95"
          >
            <span className="tabular font-mono text-xl font-bold tracking-[0.25em]">
              {formatCode(household.invite_code)}
            </span>
            <span
              className={cx('flex items-center gap-1 text-xs font-semibold', copied ? 'text-accent' : 'text-muted')}
            >
              {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
              {copied ? '복사함' : '복사'}
            </span>
          </button>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-[15px] font-extrabold">우리 집 냉장고</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {fridges.map((f) => {
            const comps = compartments.filter((c) => c.fridge_id === f.id)
            const open = editing === f.id
            return (
              <li key={f.id} className="overflow-hidden rounded-2xl border border-line">
                <button
                  className="flex w-full items-center gap-2 p-3.5 text-left"
                  onClick={() => setEditing(open ? null : f.id)}
                  aria-expanded={open}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{f.name}</div>
                    <div className="tabular text-xs text-muted">
                      {f.model ?? '모델 미지정'} · 칸 {comps.length}개
                    </div>
                  </div>
                  <span className="flex items-center gap-0.5 text-sm font-semibold text-accent">
                    칸 편집
                    <ChevronDown size={16} className={cx('transition', open && 'rotate-180')} />
                  </span>
                </button>
                {open && (
                  <div className="border-t border-line bg-bg/60 p-3">
                    <ul className="flex flex-col">
                      {comps.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 py-0.5 text-sm">
                          <span className="rounded-md bg-sunken px-1.5 py-px text-[11px] font-semibold text-muted">
                            {ZONE_LABEL[c.zone]}
                          </span>
                          <span className="flex-1 font-medium">{c.name}</span>
                          <IconButton
                            aria-label={`${c.name} 이름 바꾸기`}
                            onClick={async () => {
                              const name = await ask('칸 이름', c.name)
                              if (name) run(() => repo.renameCompartment(c.id, name))
                            }}
                          >
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton
                            aria-label={`${c.name} 삭제`}
                            className="text-expired/80"
                            onClick={async () => {
                              if (await confirm(`'${c.name}' 칸을 지울까요?`, '칸 안에 든 식품 기록도 함께 지워져요.'))
                                run(() => repo.deleteCompartment(c.id))
                            }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
                        <button
                          key={z}
                          className="flex h-9 items-center gap-1 rounded-xl border border-dashed border-faint/60 px-3 text-sm font-semibold text-muted active:bg-sunken"
                          onClick={async () => {
                            const name = await ask(`새 ${ZONE_LABEL[z]} 칸 이름`)
                            if (name) run(() => repo.addCompartment(f.id, name, z))
                          }}
                        >
                          <Plus size={14} strokeWidth={2.6} />
                          {ZONE_LABEL[z]} 칸
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-line pt-3">
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={async () => {
                          const name = await ask('냉장고 이름', f.name)
                          if (name) run(() => repo.renameFridge(f.id, name))
                        }}
                      >
                        이름 바꾸기
                      </Button>
                      <Button
                        variant="danger"
                        size="md"
                        className="ml-auto"
                        onClick={async () => {
                          if (await confirm(`'${f.name}'을(를) 지울까요?`, '안에 든 모든 식품 기록도 함께 지워져요.'))
                            run(() => repo.deleteFridge(f.id))
                        }}
                      >
                        냉장고 삭제
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <h3 className="mt-5 text-[13px] font-bold text-muted">냉장고 추가</h3>
        <div className="mt-2 flex flex-col gap-1.5">
          {FRIDGE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={async () => {
                const name = await ask('냉장고 이름', t.name)
                if (name) run(() => repo.addFridge(t, name))
              }}
              className="flex min-h-12 items-center gap-2 rounded-2xl border border-dashed border-faint/60 px-3.5 text-left text-sm font-semibold active:bg-sunken"
            >
              <Plus size={16} className="shrink-0 text-accent" strokeWidth={2.6} />
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {isLocal ? (
        <p className="px-1 text-sm text-muted">
          지금은 체험 모드라 이 기기에만 저장돼요. Supabase를 연결하면 우리 집 코드로 배우자와 함께 쓸 수 있어요.
        </p>
      ) : (
        <Button
          variant="ghost"
          className="bg-surface text-muted shadow-card"
          onClick={async () => {
            if (await confirm('이 기기의 연결을 해제할까요?', '다시 쓰려면 우리 집 코드를 넣어야 해요.', '연결 해제'))
              onSignOut?.()
          }}
        >
          이 기기 연결 해제
        </Button>
      )}
      {dialog}
    </div>
  )
}
