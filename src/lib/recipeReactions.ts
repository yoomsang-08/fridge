import type { RecipeReaction } from './types'

/** 요리 이름 → 좋아요/싫어요. 추천에 넘기는 모양 */
export function reactionMap(list: RecipeReaction[]): Map<string, 'up' | 'down'> {
  return new Map(list.map((r) => [r.recipe_name, r.reaction]))
}

export const downList = (list: RecipeReaction[]) => list.filter((r) => r.reaction === 'down')
export const upList = (list: RecipeReaction[]) => list.filter((r) => r.reaction === 'up')

/**
 * 요리 데이터를 갱신할 때 날릴 요리 목록(싫어요). 한 줄에 요리 이름 하나.
 * `node scripts/prune-recipes.mjs 파일` 에 그대로 넣을 수 있다. 사용법은 docs/recipe-reactions.md
 */
export const exportDownText = (list: RecipeReaction[]) =>
  downList(list)
    .map((r) => r.recipe_name)
    .sort((a, b) => a.localeCompare(b))
    .join('\n')
