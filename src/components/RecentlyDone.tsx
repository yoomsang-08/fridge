import { useMemo } from 'react'
import type { Item } from '../lib/types'
import { Button, Card } from './ui'

const DAYS = 14
const MAX = 20

/** 최근 2주 안에 다 먹었거나 버린 식품. 잘못 눌렀으면 여기서 다시 재고로 되살린다 */
export function RecentlyDone({ history, onRestore }: { history: Item[]; onRestore: (id: string) => void }) {
  const rows = useMemo(() => {
    const since = Date.now() - DAYS * 86400_000
    return history
      .filter((i) => i.status !== 'active' && new Date(i.updated_at).getTime() >= since)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, MAX)
  }, [history])

  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-extrabold">실수로 정리했나요?</h2>
      <p className="mt-1 text-sm text-muted">최근 2주 동안 다 먹었거나 버린 식품이에요. 되살리면 원래 칸에 다시 돌아와요.</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-faint">되살릴 식품이 없어요</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {rows.map((i) => (
            <li key={i.id} className="flex min-h-12 items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{i.name}</span>
                <span className="block text-xs text-muted">
                  {i.status === 'discarded' ? '버렸어요' : '다 먹었어요'} · {whenLabel(i.updated_at)}
                </span>
              </span>
              <Button variant="secondary" size="md" onClick={() => onRestore(i.id)}>
                되살리기
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function whenLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000)
  return days <= 0 ? '오늘' : days === 1 ? '어제' : `${days}일 전`
}
