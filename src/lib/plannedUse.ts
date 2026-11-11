import { createContext, useContext } from 'react'
import type { PlannedUse } from './meals'

/** 식단표에서 쓰기로 한 식품들. Main 이 채우고, 어느 화면의 식품 줄에서든 PlannedChip 이 읽는다 */
export const PlannedUseContext = createContext<Map<string, PlannedUse[]>>(new Map())
export const usePlannedUses = (itemId: string) => useContext(PlannedUseContext).get(itemId)
