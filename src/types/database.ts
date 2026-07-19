export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      maker_passwords: {
        Row: {
          id: string
          password_hash: string
          label: string
          expires_at: string | null
          active: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          password_hash: string
          label: string
          expires_at?: string | null
          active?: boolean
          created_by?: string
          created_at?: string
        }
        Update: {
          id?: string
          password_hash?: string
          label?: string
          expires_at?: string | null
          active?: boolean
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          id: string
          name: string
          categories: string[]
          secret: boolean
          allowed_wards: string[]
          cath_eligible: boolean
          cath_quota: number
          target: number
          night_target: number
          opd_min: number
          opd_max: number | null
          duty_start_date: string | null
          duty_end_date: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          categories?: string[]
          secret?: boolean
          allowed_wards?: string[]
          cath_eligible?: boolean
          cath_quota?: number
          target?: number
          night_target?: number
          opd_min?: number
          opd_max?: number | null
          duty_start_date?: string | null
          duty_end_date?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          categories?: string[]
          secret?: boolean
          allowed_wards?: string[]
          cath_eligible?: boolean
          cath_quota?: number
          target?: number
          night_target?: number
          opd_min?: number
          opd_max?: number | null
          duty_start_date?: string | null
          duty_end_date?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      wards: {
        Row: {
          id: string
          name: string
          group_name: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          group_name?: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          group_name?: string
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      stations: {
        Row: {
          id: string
          shift: string
          label: string
          wards: string[]
          needed: number
          created_at: string
        }
        Insert: {
          id?: string
          shift: string
          label: string
          wards: string[]
          needed?: number
          created_at?: string
        }
        Update: {
          id?: string
          shift?: string
          label?: string
          wards?: string[]
          needed?: number
          created_at?: string
        }
        Relationships: []
      }
      demands: {
        Row: {
          id: string
          doctor_id: string
          kind: string
          scope: string
          shift: string | null
          pair: string | null
          ward_name: string | null
          day_of_week: number | null
          date: number | null
          start_date: string | null
          end_date: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          doctor_id: string
          kind: string
          scope: string
          shift?: string | null
          pair?: string | null
          ward_name?: string | null
          day_of_week?: number | null
          date?: number | null
          start_date?: string | null
          end_date?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          doctor_id?: string
          kind?: string
          scope?: string
          shift?: string | null
          pair?: string | null
          ward_name?: string | null
          day_of_week?: number | null
          date?: number | null
          start_date?: string | null
          end_date?: string | null
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          id: string
          date: number
          label: string
          year: number | null
          month: number | null
          created_at: string
        }
        Insert: {
          id?: string
          date: number
          label: string
          year?: number | null
          month?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          date?: number
          label?: string
          year?: number | null
          month?: number | null
          created_at?: string
        }
        Relationships: []
      }
      roster_snapshots: {
        Row: {
          id: string
          year: number
          month: number
          days: number
          roster: Json
          effective_stations: Json | null
          warnings: string[] | null
          notes: string | null
          generated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          year: number
          month: number
          days: number
          roster: Json
          effective_stations?: Json | null
          warnings?: string[] | null
          notes?: string | null
          generated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          year?: number
          month?: number
          days?: number
          roster?: Json
          effective_stations?: Json | null
          warnings?: string[] | null
          notes?: string | null
          generated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      duty_bank: {
        Row: {
          id: string
          month_key: string
          doctor_id: string
          base_target: number
          effective_target: number
          assigned: number
          balance: number
          created_at: string
        }
        Insert: {
          id?: string
          month_key: string
          doctor_id: string
          base_target: number
          effective_target: number
          assigned: number
          balance: number
          created_at?: string
        }
        Update: {
          id?: string
          month_key?: string
          doctor_id?: string
          base_target?: number
          effective_target?: number
          assigned?: number
          balance?: number
          created_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
