import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ClientProvider } from './context/ClientContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/Common/ProtectedRoute'

import Sidebar from './components/Layout/Sidebar'
import TopBar from './components/Layout/TopBar'
import BottomNav from './components/Layout/BottomNav'
import ErrorBoundary from './components/Common/ErrorBoundary'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Hypotheses from './pages/Hypotheses'
import HuntResults from './pages/HuntResults'
import IOCReports from './pages/IOCReports'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

// Using an inner component so we can use hooks from contexts if needed
function AppRoutes() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg-primary text-textprimary">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <TopBar toggleSidebar={() => setIsSidebarOpen(true)} />
      <main className="md:ml-[260px] h-screen overflow-y-auto bg-bg-base px-6 md:px-8 pb-24 pt-[104px] md:pb-8">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/hypotheses" element={<Hypotheses />} />
            <Route path="/results" element={<HuntResults />} />
            <Route path="/ioc-reports" element={<IOCReports />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ClientProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={
                <ProtectedRoute>
                  <AppRoutes />
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ClientProvider>
    </AuthProvider>
  )
}

export default App
