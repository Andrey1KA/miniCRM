import type { TaskStatus, UserRole } from './domain.ts'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: UserRole
          created_at: string
        }
        Insert: {
          id: string
          full_name: string
          role: UserRole
          created_at?: string
        }
        Update: {
          full_name?: string
          role?: UserRole
          created_at?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          id: string
          title: string
          address: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          address: string
          created_by?: string
          created_at?: string
        }
        Update: {
          title?: string
          address?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          object_id: string
          title: string
          description: string
          assignee_id: string
          author_id: string
          status: TaskStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          object_id: string
          title: string
          description?: string
          assignee_id: string
          author_id?: string
          status?: TaskStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          object_id?: string
          title?: string
          description?: string
          assignee_id?: string
          status?: TaskStatus
          updated_at?: string
        }
        Relationships: []
      }
      task_status_history: {
        Row: {
          id: string
          seq: number
          task_id: string
          changed_by: string
          from_status: TaskStatus | null
          to_status: TaskStatus
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          changed_by: string
          from_status?: TaskStatus | null
          to_status: TaskStatus
          comment?: string | null
          created_at?: string
        }
        Update: {
          comment?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      transition_task: {
        Args: {
          p_task_id: string
          p_to_status: TaskStatus
          p_comment?: string | null
        }
        Returns: Database['public']['Tables']['tasks']['Row']
      }
      is_assigner: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: {
      user_role: UserRole
      task_status: TaskStatus
    }
    CompositeTypes: Record<string, never>
  }
}
