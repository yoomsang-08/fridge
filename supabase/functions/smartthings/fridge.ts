// 스마트싱스 냉장고 응답을 앱이 쓰는 모양으로 줄이고, 보낼 수 있는 명령을 정한다.
// Edge Function(Deno)과 앱(Vite) 양쪽에서 함께 import 하므로 외부 의존성을 두지 않는다.

export type Zone = 'cooler' | 'freezer'

export interface ZoneState {
  /** 현재 온도 °C */
  current: number | null
  /** 설정 온도 °C */
  setpoint: number | null
  min: number
  max: number
  doorOpen: boolean | null
}

export interface FridgeState {
  label: string
  cooler: ZoneState
  freezer: ZoneState
  /** 냉장고 전체 문(어느 한 곳이라도 열리면 true) */
  doorOpen: boolean | null
  powerFreeze: boolean | null
  powerCool: boolean | null
  /** 지금 소비 전력 W */
  powerW: number | null
  /** 이번 달 사용량 kWh */
  monthKwh: number | null
  /** 변온실 모드 코드 (예: CV_TTYPE_KIMCHI_COLD_18K) */
  flexMode: string | null
  /** 문이 마지막으로 열리거나 닫힌 시각 */
  doorChangedAt: string | null
}

export type FridgeCommand =
  | { kind: 'setpoint'; zone: Zone; value: number }
  | { kind: 'powerFreeze' | 'powerCool'; on: boolean }

/** 기기가 범위를 알려주지 않을 때 쓰는 기본값 (RF85 계열) */
const DEFAULT_RANGE: Record<Zone, [number, number]> = { cooler: [0, 5], freezer: [-23, -17] }

export const FLEX_MODE_LABEL: Record<string, string> = {
  CV_TTYPE_FREEZER_18K: '냉동',
  CV_TTYPE_SOFT_FREEZER_18K: '소프트 냉동',
  CV_TTYPE_COOL_18K: '냉장',
  CV_TTYPE_RF9000A_BEER_WHITEWINE: '맥주·화이트와인',
  CV_TTYPE_KIMCHI_COLD_18K: '김치 (차갑게)',
  CV_TTYPE_KIMCHI_NORMAL_18K: '김치 (보통)',
  CV_TTYPE_KIMCHI_WARM_18K: '김치 (익히기)',
}

// deno-lint-ignore no-explicit-any
type Json = any

const num = (v: Json): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const contactOpen = (c: Json): boolean | null => {
  const v = c?.contactSensor?.contact?.value
  return v === 'open' ? true : v === 'closed' ? false : null
}

function zone(c: Json, z: Zone): ZoneState {
  const range = c?.thermostatCoolingSetpoint?.coolingSetpointRange?.value
  return {
    current: num(c?.temperatureMeasurement?.temperature?.value),
    setpoint: num(c?.thermostatCoolingSetpoint?.coolingSetpoint?.value),
    min: num(range?.minimum) ?? num(c?.['custom.thermostatSetpointControl']?.minimumSetpoint?.value) ?? DEFAULT_RANGE[z][0],
    max: num(range?.maximum) ?? num(c?.['custom.thermostatSetpointControl']?.maximumSetpoint?.value) ?? DEFAULT_RANGE[z][1],
    doorOpen: contactOpen(c),
  }
}

/** GET /devices/{id}/status 응답에서 필요한 값만 뽑는다. 시리얼·Wi-Fi 정보 같은 건 버린다 */
export function toFridgeState(status: Json, label: string): FridgeState {
  const c = status?.components ?? {}
  const main = c.main ?? {}
  const cooler = zone(c.cooler, 'cooler')
  const freezer = zone(c.freezer, 'freezer')
  const doors = [contactOpen(main), cooler.doorOpen, freezer.doorOpen].filter((d) => d !== null)
  const doorStamps = [main, c.cooler, c.freezer]
    .map((x) => x?.contactSensor?.contact?.timestamp as string | undefined)
    .filter((t): t is string => !!t)
    .sort()
  const wh = num(main['samsungce.energyManagement']?.thisMonthEnergyConsumption?.value)
  const bool = (v: Json) => (typeof v === 'boolean' ? v : null)
  return {
    label,
    cooler,
    freezer,
    doorOpen: doors.length ? doors.some(Boolean) : null,
    powerFreeze: bool(main['samsungce.powerFreeze']?.activated?.value),
    powerCool: bool(main['samsungce.powerCool']?.activated?.value),
    powerW: num(main.powerConsumptionReport?.powerConsumption?.value?.power),
    monthKwh: wh === null ? null : Math.round(wh / 100) / 10,
    flexMode: c.cvroom?.['custom.fridgeMode']?.fridgeMode?.value ?? null,
    doorChangedAt: doorStamps.at(-1) ?? null,
  }
}

/**
 * 앱에서 온 명령을 확인하고 스마트싱스 명령으로 바꾼다. 허용 목록 밖이거나 범위를 벗어나면 null.
 * 범위는 기기가 알려준 값(state)으로 다시 검사한다.
 */
export function toSmartThingsCommand(cmd: Json, state: FridgeState | null) {
  if (cmd?.kind === 'setpoint' && (cmd.zone === 'cooler' || cmd.zone === 'freezer')) {
    const z: Zone = cmd.zone
    const [min, max] = state ? [state[z].min, state[z].max] : DEFAULT_RANGE[z]
    if (!Number.isInteger(cmd.value) || cmd.value < min || cmd.value > max) return null
    return { component: z, capability: 'thermostatCoolingSetpoint', command: 'setCoolingSetpoint', arguments: [cmd.value] }
  }
  if ((cmd?.kind === 'powerFreeze' || cmd?.kind === 'powerCool') && typeof cmd.on === 'boolean') {
    return {
      component: 'main',
      capability: `samsungce.${cmd.kind}`,
      command: cmd.on ? 'activate' : 'deactivate',
      arguments: [],
    }
  }
  return null
}

/** 기기 목록에서 냉장고 하나를 고른다 */
export function findRefrigerator(items: Json[]): { deviceId: string; label: string } | null {
  const d = items.find((d) =>
    (d?.components ?? []).some((x: Json) => (x?.categories ?? []).some((c: Json) => c?.name === 'Refrigerator')),
  )
  return d ? { deviceId: d.deviceId, label: d.label ?? d.name ?? '냉장고' } : null
}
