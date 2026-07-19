import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MakerPassword } from '@/types'

export function useMakerPasswords() {
  const qc = useQueryClient()

  const { data: passwords, isLoading } = useQuery({
    queryKey: ['maker_passwords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maker_passwords')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as MakerPassword[]
    },
  })

  const createPassword = useMutation({
    mutationFn: async (payload: { password: string; label: string; expires_at?: string | null }) => {
      const { data, error } = await supabase
        .from('maker_passwords')
        .insert({
          password_hash: payload.password,
          label: payload.label,
          expires_at: payload.expires_at || null,
          active: true,
          created_by: 'master',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maker_passwords'] }),
  })

  const deactivatePassword = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('maker_passwords')
        .update({ active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maker_passwords'] }),
  })

  const deletePassword = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maker_passwords').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maker_passwords'] }),
  })

  return { passwords, isLoading, createPassword, deactivatePassword, deletePassword }
}
