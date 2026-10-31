/**
 * 화면 위쪽에 3초 떠올랐다 사라지는 이스터에그 한 줄 (docs/design.md 이스터에그 절).
 * 어디서든 eggToast('...') 로 띄우고, Main 의 <EggToast /> 가 그린다.
 */
type Listener = (text: string) => void
const listeners = new Set<Listener>()

export const eggToast = (text: string) => listeners.forEach((l) => l(text))

export function onEggToast(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** 오늘(한국 시간) '다 먹음' 몇 번째인지 센다. 열 번째에 정리왕 */
const CLEAN_KEY = 'fridge-clean-count-v1'
export function countCleanup(today: string): number {
  let s = { day: today, n: 0 }
  try {
    const v = JSON.parse(localStorage.getItem(CLEAN_KEY) ?? '')
    if (v?.day === today) s = v
  } catch {
    /* 처음이면 0부터 */
  }
  s.n += 1
  localStorage.setItem(CLEAN_KEY, JSON.stringify(s))
  return s.n
}

/** 짧은 시간에 몇 번 일어났는지 (문 여닫기 이스터에그) */
export function burst(times: number[], now: number, windowMs: number, count: number): boolean {
  times.push(now)
  while (times.length && now - times[0] > windowMs) times.shift()
  if (times.length >= count) {
    times.length = 0
    return true
  }
  return false
}
