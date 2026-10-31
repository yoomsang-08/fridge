import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import type { FridgeCommand, FridgeState } from '../../supabase/functions/smartthings/fridge.ts'

export type { FridgeCommand, FridgeState, Zone } from '../../supabase/functions/smartthings/fridge.ts'
export { FLEX_MODE_LABEL } from '../../supabase/functions/smartthings/fridge.ts'

export type DeviceStatus = { connected: false } | { connected: true; linkedAt: string; state: FridgeState }

/** 스마트싱스 냉장고. 토큰은 서버(Edge Function)에만 있고 앱은 정리된 값만 받는다 */
export interface SmartThings {
  /** 체험 모드라 예시 값을 보여주는 중 */
  demo: boolean
  status(): Promise<DeviceStatus>
  connect(token: string): Promise<void>
  disconnect(): Promise<void>
  send(command: FridgeCommand): Promise<void>
}

/** 서버가 돌려준 오류 코드. 화면 문구는 errorText() 로 */
export class SmartThingsError extends Error {}

const ERROR_TEXT: Record<string, string> = {
  token_invalid: '스마트싱스 토큰이 만료됐거나 맞지 않아요. 새 토큰을 넣어 주세요.',
  token_scope: '토큰에 권한이 부족해요. 토큰을 만들 때 기기 보기와 제어 권한을 모두 체크해 주세요.',
  no_refrigerator: '이 삼성 계정에서 냉장고를 찾지 못했어요. 스마트싱스 앱에 냉장고가 등록돼 있는지 확인해 주세요.',
  rate_limited: '요청이 너무 잦아요. 잠시 뒤에 다시 해 주세요.',
  command_not_allowed: '그 온도로는 바꿀 수 없어요.',
  forbidden: '우리 집에 합류한 기기에서만 쓸 수 있어요.',
}

export function errorText(e: unknown): string {
  const code = e instanceof Error ? e.message : ''
  return ERROR_TEXT[code] ?? '냉장고에 연결하지 못했어요. 잠시 뒤에 다시 해 주세요.'
}

export function createSmartThings(sb: SupabaseClient, householdId: string): SmartThings {
  const call = async <T>(action: string, extra: object = {}): Promise<T> => {
    const { data, error } = await sb.functions.invoke('smartthings', {
      body: { action, household_id: householdId, ...extra },
    })
    if (error) {
      const code = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null
      throw new SmartThingsError(code?.error ?? 'unknown')
    }
    return data as T
  }
  return {
    demo: false,
    status: () => call<DeviceStatus>('status'),
    connect: (token) => call('connect', { token }),
    disconnect: () => call('disconnect'),
    send: (command) => call('command', { command }),
  }
}

/** 체험 모드: 실제 냉장고(RF85DB90F1AP)에서 읽은 값을 본뜬 예시. 이 기기 안에서만 바뀐다 */
export function createDemoSmartThings(): SmartThings {
  const state: FridgeState = {
    label: '냉장고',
    cooler: { current: 2, setpoint: 2, min: 0, max: 5, doorOpen: false },
    freezer: { current: -17, setpoint: -17, min: -23, max: -17, doorOpen: false },
    doorOpen: false,
    powerFreeze: false,
    powerCool: false,
    powerW: 43,
    monthKwh: 103,
    flexMode: 'CV_TTYPE_KIMCHI_COLD_18K',
    doorChangedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
  }
  return {
    demo: true,
    status: async () => ({ connected: true, linkedAt: new Date().toISOString(), state: structuredClone(state) }),
    connect: async () => {},
    disconnect: async () => {},
    send: async (c) => {
      if (c.kind === 'setpoint') state[c.zone].setpoint = c.value
      else state[c.kind] = c.on
    },
  }
}
