import type { TaskStatus, UserRole } from './domain.ts'

export type TaskAction = {
  status: TaskStatus
  label: string
  needsComment: boolean
}

export function actionsFor(role: UserRole, status: TaskStatus, isAssignee: boolean): TaskAction[] {
  if (role === 'executor' && isAssignee) {
    if (status === 'new' || status === 'rework') {
      return [{ status: 'in_progress', label: 'Взять в работу', needsComment: false }]
    }
    if (status === 'in_progress') {
      return [{ status: 'in_review', label: 'Отправить на проверку', needsComment: false }]
    }
  }

  if (role === 'assigner' && status === 'in_review') {
    return [
      { status: 'accepted', label: 'Принять', needsComment: false },
      { status: 'rework', label: 'Вернуть на доработку', needsComment: true },
    ]
  }

  return []
}

export function waitingHint(status: TaskStatus): string {
  switch (status) {
    case 'new':
    case 'rework':
      return 'Дальше задачу берёт в работу назначенный исполнитель.'
    case 'in_progress':
      return 'Исполнитель отправит задачу на проверку, когда закончит.'
    case 'in_review':
      return 'Постановщик принимает задачу или возвращает её на доработку.'
    case 'accepted':
      return 'Задача принята, статус больше не меняется.'
  }
}
