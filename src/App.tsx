import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from '@/auth/auth-provider.tsx'
import { AppProviders } from '@/app/providers.tsx'
import { AppLayout, RequireAuth } from '@/components/app-layout.tsx'
import { LoginPage } from '@/pages/login-page.tsx'
import { MyTasksPage } from '@/pages/my-tasks-page.tsx'
import { ObjectPage } from '@/pages/object-page.tsx'
import { ObjectsPage } from '@/pages/objects-page.tsx'
import { TaskPage } from '@/pages/task-page.tsx'

export default function App() {
  return (
    <AppProviders>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<ObjectsPage />} />
                <Route path="/objects/:objectId" element={<ObjectPage />} />
                <Route path="/tasks/:taskId" element={<TaskPage />} />
                <Route path="/my-tasks" element={<MyTasksPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </AppProviders>
  )
}
