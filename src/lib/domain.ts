export const userRoles = ['assigner', 'executor'] as const
export type UserRole = (typeof userRoles)[number]

export const taskStatuses = [
  'new',
  'in_progress',
  'in_review',
  'accepted',
  'rework',
] as const
export type TaskStatus = (typeof taskStatuses)[number]

export const taskStatusLabel: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  in_review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
}

export const userRoleLabel: Record<UserRole, string> = {
  assigner: 'Постановщик',
  executor: 'Исполнитель',
}
