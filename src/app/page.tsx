'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { TimerView } from '@/components/timer/timer-view'
import { HistoryView } from '@/components/sessions/history-view'
import { ProfilesView } from '@/components/profiles/profiles-view'
import { QuizView } from '@/components/quiz/quiz-view'
import { SettingsView } from '@/components/profiles/settings-view'

export default function Home() {
  const { view, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <DashboardView />
      case 'session':
        return <TimerView />
      case 'history':
        return <HistoryView />
      case 'profiles':
        return <ProfilesView />
      case 'quiz':
        return <QuizView />
      case 'settings':
        return <SettingsView />
      default:
        return <DashboardView />
    }
  }

  return <AppShell>{renderView()}</AppShell>
}
