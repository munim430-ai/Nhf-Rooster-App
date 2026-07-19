import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Fallback to the project's public URL/anon key if the VITE_ env vars aren't
// injected at build time (e.g. Vercel Project Settings not yet configured).
// The anon key is safe to expose client-side by design.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bonxvzzmozahvnxsojwl.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbnh2enptb3phaHZueHNvandsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NzMxMTQsImV4cCI6MjEwMDA0OTExNH0.hGsOZ8dDBsX1bdgPnYfmzsWVbLpZ9NSCGctkifbc5XA'

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
