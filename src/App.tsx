import { BrowserRouter, Route, Routes } from 'react-router'
import { AppProviders } from '@/app/providers.tsx'
import { ShellPage } from '@/pages/shell-page.tsx'

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ShellPage />} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  )
}
