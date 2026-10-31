#!/usr/bin/env bash
# 식품안전나라 Open API 연결 확인
#
#   ./scripts/check-food-api.sh                 인증키 없이 샘플 데이터만 확인
#   ./scripts/check-food-api.sh 인증키          실제 검색까지 확인
#   ./scripts/check-food-api.sh 인증키 신라면 8801043014809
#
# python3 와 curl 만 있으면 됩니다 (macOS 기본 포함).

KEY="${1:-}"
NAME="${2:-신라면}"
BARCODE="${3:-8801043014809}"
ORIGIN="https://yoomsang-08.github.io"

enc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$1"; }

# 응답 JSON 에서 결과 코드, 전체 건수, 앞의 몇 건을 뽑아 보여준다
summary() {
  python3 -c '
import sys, json
svc = sys.argv[1]
raw = sys.stdin.read()
try:
    body = json.loads(raw)
except Exception:
    print("   JSON 아님:", raw[:200].replace("\n", " ")); sys.exit()
data = body.get(svc, body)
res = data.get("RESULT", {})
print("   결과:", res.get("CODE"), res.get("MSG"), "| 전체", data.get("total_count"), "건")
rows = data.get("row") or []
if rows:
    print("   필드:", ", ".join(rows[0].keys()))
for r in rows[:3]:
    print("   -", r.get("PRDLST_NM"), "|", r.get("BSSH_NM"), "|", r.get("POG_DAYCNT"), "|", r.get("BAR_CD", ""), "|", r.get("PRMS_DT", ""))
' "$1"
}

req() { # 이름 서비스 URL
  echo "== $1 ($2)"
  if [ -n "$KEY" ]; then echo "   ${3//$KEY/<인증키>}"; else echo "   $3"; fi
  local headers body
  headers=$(mktemp)
  body=$(curl -sS -m 20 -D "$headers" -H "Origin: $ORIGIN" "$3") || { echo "   연결 실패"; rm -f "$headers"; return; }
  echo "   HTTP: $(head -1 "$headers" | tr -d '\r')"
  local cors
  cors=$(grep -i '^access-control-allow-origin' "$headers" | tr -d '\r')
  echo "   CORS: ${cors:-없음 (브라우저에서 직접 호출 불가)}"
  echo "$body" | summary "$2"
  rm -f "$headers"
}

for scheme in https http; do
  req "샘플 $scheme" C005 "$scheme://openapi.foodsafetykorea.go.kr/api/sample/C005/json/1/3"
done
req "샘플" I1250 "http://openapi.foodsafetykorea.go.kr/api/sample/I1250/json/1/3"

if [ -z "$KEY" ]; then
  echo
  echo "인증키를 넣으면 실제 검색도 확인합니다: $0 <인증키>"
  exit 0
fi

N=$(enc "$NAME")
req "제품명 검색 '$NAME'" I1250 "http://openapi.foodsafetykorea.go.kr/api/$KEY/I1250/json/1/5/PRDLST_NM=$N"
req "바코드 조회 $BARCODE" C005 "http://openapi.foodsafetykorea.go.kr/api/$KEY/C005/json/1/5/BAR_CD=$BARCODE"
req "바코드 최근 등록분 (데이터 신선도)" C005 "http://openapi.foodsafetykorea.go.kr/api/$KEY/C005/json/1/3"
req "유통바코드 $BARCODE" I2570 "http://openapi.foodsafetykorea.go.kr/api/$KEY/I2570/json/1/5/BRCD_NO=$BARCODE"

echo "== Open Food Facts $BARCODE"
curl -sS -m 20 "https://world.openfoodfacts.org/api/v2/product/$BARCODE.json?fields=product_name,product_name_ko,brands,quantity" | head -c 400
echo
