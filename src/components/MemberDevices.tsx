import { ChevronDown, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { seenLabel } from '../lib/device'
import type { Me, Member } from '../lib/types'
import { cx } from '../lib/cx'
import { Button, IconButton } from './ui'

/**
 * 식구별 기기(계정) 목록과 정리.
 * 웹앱은 기기 고유 번호를 알 수 없어 앱을 다시 깔 때마다 새 줄이 생긴다. 안 쓰는 줄은 여기서 지우거나 30일 뒤 자동으로 지워진다.
 */
export function MemberDevices({
  members,
  me,
  onRemove,
  confirm,
}: {
  members: Member[]
  me: Me
  onRemove: (userIds: string[]) => void
  confirm: (title: string, message: string, action?: string) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  // 사람 이름순으로 묶고, 그 안에서 최근에 쓴 기기부터
  const rows = [...members].sort(
    (a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '') ||
      (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? '') ||
      b.joinedAt.localeCompare(a.joinedAt),
  )
  const unseen = rows.filter((m) => m.id !== me.id && !m.lastSeenAt)

  return (
    <div className="mt-2 border-t border-line pt-2">
      <button
        className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-semibold text-muted"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        기기 {rows.length}대 보기
        <ChevronDown size={16} className={cx('ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="flex flex-col gap-1 pb-1">
          <ul className="flex flex-col">
            {rows.map((m) => {
              const mine = m.id === me.id
              return (
                <li key={m.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <span className={cx('w-12 shrink-0 truncate font-bold', !m.name && 'text-faint')}>{m.name ?? '이름 없음'}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {m.device ?? '종류 모름'} · {mine ? '지금' : seenLabel(m.lastSeenAt)}
                  </span>
                  {mine ? (
                    <span className="rounded-md bg-accent-soft px-1.5 py-px text-[11px] font-bold text-accent">이 기기</span>
                  ) : (
                    <IconButton
                      aria-label={`${m.name ?? '이름 없음'}의 ${m.device ?? ''} 기기 지우기`}
                      onClick={async () => {
                        if (await confirm('이 기기를 지울까요?', '그 기기에서 다시 쓰려면 집 코드를 넣고 이름을 고르면 돼요. 식품과 메모는 그대로예요.', '지우기'))
                          onRemove([m.id])
                      }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  )}
                </li>
              )
            })}
          </ul>
          {unseen.length > 0 && (
            <Button
              variant="ghost"
              size="md"
              onClick={async () => {
                if (
                  await confirm(
                    `기록 없는 기기 ${unseen.length}대를 지울까요?`,
                    '쓰는 기기에서 앱을 한 번씩 연 뒤에 정리해 주세요. 열지 않은 기기는 집 코드를 다시 넣어야 해요.',
                    '정리',
                  )
                )
                  onRemove(unseen.map((m) => m.id))
              }}
            >
              기록 없는 기기 {unseen.length}대 정리
            </Button>
          )}
          <p className="text-xs text-muted">30일 넘게 안 쓴 기기는 자동으로 지워져요.</p>
        </div>
      )}
    </div>
  )
}
