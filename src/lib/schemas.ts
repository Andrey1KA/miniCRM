import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Укажите почту'),
  password: z.string().min(1, 'Введите пароль'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const loginResolver = zodResolver(loginSchema)

export const objectSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название'),
  address: z.string().trim().min(1, 'Укажите адрес'),
})

export type ObjectValues = z.infer<typeof objectSchema>

export const objectResolver = zodResolver(objectSchema)

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название'),
  description: z.string().trim(),
  assigneeId: z.string().min(1, 'Выберите исполнителя'),
  objectId: z.string().min(1, 'Выберите объект'),
})

export type TaskValues = z.infer<typeof taskSchema>

export const taskResolver = zodResolver(taskSchema)

export const reworkSchema = z.object({
  comment: z.string().trim().min(1, 'Комментарий обязателен'),
})

export type ReworkValues = z.infer<typeof reworkSchema>

export const reworkResolver = zodResolver(reworkSchema)
