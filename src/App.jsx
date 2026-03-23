import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DataProvider }        from './contexts/DataContext'
import { ThemeProvider }       from './contexts/ThemeContext'
import { ServicesProvider }    from './contexts/ServicesContext'
import { ScheduleProvider }    from './contexts/ScheduleContext'
import { InstructorsProvider } from './contexts/InstructorsContext'
import Layout        from './components/layout/Layout'
import Dashboard     from './pages/Dashboard'
import Members       from './pages/Members'
import MemberProfile from './pages/MemberProfile'
import Payments      from './pages/Payments'
import Activity      from './pages/Activity'
import SettingsPage  from './pages/Settings'
import ServicesPage  from './pages/Services'
import SchedulePage  from './pages/Schedule'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <DataProvider>
          <ServicesProvider>
            <InstructorsProvider>
              <ScheduleProvider>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard"         element={<Dashboard />} />
                    <Route path="members"           element={<Members />} />
                    <Route path="members/:memberId" element={<MemberProfile />} />
                    <Route path="payments"          element={<Payments />} />
                    <Route path="activity"          element={<Activity />} />
                    <Route path="settings"          element={<SettingsPage />} />
                    <Route path="services"          element={<ServicesPage />} />
                    <Route path="schedule"          element={<SchedulePage />} />
                  </Route>
                </Routes>
              </ScheduleProvider>
            </InstructorsProvider>
          </ServicesProvider>
        </DataProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
