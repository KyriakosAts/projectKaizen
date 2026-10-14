import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DataProvider } from './data/DataContext.jsx'
import { FilterProvider } from './app/filter.jsx'
import Layout from './app/Layout.jsx'
import TodayPage from './app/pages/TodayPage.jsx'
import MembersPage from './app/pages/MembersPage.jsx'
import MemberPage from './app/pages/MemberPage.jsx'
import GridPage from './app/pages/GridPage.jsx'
import SeminarsPage from './app/pages/SeminarsPage.jsx'
import SeminarPage from './app/pages/SeminarPage.jsx'
import StatsPage from './app/pages/StatsPage.jsx'
import SettingsPage from './app/pages/SettingsPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <FilterProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<TodayPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="members/:memberId" element={<MemberPage />} />
              <Route path="grid" element={<GridPage />} />
              <Route path="seminars" element={<SeminarsPage />} />
              <Route path="seminars/:seminarId" element={<SeminarPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </FilterProvider>
      </DataProvider>
    </BrowserRouter>
  )
}
