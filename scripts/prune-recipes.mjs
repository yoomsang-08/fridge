// 싫어요한 요리를 요리 데이터에서 뺀다. 먼저 미리보기만, `--apply` 를 붙여야 파일을 고친다.
//   node scripts/prune-recipes.mjs 날릴요리.txt            (미리보기)
//   node scripts/prune-recipes.mjs 날릴요리.txt --apply    (recipeData.ts · recipeSteps.ts 에서 삭제)
// 날릴요리.txt: 한 줄에 요리 이름 하나 (설정 > '날릴 요리 목록 복사' 로 복사한 그대로)
import { readFileSync, writeFileSync } from 'node:fs'
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const file = args.find((a) => !a.startsWith('--'))
if (!file) { console.log('사용법: node scripts/prune-recipes.mjs 날릴요리.txt [--apply]'); process.exit(1) }
const names = new Set(readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean))
const targets = ['recipeData.ts', 'recipeSteps.ts'].map((f) => new URL(`../src/lib/${f}`, import.meta.url))
const found = new Set()
for (const url of targets) {
  const src = readFileSync(url, 'utf8')
  const [head, table, tail] = src.split('`')
  const kept = []
  for (const line of table.split('\n')) {
    const name = line.trim().split('|')[0]
    if (line.trim() && names.has(name)) { found.add(name); continue }
    kept.push(line)
  }
  const removed = table.split('\n').length - kept.length
  console.log(`${url.pathname.split('/').pop()}: ${removed}줄 ${apply ? '삭제' : '삭제 예정'}`)
  if (apply) writeFileSync(url, [head, kept.join('\n'), tail].join('`'))
}
const missing = [...names].filter((n) => !found.has(n))
if (missing.length) console.log('표에 없는 이름(이미 뺐거나 오타):', missing.join(', '))
console.log(apply ? '끝. npm run check:recipes 로 점검하고, 빠진 만큼 새 요리를 더해 주세요.' : '미리보기만 했어요. 고치려면 --apply')
