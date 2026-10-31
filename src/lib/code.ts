/** 집 코드를 4자리씩 끊어 읽기 쉽게: ABCD-EF12-3456 */
export function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code
}
