import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { LeadsPage } from './pages/LeadsPage'
import { LoginPage } from './pages/LoginPage'
import './App.css'

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <main className="route-loading">Loading workspace...</main>
  return user ? <LeadsPage /> : <Navigate to="/login" replace />
}

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/leads" element={<ProtectedRoute />} />
    <Route path="*" element={<Navigate to="/leads" replace />} />
  </Routes></BrowserRouter>
}
