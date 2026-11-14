// 요리 표 점검: 이름 겹침, 모르는 재료 이름, 칸 수. `npm run check:recipes`
import { readFileSync } from 'node:fs'
const src = readFileSync(new URL('../src/lib/recipeData.ts', import.meta.url), 'utf8')
const lib = readFileSync(new URL('../src/lib/recipes.ts', import.meta.url), 'utf8')
const table = src.split('`')[1].split('\n').map((l) => l.trim()).filter(Boolean)
const staples = new Set([...lib.match(/new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]))
const known = new Set([...lib.matchAll(/^\s*\[(?:'([^']+)'|null),/gm)].map((m) => m[1]).filter(Boolean))
for (const s of staples) known.add(s)
const names = new Set()
let bad = 0
for (const line of table) {
  const f = line.split('|')
  if (f.length !== 4 || !['국', '반', '메', '밥', '면', '간'].includes(f[3])) { console.log('형식 오류:', line); bad++; continue }
  if (names.has(f[0])) { console.log('이름 겹침:', f[0]); bad++ }
  names.add(f[0])
  for (const k of [...f[1].split(','), ...f[2].split(',')].filter(Boolean).flatMap((x) => x.split('/')))
    if (!known.has(k)) { console.log(`모르는 재료 '${k}':`, f[0]); bad++ }
}
const stepSrc = readFileSync(new URL('../src/lib/recipeSteps.ts', import.meta.url), 'utf8')
const stepLines = stepSrc.split('`')[1].split('\n').map((l) => l.trim()).filter(Boolean)
const seen = new Set()
for (const l of stepLines) {
  const [n, st] = l.split('|')
  if (!names.has(n)) { console.log('조리 순서의 요리명이 요리 표에 없음:', n); bad++ }
  if (seen.has(n)) { console.log('조리 순서 이름 겹침:', n); bad++ }
  seen.add(n)
  if (!st || st.split(' / ').length < 2) { console.log('조리 순서가 너무 짧음:', n); bad++ }
}
console.log(`조리 순서 ${stepLines.length}개`)
console.log(`요리 ${table.length}개, 문제 ${bad}건`)
process.exit(bad ? 1 : 0)
