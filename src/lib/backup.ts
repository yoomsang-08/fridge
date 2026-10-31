import type { SupabaseClient } from '@supabase/supabase-js'

export interface BackupInfo {
  id: number
  taken_at: string
}

/** 최근 자동 백업 목록 (0010 전이면 빈 목록) */
export async function listBackups(sb: SupabaseClient, householdId: string): Promise<BackupInfo[]> {
  const { data } = await sb
    .from('backups')
    .select('id, taken_at')
    .eq('household_id', householdId)
    .order('taken_at', { ascending: false })
  return (data ?? []) as BackupInfo[]
}

/** 지금 데이터 전체를 자동 백업과 같은 모양으로 */
async function snapshot(sb: SupabaseClient, householdId: string) {
  const all = (table: string, columns = '*') => sb.from(table).select(columns).eq('household_id', householdId)
  const [h, m, f, c, i, k, n] = await Promise.all([
    sb.from('households').select('id, name').eq('id', householdId).single(),
    all('household_members', 'user_id, display_name'),
    all('fridges'),
    all('compartments'),
    all('items'),
    all('categories'),
    all('notes'),
  ])
  for (const r of [h, m, f, c, i]) if (r.error) throw r.error
  return {
    version: 1,
    household: h.data,
    members: m.data,
    fridges: f.data,
    compartments: c.data,
    items: i.data,
    categories: k.data ?? [],
    notes: n.data ?? [],
  }
}

/** 지금 데이터를 JSON 파일로 내려받기 */
export async function downloadBackup(sb: SupabaseClient, householdId: string): Promise<void> {
  const data = await snapshot(sb, householdId)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `냉장고-백업-${stamp}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
