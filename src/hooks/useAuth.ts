import { useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'

/** Fallback master password used until the Master sets a custom one. */
export const DEFAULT_MASTER_PASSWORD = 'MediCat15@'

/** The master password in effect: the value stored in app_settings, or the default. */
async function fetchMasterPassword(): Promise<string> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'master_password')
      .maybeSingle()
    return typeof data?.value === 'string' && data.value ? data.value : DEFAULT_MASTER_PASSWORD
  } catch {
    return DEFAULT_MASTER_PASSWORD
  }
}

export function useAuth() {
  const { isAuthenticated, authRole, makerLabel, setAuthenticated } = useAppStore()

  const login = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    // Check master password first (custom value if the Master set one, else default)
    const masterPassword = await fetchMasterPassword()
    if (password === masterPassword) {
      setAuthenticated(true, 'master', 'Dr. Alif')
      return { success: true }
    }

    // Check maker passwords in Supabase
    const { data: makers, error } = await supabase
      .from('maker_passwords')
      .select('*')
      .eq('active', true)

    if (error) {
      return { success: false, error: 'Could not verify password. Try again.' }
    }

    const match = makers?.find(m => m.password_hash === password)
    if (match) {
      // Check expiry
      if (match.expires_at && new Date(match.expires_at) < new Date()) {
        return { success: false, error: 'This password has expired. Contact Dr. Alif.' }
      }
      setAuthenticated(true, 'maker', match.label)
      return { success: true }
    }

    return { success: false, error: 'Incorrect password.' }
  }, [setAuthenticated])

  const logout = useCallback(() => {
    setAuthenticated(false)
  }, [setAuthenticated])

  const isMaster = authRole === 'master'
  const isMaker = authRole === 'maker'

  return { isAuthenticated, authRole, makerLabel, isMaster, isMaker, login, logout }
}
