import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { downloadBackup, listBackups, type BackupInfo } from '../lib/backup'
import { supabase } from '../lib/supabase'
import { Button, Card } from './ui'

const dateLabel = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 주 1회 자동 백업 상태와 지금 데이터 파일로 받기 */
export function BackupSettings({ householdId }: { householdId: string }) {
  const [backups, setBackups] = useState<BackupInfo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (supabase) listBackups(supabase, householdId).then(setBackups, () => setBackups([]))
  }, [householdId])

  if (!supabase) return null
  const sb = supabase
  const last = backups?.[0]

  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      await downloadBackup(sb, householdId)
    } catch {
      setError('파일을 만들지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-extrabold">백업</h2>
      <p className="mt-1 text-sm text-muted">
        매주 월요일 새벽에 자동으로 백업하고 최근 8주치를 보관해요.
        {last && ` 마지막 백업은 ${dateLabel(last.taken_at)}이에요.`}
      </p>
      <Button variant="ghost" size="md" className="mt-3" disabled={busy} onClick={download}>
        <Download size={16} />
        {busy ? '만드는 중…' : '지금 데이터 파일로 받기'}
      </Button>
      {error && <p className="mt-3 rounded-xl bg-expired-soft p-3 text-sm text-expired">{error}</p>}
    </Card>
  )
}
