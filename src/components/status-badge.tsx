import { Badge } from '@/components/ui/badge.tsx'
import { taskStatusLabel, type TaskStatus } from '@/lib/domain.ts'

const statusClass: Record<TaskStatus, string> = {
  new: 'bg-muted text-muted-foreground',
  in_progress: 'bg-sky-100 text-sky-950',
  in_review: 'bg-amber-100 text-amber-950',
  accepted: 'bg-emerald-100 text-emerald-950',
  rework: 'bg-rose-100 text-rose-950',
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={statusClass[status]}>
      {taskStatusLabel[status]}
    </Badge>
  )
}
