import { useState } from 'react'
import { formatCode } from '../lib/code'
import { FRIDGE_TEMPLATES, ZONE_LABEL } from '../lib/templates'
import type { Repo } from '../lib/repo'
import type { Compartment, Fridge, Household, Zone } from '../lib/types'

interface Props {
  repo: Repo
  household: Household
  fridges: Fridge[]
  compartments: Compartment[]
  isLocal: boolean
  onSignOut?: () => void
  onChanged: () => void
}

export function Settings({ repo, household, fridges, compartments, isLocal, onSignOut, onChanged }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : '실패했어요')
    }
  }

  const ask = (message: string, initial = '') => {
    const v = prompt(message, initial)?.trim()
    return v || null
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-4">
      {!isLocal && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">우리 집 코드</h2>
          <p className="mt-1 text-sm text-slate-500">
            다른 폰이나 PC에서 앱을 처음 열 때 이 코드를 넣으면 같은 냉장고를 함께 봐요. 코드가 비밀번호 역할이니 우리끼리만
            공유해 주세요.
          </p>
          <button
            onClick={copyCode}
            className="mt-3 w-full rounded-xl bg-slate-100 py-3 font-mono text-xl font-bold tracking-[0.3em]"
          >
            {formatCode(household.invite_code)}
          </button>
          <p className="mt-1 text-center text-xs text-slate-400">{copied ? '복사했어요' : '눌러서 복사'}</p>
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">우리 집 냉장고</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {fridges.map((f) => {
            const comps = compartments.filter((c) => c.fridge_id === f.id)
            const open = editing === f.id
            return (
              <li key={f.id} className="rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{f.name}</div>
                    <div className="text-xs text-slate-500">
                      {f.model ?? '모델 미지정'} · 칸 {comps.length}개
                    </div>
                  </div>
                  <button className="text-sm text-sky-700" onClick={() => setEditing(open ? null : f.id)}>
                    {open ? '닫기' : '칸 편집'}
                  </button>
                </div>
                {open && (
                  <div className="border-t border-slate-100 p-3">
                    <ul className="flex flex-col gap-1">
                      {comps.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 text-sm">
                          <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-500">{ZONE_LABEL[c.zone]}</span>
                          <span className="flex-1">{c.name}</span>
                          <button
                            className="text-slate-500"
                            onClick={() => {
                              const name = ask('칸 이름', c.name)
                              if (name) run(() => repo.renameCompartment(c.id, name))
                            }}
                          >
                            이름
                          </button>
                          <button
                            className="text-red-500"
                            onClick={() =>
                              confirm(`'${c.name}' 칸과 안에 든 식품 기록을 지울까요?`) &&
                              run(() => repo.deleteCompartment(c.id))
                            }
                          >
                            삭제
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
                        <button
                          key={z}
                          className="rounded-lg border border-slate-200 px-2 py-1"
                          onClick={() => {
                            const name = ask(`새 ${ZONE_LABEL[z]} 칸 이름`)
                            if (name) run(() => repo.addCompartment(f.id, name, z))
                          }}
                        >
                          + {ZONE_LABEL[z]} 칸
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-3 border-t border-slate-100 pt-3 text-sm">
                      <button
                        className="text-slate-600"
                        onClick={() => {
                          const name = ask('냉장고 이름', f.name)
                          if (name) run(() => repo.renameFridge(f.id, name))
                        }}
                      >
                        냉장고 이름 바꾸기
                      </button>
                      <button
                        className="ml-auto text-red-500"
                        onClick={() =>
                          confirm(`'${f.name}'과(와) 안의 모든 식품 기록을 지울까요?`) && run(() => repo.deleteFridge(f.id))
                        }
                      >
                        냉장고 삭제
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <h3 className="mt-4 text-sm font-semibold text-slate-500">냉장고 추가</h3>
        <div className="mt-2 flex flex-col gap-2">
          {FRIDGE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                const name = ask('냉장고 이름', t.name)
                if (name) run(() => repo.addFridge(t, name))
              }}
              className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-left text-sm"
            >
              + {t.label}
            </button>
          ))}
        </div>
      </section>

      {isLocal ? (
        <p className="px-1 text-sm text-slate-500">
          지금은 체험 모드라 이 기기에만 저장돼요. Supabase를 연결하면 우리 집 코드로 배우자와 함께 쓸 수 있어요.
        </p>
      ) : (
        <button
          onClick={() => confirm('이 기기의 연결을 해제할까요? 다시 쓰려면 우리 집 코드를 넣어야 해요.') && onSignOut?.()}
          className="rounded-xl bg-white py-3 text-slate-600 shadow-sm"
        >
          이 기기 연결 해제
        </button>
      )}
    </div>
  )
}
