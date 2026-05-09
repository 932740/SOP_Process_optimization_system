import { Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Login from './pages/Login'
import DocumentCenter from './pages/DocumentCenter'
import DocumentEditor from './pages/DocumentEditor'
import DocumentViewer from './pages/DocumentViewer'
import AdminDashboard from './pages/AdminDashboard'
import SetupWizard from './pages/SetupWizard'
import ExportCenter from './pages/ExportCenter'
import Layout from './components/Layout'
import { setupApi } from './services/api'

function App() {
  const [initialized, setInitialized] = useState<boolean | null>(null)

  useEffect(() => {
    setupApi.getStatus().then(res => {
      setInitialized(res.data.initialized)
    }).catch(() => {
      setInitialized(true)
    })
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout initialized={initialized} />}>
        <Route index element={<DocumentCenter />} />
        <Route path="editor/:id?" element={<DocumentEditor />} />
        <Route path="viewer/:id" element={<DocumentViewer />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="settings" element={<SetupWizard />} />
        <Route path="exports" element={<ExportCenter />} />
      </Route>
    </Routes>
  )
}

export default App
