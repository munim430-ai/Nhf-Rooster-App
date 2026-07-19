import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export type Tables = Database['public']['Tables']

// Helper to check if Supabase is reachable
export async function healthCheck(): Promise<boolean> {
  try {
    const { error } = await supabase.from('wards').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}
