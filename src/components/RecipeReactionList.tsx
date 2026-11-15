import { ThumbsDown, ThumbsUp, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { downList, exportDownText, upList } from '../lib/recipeReactions'
import type { RecipeReaction } from '../lib/types'
import { Button } from './ui'

/** 좋아요·싫어요한 요리를 모아 보고, 잘못 누른 것은 되돌린다. 싫어요 목록은 데이터 갱신 때 날릴 요리 목록으로 복사할 수 있다 */
export function RecipeReactionList({
  reactions,
  onUndo,
  canCopy = true,
}: {
  reactions: RecipeReaction[]
  /** 싫어요 목록 복사 버튼을 보일지(설정에서만) */
  canCopy?: boolean
  onUndo: (name: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const down = downList(reactions)
  const up = upList(reactions)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportDownText(reactions))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* 복사 권한이 없으면 목록을 눈으로 보고 옮기면 된다 */
    }
  }
  const row = (r: RecipeReaction) => (
    <li key={r.recipe_name} className="flex min-h-12 items-center justify-between gap-3 border-b border-line last:border-b-0">
      <span className="min-w-0 text-[15px] font-semibold break-keep">
        {r.recipe_name}
        {r.by_name && <span className="ml-1.5 text-xs font-normal text-muted">{r.by_name}</span>}
      </span>
      <button
        type="button"
        onClick={() => onUndo(r.recipe_name)}
        aria-label={`${r.recipe_name} 표시 되돌리기`}
        className="flex min-h-11 shrink-0 items-center gap-1 rounded-2xl px-3 text-[13px] font-bold text-accent active:bg-sunken"
      >
        <Undo2 size={16} aria-hidden />
        되돌리기
      </button>
    </li>
  )
  if (reactions.length === 0)
    return <p className="text-sm break-keep text-muted">아직 표시한 요리가 없어요. 식단표에서 요리 추천의 엄지를 눌러 보세요.</p>
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-muted">
          <ThumbsDown size={14} aria-hidden /> 싫어요 {down.length}개 · 추천에서 빠져요
        </h3>
        {down.length > 0 ? (
          <>
            <ul className="mt-1">{down.map(row)}</ul>
            {canCopy && (
              <Button variant="secondary" className="mt-2 w-full" onClick={copy}>
                {copied ? '복사했어요' : '싫어요 목록 복사'}
              </Button>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">없어요</p>
        )}
      </div>
      {up.length > 0 && (
        <div>
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-muted">
            <ThumbsUp size={14} aria-hidden /> 좋아요 {up.length}개 · 조금 먼저 보여요
          </h3>
          <ul className="mt-1">{up.map(row)}</ul>
        </div>
      )}
    </div>
  )
}
