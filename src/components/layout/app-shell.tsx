'use client'

import { useAuthStore } from '@/store/auth-store'
import { LoginForm } from '@/components/auth/login-form'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Timer,
  History,
  BookmarkPlus,
  Brain,
  Settings,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const navItems = [
  { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { key: 'session' as const, label: 'Session', icon: Timer },
  { key: 'history' as const, label: 'History', icon: History },
  { key: 'profiles' as const, label: 'Profiles', icon: BookmarkPlus },
  { key: 'quiz' as const, label: 'Quiz', icon: Brain },
  { key: 'settings' as const, label: 'Settings', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, view, setView, signOut } = useAuthStore()

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-6xl"
        >
          💓
        </motion.div>
      </div>
    )
  }

  // Unauthenticated — show login
  if (!user) {
    return <LoginForm />
  }

  const handleNav = (key: typeof navItems[number]['key']) => {
    setView(key)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-screen fixed left-0 top-0 w-56 flex-col bg-card/50 backdrop-blur-xl border-r border-border/50 z-50">
        <div className="p-4 flex items-center gap-2">
          <motion.span
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-xl"
          >
            💓
          </motion.span>
          <span className="text-lg font-bold bg-gradient-to-r from-pink-400 to-rose-300 bg-clip-text text-transparent">
            PulseTrack
          </span>
        </div>

        <Separator className="bg-border/50" />

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = view === item.key
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/15 text-primary glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive && 'text-primary')} />
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                  />
                )}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-border/50">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {profile?.display_name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-card/80 backdrop-blur-xl border-b border-border/50 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">💓</span>
          <span className="font-bold text-sm bg-gradient-to-r from-pink-400 to-rose-300 bg-clip-text text-transparent">
            PulseTrack
          </span>
        </div>
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
          {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="min-h-[calc(100vh-3.5rem)] md:min-h-screen p-4 md:p-6 pb-20 md:pb-6"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border/50 z-50">
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = view === item.key
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={cn(
                  'flex flex-col items-center gap-1 py-1 px-2 rounded-lg transition-all duration-200 min-w-[3.5rem]',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_rgba(236,72,153,0.5)]')} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="bottom-active"
                    className="w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
