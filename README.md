# 냉장고를 부탁해 🧊

우리 집 냉장고의 식료품 재고와 유통기한/소비기한을 관리하는 웹앱(PWA)입니다. 폰과 PC 모두에서 쓰고, 부부가 같은 냉장고를 실시간으로 공유합니다.

## 현재 기능 (1단계)

- 냉장고 등록: 삼성 비스포크 4도어(RF85 계열), 쿠쿠 스탠드 냉동고 133L 칸 구성 템플릿, 직접 구성
- 칸 편집: 이름 변경, 추가, 삭제
- 식품 넣기: 칸 선택 → 이름(예전 입력 자동완성) → 분류 → 수량/단위 → 소비기한/유통기한 (빠른 버튼 +3일, +1주, +1달 …)
- "저장하고 계속 넣기"로 장 본 물건을 연속 입력, 마지막에 쓴 칸 기억
- 재고 목록: 기한순 / 칸별 보기, 냉장고별 필터, 검색
- 임박 표시: 기한 지남(빨강), 3일 이내(주황), 7일 이내(노랑)
- −1 사용, 다 먹음, 버림 기록
- 홈 화면에 설치(PWA), 우리 집 코드로 여러 기기 실시간 공유
- 식품안전나라 제품 검색: 이름을 치면 제품 후보(제조사, 식품유형, 소비기한 문구), 📷 바코드로 카메라 스캔 또는 숫자 입력 → 이름·분류·소비기한 제안 채우기 (아래 "식품 검색 켜기" 필요)

## 실행

```bash
npm install
npm run dev
```

`.env` 가 없으면 **체험 모드**로 동작합니다(이 브라우저에만 저장, 로그인 없음).

## Supabase 연결

1. [Supabase](https://supabase.com/dashboard)에서 프로젝트 생성 (Region: Northeast Asia (Seoul))
2. **SQL Editor** 에 `supabase/migrations/0001_init.sql` 내용을 붙여넣고 실행
3. **Project Settings → API** 에서 Project URL 과 anon(publishable) key 를 복사해 `.env` 작성 (`cp .env.example .env`)
4. 이어서 `supabase/migrations/0002_code_access.sql` 도 실행
5. **Authentication → Sign In / Providers** 에서 **Allow anonymous sign-ins** 켜기
6. 냉장고 문 메모를 쓰려면 `supabase/migrations/0003_notes.sql` 도 실행
7. 분류를 우리 집마다 관리하고 용기(3D 모양)·식품유형을 저장하려면 `supabase/migrations/0007_categories.sql` 도 실행. 실행 전에도 앱은 기본 분류 12종으로 동작합니다. 팬트리(실온 보관 공간)를 추가하려면 이 파일이 먼저 실행돼 있어야 합니다 (칸 종류에 `pantry` 허용)

로그인 화면은 없습니다. 각 기기는 익명 계정으로 자동 접속하고, 처음 한 번 **우리 집 코드**(12자리)를 넣어야 데이터가 열립니다. 첫 기기에서 "우리 집 새로 만들기"를 누르면 설정 화면에 코드가 나옵니다.

## 스마트싱스 냉장고 연결 (냉장고 탭)

냉장고 탭 맨 위 **냉장고 상태** 카드에서 삼성 냉장고의 냉장·냉동 온도, 문 상태, 이번 달 전기 사용량을 보고 급속냉동·급속냉장을 켜거나 설정 온도를 바꿉니다. 체험 모드에서는 예시 값이 보입니다.

스마트싱스 토큰은 브라우저에 두지 않고 Supabase Edge Function 이 대신 보관·호출합니다.

1. **SQL Editor** 에서 `supabase/migrations/0004_smartthings.sql` 실행
2. Edge Function 배포: 저장소 Secrets 에 `SUPABASE_ACCESS_TOKEN` 을 한 번 넣으면, `supabase/functions` 가 바뀌어 main 에 머지될 때마다 GitHub Actions(`supabase-functions.yml`)가 모든 함수를 배포합니다. 바로 배포하려면 Actions 탭에서 **Deploy Supabase Edge Functions → Run workflow**
3. 앱 **냉장고** 탭의 냉장고 상태 → **연결** 에서 [스마트싱스 토큰](https://account.smartthings.com/tokens)을 붙여 넣고 연결 (Devices 권한 모두 체크)

개인 토큰(PAT)은 24시간이면 만료됩니다. 만료 없이 쓰려면 **삼성 계정으로 연결(OAuth)** 을 설정하세요.

### 삼성 계정으로 연결 (만료 없음)

1. SQL Editor 에서 `supabase/migrations/0006_smartthings_oauth.sql` 실행
2. 맥에서 SmartThings CLI 로 OAuth 앱 등록 (`npm i -g @smartthings/cli` → `smartthings apps:create` → OAuth-In App)
   - Scopes: `r:devices:*`, `x:devices:*`
   - Redirect URI: `https://aiwqfqfswuehxqferrpn.supabase.co/functions/v1/smartthings`
3. 나온 OAuth Client Id / Secret 을 저장소 Secrets 에 `SMARTTHINGS_CLIENT_ID`, `SMARTTHINGS_CLIENT_SECRET` 으로 추가하고 **Deploy Supabase Edge Functions** 실행
4. 앱 냉장고 상태 → **삼성 계정으로 연결**

서버가 접근 토큰(24시간)을 갱신 토큰으로 알아서 바꿔 씁니다. 갱신 토큰은 29일 동안 안 쓰면 끊기므로 `smartthings-keepalive.yml` 이 매주 한 번 갱신합니다.

## 배포

`main` 에 머지되면 GitHub Actions 가 GitHub Pages 로 배포합니다: https://yoomsang-08.github.io/fridge/

처음 한 번은 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿔야 합니다.

## 식품 검색 켜기

식품안전나라 API 는 브라우저에서 바로 부를 수 없어 Supabase Edge Function 을 중계 서버로 씁니다. 자세한 내용은 `docs/food-api.md`.

1. [식품안전나라 데이터활용서비스](https://www.foodsafetykorea.go.kr/apiMain.do)에서 인증키 발급, **I1250**(품목제조보고)과 **C005**(바코드연계제품정보) 각각 활용신청
2. 배포 (Supabase 로그인 한 번 필요):

```bash
npx supabase login
npx supabase link --project-ref <프로젝트 ref>
npx supabase secrets set FOODSAFETY_API_KEY=<인증키>
npx supabase functions deploy food-search
```

배포 전에는 검색 결과가 비어 있고, 바코드는 "못 찾았어요"로 나오며 직접 입력은 그대로 됩니다.

## 알림 (웹 푸시)

- 설정 → **알림**을 켠 기기에, **아침 기한 알림**을 켜 두면 고른 시각(기본 오전 8시)에 '오늘까지 · 3일 안에 · 기한 지남' 식품을 알려 줍니다. 기기마다 따로 정합니다. 아이폰은 홈 화면에 추가한 앱에서만 받을 수 있습니다.
- 예약 실행은 Supabase 예약 작업(pg_cron, `0009_hardening.sql`)이 매시 정각에 돌고, 그 시각을 고른 기기에만 보냅니다. Actions → Morning expiry digest → Run workflow 로 바로 시험해 볼 수 있습니다(시각과 상관없이 모두에게).
- 구성: `push_subscriptions` 테이블(0005), 공용 헬퍼 `supabase/functions/_shared/push.ts` 의 `sendToHousehold()`, 아침 알림 함수 `expiry-digest`, 예약 작업 `cron.job` 'expiry-digest'(0009), 시험용 수동 실행 `.github/workflows/expiry-digest.yml`, 서비스워커 수신 `public/push-sw.js`.
- 다른 알림을 보낼 함수는 `sendToHousehold(hid, { title, body, url, tag }, { onlyDisplayNames, onlyUserIds, excludeUserIds })` 만 부르면 됩니다.
- 서명 키(VAPID)는 처음 알림을 켤 때 `push-key` 함수가 만들어 `push_config` 테이블(service role 전용)에 저장합니다. 저장소에 넣을 키는 없습니다.
- 따로 넣을 Secret 은 없습니다. 아침 알림 호출 확인값(`CRON_SECRET`)은 두 워크플로가 `SUPABASE_ACCESS_TOKEN` 에서 같은 방식으로 만들어 씁니다. 직접 정하고 싶으면 저장소 Secret `CRON_SECRET` 에 넣으면 그 값을 씁니다.

## 다음 단계

- 2단계 남은 것: 매일 아침 임박 알림
- 3단계: 2D 냉장고 그림 뷰 (정면/문 안쪽)
- 4단계: 3D 냉장고 렌더링

## 구조

```
src/
  lib/
    types.ts         데이터 타입
    templates.ts     냉장고 모델별 칸 구성
    expiry.ts        D-day 계산, 임박 단계
    repo.ts          데이터 저장소 (Supabase / 체험 모드)
  components/
    Main.tsx         메인 화면
    InventoryList    재고 목록
    ItemSheet        식품 넣기/수정
    Settings         냉장고·칸 편집, 초대코드
supabase/migrations  데이터베이스 스키마와 권한
```
