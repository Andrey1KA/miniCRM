import type { TaskStatus } from './domain.ts'
import { getSupabase } from './supabase.ts'

function message(error: { message: string }): Error {
  return new Error(error.message)
}

export async function fetchProfile(userId: string) {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    throw message(error)
  }
  return data
}

export async function fetchObjects() {
  const { data, error } = await getSupabase()
    .from('objects')
    .select('id, title, address, created_by, created_at')
    .order('title')
  if (error) {
    throw message(error)
  }
  return data
}

export async function fetchTasks() {
  const { data, error } = await getSupabase()
    .from('tasks')
    .select(
      'id, object_id, title, description, assignee_id, author_id, status, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
  if (error) {
    throw message(error)
  }
  return data
}

export async function fetchProfiles() {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name')
  if (error) {
    throw message(error)
  }
  return data
}

export async function fetchHistory(taskId: string) {
  const { data, error } = await getSupabase()
    .from('task_status_history')
    .select('id, seq, task_id, changed_by, from_status, to_status, comment, created_at')
    .eq('task_id', taskId)
    .order('seq')
  if (error) {
    throw message(error)
  }
  return data
}

export async function createObject(values: { title: string; address: string }) {
  const { data, error } = await getSupabase()
    .from('objects')
    .insert(values)
    .select('id')
    .single()
  if (error) {
    throw message(error)
  }
  return data
}

export async function updateObject(id: string, values: { title: string; address: string }) {
  const { data, error } = await getSupabase()
    .from('objects')
    .update(values)
    .eq('id', id)
    .select('id')
  if (error) {
    throw message(error)
  }
  if (data.length === 0) {
    throw new Error('Не удалось сохранить объект')
  }
}

export async function deleteObject(id: string) {
  const { data, error } = await getSupabase().from('objects').delete().eq('id', id).select('id')
  if (error) {
    throw message(error)
  }
  if (data.length === 0) {
    throw new Error('Не удалось удалить объект')
  }
}

export async function createTask(values: {
  title: string
  description: string
  assigneeId: string
  objectId: string
}) {
  const { data, error } = await getSupabase()
    .from('tasks')
    .insert({
      title: values.title,
      description: values.description,
      assignee_id: values.assigneeId,
      object_id: values.objectId,
    })
    .select('id')
    .single()
  if (error) {
    throw message(error)
  }
  return data
}

export async function updateTask(
  id: string,
  values: { title: string; description: string; assigneeId: string; objectId: string },
) {
  const { data, error } = await getSupabase()
    .from('tasks')
    .update({
      title: values.title,
      description: values.description,
      assignee_id: values.assigneeId,
      object_id: values.objectId,
    })
    .eq('id', id)
    .select('id')
  if (error) {
    throw message(error)
  }
  if (data.length === 0) {
    throw new Error('Не удалось сохранить задачу')
  }
}

export async function deleteTask(id: string) {
  const { data, error } = await getSupabase().from('tasks').delete().eq('id', id).select('id')
  if (error) {
    throw message(error)
  }
  if (data.length === 0) {
    throw new Error('Не удалось удалить задачу')
  }
}

export async function transitionTask(taskId: string, status: TaskStatus, comment?: string) {
  const { error } = await getSupabase().rpc('transition_task', {
    p_task_id: taskId,
    p_to_status: status,
    p_comment: comment ?? null,
  })
  if (error) {
    throw message(error)
  }
}
