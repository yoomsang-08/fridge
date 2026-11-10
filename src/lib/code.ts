/** 집 코드를 4자리씩 끊어 읽기 쉽게: ABCD-EF12-3456 */
export function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code
}

/** 한글 자판(2벌식)으로 친 a~f: ㅁ=a ㅠ=b ㅊ=c ㅇ=d ㄷ=e ㄹ=f. 집 코드는 0~9, A~F 뿐이라 겹치지 않는다 */
const JAMO_TO_HEX: Record<string, string> = { ㅁ: 'A', ㅠ: 'B', ㅊ: 'C', ㅇ: 'D', ㄷ: 'E', ㄹ: 'F' }

/**
 * 사람이 넣은 집 코드를 서버가 아는 모양(대문자 영숫자 12자리)으로 고친다.
 * 아이패드처럼 한글 자판이 켜져 있거나, 붙여 넣을 때 전각 문자·공백·하이픈이 섞여도 받아 준다.
 * 코드는 16진수(0~9, A~F)라서 O→0, I·L→1 로 헷갈려 쓴 것도 바로잡는다.
 */
export function normalizeCode(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[ㅁㅠㅊㅇㄷㄹ]/g, (c) => JAMO_TO_HEX[c])
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .slice(0, 12)
}
