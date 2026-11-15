# 요리 추천 좋아요·싫어요

식단표 > 적기 창 > '곧 기한이 되는 재료로 만들 요리' 의 각 요리에 엄지(좋아요·싫어요)를 누를 수 있다.

## 동작 (가정)
- **집 단위로 공유**: 식구 누구든 누르면 모두에게 같게 적용. 요리 이름당 하나(좋아요 또는 싫어요). 같은 엄지를 다시 누르면 지워진다.
- **싫어요**: 추천에서 바로 빠진다. 누른 직후 6초 동안 '되돌리기'가 뜬다.
- **좋아요**: 표시만 하고, 점수를 `UP_BONUS`(1.2) 만큼 올려 비슷한 요리끼리 있을 때 먼저 보이게 한다. 임박 재료 하나의 점수(1.5~4)보다 작아서, 좋아요가 임박 재료 쓰는 요리를 밀어내지는 않는다.
- **모아 보기·되돌리기**: 적기 창 아래 '표시한 요리 N개 보기', 그리고 설정 > '요리 추천 좋아요·싫어요'.
- 저장: `recipe_reactions` 테이블(마이그레이션 0027). 체험 모드는 브라우저에만 저장.

## 요리 데이터 갱신 때 싫어요 요리 빼기
1. 설정 > '요리 추천 좋아요·싫어요' > **날릴 요리 목록 복사** (한 줄에 이름 하나). 또는 SQL Editor 에서
   `select recipe_name from recipe_reactions where reaction = 'down' order by 1;`
2. 복사한 것을 파일(예: `dislikes.txt`)로 저장.
3. 미리보기: `node scripts/prune-recipes.mjs dislikes.txt`
4. 적용: `node scripts/prune-recipes.mjs dislikes.txt --apply` (`recipeData.ts`·`recipeSteps.ts` 에서 줄 삭제)
5. 빠진 만큼 새 요리를 `recipeData.ts` 에 더하고 `npm run check:recipes` 로 점검.
6. 배포 후, 빠진 요리의 표시는 SQL 로 정리해도 된다: `delete from recipe_reactions where reaction = 'down';` (남겨 두어도 추천에는 영향 없음)
