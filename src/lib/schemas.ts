import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Укажите почту'),
  password: z.string().min(1, 'Введите пароль'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const loginResolver = zodResolver(loginSchema)
