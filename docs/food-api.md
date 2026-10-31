# 식품 검색 API 검토 (2단계 준비)

장 본 식품을 이름이나 바코드로 찾아 입력을 줄이기 위한 공공 API 검토 결과입니다.
작성: 2026-10-31

## 결론

| 용도 | 쓸 API | 판단 |
|---|---|---|
| **제품명 검색** | 식품안전나라 **I1250 식품(첨가물)품목제조보고** | 주력. 국내 제조 품목 전체, 제조사·식품유형·소비기한 문구가 있음 |
| 바코드 조회 1순위 | 식품안전나라 **C005 바코드연계제품정보** | 보조. **2018년 이후 갱신 중단** (유통물류진흥원 요청). 최근 제품은 대부분 안 나옴 |
| 바코드 조회 2순위 | **Open Food Facts** | 보조. 키 필요 없음, 한국 제품 수는 적음 |
| 못 찾으면 | 직접 입력 | 1단계의 자동완성(예전에 넣은 이름)이 그대로 동작 |

- 바코드만으로 최신 국내 제품을 확실히 찾는 무료 공공 API는 현재 없습니다. 바코드 원천 데이터(코리안넷, 대한상공회의소 유통물류진흥원)는 유료로 바뀌었습니다.
- 그래서 **이름 검색을 기본 입력 방식**으로 하고, 바코드 스캔은 "찾으면 좋고 못 찾으면 이름 검색으로 넘어가는" 보조 기능으로 두는 것을 권합니다.
- 소비기한은 제품에 찍힌 날짜가 정답입니다. API의 소비기한(POG_DAYCNT)은 "제조일로부터 12개월" 같은 **제조 기준 기간 문구**라서, 입력 화면에서 기본값 제안 정도로만 씁니다.

## 실제 호출 결과 (2026-10-31, 인증키로 확인)

- **I1250 이름 검색 정상** (`INFO-000`). "신라면" → 144건. 필드 이름은 아래 정리와 같고, 추가로 `LAST_UPDT_DTM`(최종수정, 2026년 자료까지 있음), `LCNS_NO`, `INDUTY_CD_NM`, `DISPOS`(성상), `USAGE`, `FRMLC_MTRQLT`(포장재질) 등이 옵니다.
  - 부분 일치 검색이고 순서가 제멋대로라 수출용 스프, 원료 분말 같은 업체용 품목이 먼저 나옵니다 → 프록시가 200건까지 받아 정확히 일치, 생산 중, 일반 제품 순으로 다시 정렬합니다.
  - `POG_DAYCNT` 예: "제조일로부터 12개월까지", "6개월", "제조일부터        14개월" (공백이 여러 칸 섞임)
- **C005 바코드: `INFO-110`** "인증키는 확인되었으나 해당 서비스의 활용신청 내역이 없습니다". **인증키는 하나지만 서비스마다 활용신청을 따로 해야 합니다.** 바코드를 쓰려면 C005(필요하면 I2570)도 활용신청이 필요합니다. 신청 전에도 프록시는 Open Food Facts 로 넘어가도록 했습니다.
- **C005 활용신청 후 정상** (`INFO-000`). 전체 259,837건. 신라면 바코드(8801043014809) → 공장별로 4건 ("신라면", "신(辛)라면"). `END_DT` 생산중단일, `CLSBIZ_DT` 폐업일이 있어 프록시가 살아 있는 것을 먼저, 같은 이름은 하나로 합칩니다. 최근 출시 제품이 나오는지는 실제 장 본 제품 바코드로 더 확인해야 합니다.
- **https 는 403**: `https://openapi.foodsafetykorea.go.kr` 는 막혀 있고 http 만 됩니다. GitHub Pages(https)에서 직접 부를 수 없으므로 프록시가 꼭 필요합니다.

## API별 정리

### I1250 식품(첨가물)품목제조보고 — 제품명 검색

- 주소: `http://openapi.foodsafetykorea.go.kr/api/{인증키}/I1250/json/{시작}/{끝}/PRDLST_NM={제품명}`
- 주요 필드: `PRDLST_NM` 제품명, `BSSH_NM` 제조사, `PRDLST_DCNM` 식품유형, `POG_DAYCNT` 소비기한 문구, `PRDLST_REPORT_NO` 품목보고번호, `PRMS_DT` 보고일, `PRODUCTION` 생산 여부
- 다른 검색 조건: `BSSH_NM`(제조사), `PRDLST_REPORT_NO`, `CHNG_DT`(변경일자)
- 국내 **제조** 품목만 있습니다. 수입식품, 정육·채소 같은 농축수산물 원물은 없습니다 → 이런 건 직접 입력.

### C005 바코드연계제품정보 — 바코드 조회

- 주소: `.../api/{인증키}/C005/json/1/5/BAR_CD={바코드}`
- 필드: I1250 과 같은 항목 + `BAR_CD` 바코드, `INDUTY_NM` 업종, `SITE_ADDR` 주소, `CLSBIZ_DT` 폐업일
- 공공데이터포털 안내문에 "2018년 이후 최신화 중단" 명시 ([공공데이터포털 15060549](https://www.data.go.kr/data/15060549/openapi.do)).
- 비슷한 I2570 유통바코드(`BRCD_NO=`)도 같은 이유로 2018년까지만 있습니다 ([15064775](https://www.data.go.kr/data/15064775/openapi.do)).

### Open Food Facts — 바코드 조회 보조

- 주소: `https://world.openfoodfacts.org/api/v2/product/{바코드}.json`
- 키 없음, CORS 허용, 누구나 편집하는 공개 DB. 한국 제품은 일부만 등록되어 있습니다.

### 참고: 식품영양성분 DB (공공데이터포털)

- 가공식품 이름·제조사·영양성분이 있고 https 를 지원하지만 소비기한 정보가 없어, I1250 이 안 될 때의 대안으로만 남겨 둡니다.

## 브라우저에서 바로 부를 수 없는 이유 → 프록시 필요

1. 인증키가 앱 코드(GitHub Pages 에 공개됨)에 그대로 들어갑니다.
2. 식품안전나라 Open API 는 `http` 로만 열려 있어(https 는 403) `https` 페이지(GitHub Pages)에서 부르면 mixed content 로 차단됩니다.
3. CORS 허용 헤더도 기대하기 어렵습니다.

그래서 **Supabase Edge Function** `food-search` 를 프록시로 둡니다. 키는 Supabase secret 에만 저장되고, 앱은 로그인한 상태에서만 이 함수를 부릅니다.
일부 공공 API 는 해외 IP 를 막기 때문에, 앱에서 부를 때 서울 리전(`ap-northeast-2`)에서 실행되도록 지정했습니다.

- 함수: `supabase/functions/food-search/index.ts`
  - `?q=신라면` → I1250 검색 (생산 중단 품목은 뒤로)
  - `?barcode=880...` → C005 → 없으면 Open Food Facts
  - 응답: `{ items: FoodProduct[] }` (소비기한 문구를 일수로 읽을 수 있으면 `shelfLifeDays` 포함)
- 앱 쪽: `src/lib/foodSearch.ts` 의 `searchFoodByName`, `searchFoodByBarcode`

## 인증키 발급 (식품안전나라)

1. [식품안전나라 데이터활용서비스](https://www.foodsafetykorea.go.kr/apiMain.do)에 회원가입 후 로그인
2. 상단 **인증키 신청** 에서 이용 목적(예: "가정용 냉장고 재고 관리 앱, 비상업")을 적고 신청
3. **마이페이지 → 인증키 발급 현황**에서 키 확인 (보통 바로 발급되지만, 늦어지면 승인까지 기다려야 할 수 있습니다)
4. 키는 하나지만, **쓰려는 서비스(I1250, C005 등)마다 해당 데이터 화면에서 활용신청을 따로** 해야 합니다. 안 하면 `INFO-110` 이 옵니다.

## 확인 순서

I1250 은 위처럼 실제 호출로 확인했습니다. C005 는 활용신청 후 아래 스크립트로 다시 확인하면 됩니다. Open Food Facts 는 아직 실제로 불러 보지 못했습니다.

```bash
# 인증키 없이: 샘플 데이터, https 지원 여부, CORS 헤더 확인
./scripts/check-food-api.sh

# 인증키 발급 후: 이름 검색, 바코드 조회, 바코드 데이터 최신 여부까지
./scripts/check-food-api.sh <인증키> 신라면 8801043014809
```

확인할 것: 결과 코드가 `INFO-000` 인지, 필드 이름이 위와 같은지, `POG_DAYCNT` 문구 형태, 최근 산 제품 바코드가 C005 에 있는지.

## 프록시 배포

```bash
npx supabase login
npx supabase link --project-ref <프로젝트 ref>
npx supabase secrets set FOODSAFETY_API_KEY=<인증키>
npx supabase functions deploy food-search
```

배포 후 확인 (anon key 는 `.env` 의 값):

```bash
curl "https://<프로젝트 ref>.supabase.co/functions/v1/food-search?q=신라면" \
  -H "Authorization: Bearer <anon key>"
```
