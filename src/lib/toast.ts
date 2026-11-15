/**
 * 아래(시트가 열려 있으면 위)에 잠깐 떠서 '되돌리기'를 건네는 한 줄.
 * 어디서든 showToast('...', { label, onClick }) 로 띄우고, Main 의 <ToastHost /> 가 그린다.
 */
export interface ToastAction {
  label: string
  onClick: () => void
}
export interface ToastMsg {
  text: string
  action?: ToastAction
  /** 보여 주는 시간(ms). 기본 4초 */
  ms?: number
}
type Listener = (t: ToastMsg) => void
const listeners = new Set<Listener>()

export const showToast = (text: string, action?: ToastAction, ms?: number) => listeners.forEach((l) => l({ text, action, ms }))

export function onToast(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
