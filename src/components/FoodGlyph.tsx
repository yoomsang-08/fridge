import { emojiOfItem, imageOfItem } from '../lib/foodLook'
import type { Item } from '../lib/types'

/**
 * 식품 그림 한 칸. src/assets/food/ 에 그 식품의 그림이 있으면 그림을, 없으면 이모지를 보여 준다.
 * 바깥 타일(크기·바탕색)은 부르는 쪽이 정하고, 이 부품은 안쪽 글리프만 맡는다
 */
export function FoodGlyph({ item, categoryEmoji }: { item: Pick<Item, 'name'>; categoryEmoji: string }) {
  const src = imageOfItem(item)
  if (src) return <img src={src} alt="" draggable={false} className="h-[68%] w-[68%] object-contain" />
  return <>{emojiOfItem(item, categoryEmoji)}</>
}
