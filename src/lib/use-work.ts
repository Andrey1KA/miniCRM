import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth-provider.tsx'
import { fetchHistory, fetchObjects, fetchProfiles, fetchTasks } from '@/lib/api.ts'

function useUserKey() {
  const { session } = useAuth()
  return session?.user.id
}

export function useObjects() {
  const userId = useUserKey()
  return useQuery({
    queryKey: ['work', userId, 'objects'],
    enabled: Boolean(userId),
    queryFn: fetchObjects,
  })
}

export function useTasks() {
  const userId = useUserKey()
  return useQuery({
    queryKey: ['work', userId, 'tasks'],
    enabled: Boolean(userId),
    queryFn: fetchTasks,
  })
}

export function useProfiles() {
  const userId = useUserKey()
  return useQuery({
    queryKey: ['work', userId, 'profiles'],
    enabled: Boolean(userId),
    queryFn: fetchProfiles,
  })
}

export function useHistory(taskId: string) {
  const userId = useUserKey()
  return useQuery({
    queryKey: ['work', userId, 'history', taskId],
    enabled: Boolean(userId),
    queryFn: () => fetchHistory(taskId),
  })
}

export function usePersonName() {
  const profiles = useProfiles()
  const byId = new Map(profiles.data?.map((person) => [person.id, person.full_name]) ?? [])
  return {
    ...profiles,
    executors: profiles.data?.filter((person) => person.role === 'executor') ?? [],
    name(id: string) {
      return byId.get(id) ?? 'Сотрудник'
    },
  }
}
