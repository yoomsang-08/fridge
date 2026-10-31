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
- 홈 화면에 설치(PWA), 두 기기 실시간 동기화

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
4. **Authentication → Providers → Google** 활성화 (Google Cloud Console 에서 OAuth 클라이언트 생성 후 Client ID/Secret 입력)
5. **Authentication → URL Configuration** 의 Site URL / Redirect URLs 에 배포 주소와 `http://localhost:5173` 추가

처음 로그인한 사람이 "우리 집 만들기"를 누르고, 설정 화면의 초대코드를 배우자에게 전달하면 배우자는 "초대코드로 합류하기"로 같은 냉장고를 공유합니다.

## 배포

`main` 에 머지되면 GitHub Actions 가 GitHub Pages 로 배포합니다: https://yoomsang-08.github.io/fridge/

처음 한 번은 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿔야 합니다.

## 다음 단계

- 2단계: 식품안전나라 API 연동(이름 검색, 바코드 스캔), 매일 아침 임박 알림
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
