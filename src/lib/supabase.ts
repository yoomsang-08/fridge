import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 환경변수가 없으면 null: 앱은 이 기기에만 저장하는 체험 모드로 동작 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
