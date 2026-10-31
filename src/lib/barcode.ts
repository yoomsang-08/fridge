/** 식품 포장에 쓰이는 1차원 바코드 */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const

export interface Detector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>
}

interface DetectorClass {
  new (options: { formats: string[] }): Detector
  getSupportedFormats(): Promise<readonly string[]>
}

/**
 * 안드로이드 크롬처럼 브라우저에 BarcodeDetector 가 있으면 그것을 쓰고,
 * 없으면(아이폰 사파리, PC) zxing wasm 으로 같은 기능을 채운다.
 * wasm(약 1MB)은 처음 스캔할 때만 받는다.
 */
export async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats()
      const formats = FORMATS.filter((f) => supported.includes(f))
      if (formats.length > 0) return new Native({ formats })
    } catch {
      // 지원 목록 조회가 실패하면 wasm 으로
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  // 기본값인 jsDelivr CDN 대신 앱과 함께 배포한 파일을 쓴다
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  })
  return new BarcodeDetector({ formats: [...FORMATS] })
}

/** 8~14자리 숫자만 바코드로 인정 */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 14 ? digits : null
}
