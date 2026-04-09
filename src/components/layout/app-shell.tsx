'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useSyncStore } from '@/store/sync-store'
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
  CloudOff,
  X,
  Loader2,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const navItems = [
  { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { key: 'session' as const, label: 'Session', icon: Timer },
  { key: 'history' as const, label: 'History', icon: History },
  { key: 'profiles' as const, label: 'Profiles', icon: BookmarkPlus },
  { key: 'quiz' as const, label: 'Quiz', icon: Brain },
  { key: 'settings' as const, label: 'Settings', icon: Settings },
]

function SyncStatusIcon({ className }: { className?: string }) {
  const { lastSyncStatus, lastSyncAt } = useSyncStore()

  const statusConfig = {
    idle: { icon: Circle, color: 'text-muted-foreground' },
    syncing: { icon: Loader2, color: 'text-primary', spin: true },
    success: { icon: CheckCircle2, color: 'text-emerald-400' },
    error: { icon: Circle, color: 'text-red-400' },
  }

  const config = statusConfig[lastSyncStatus]
  const Icon = config.icon
  const spin = 'spin' in config ? config.spin : false

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Never synced'
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'Synced just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `Synced ${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `Synced ${diffHr}h ago`
    return `Synced ${d.toLocaleDateString()}`
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('cursor-default flex items-center', className)}>
          <Icon className={cn('w-3.5 h-3.5', config.color, spin && 'animate-spin')} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={4}>
        <p className="text-[11px]">{formatLastSync(lastSyncAt)}</p>
        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
          {lastSyncStatus === 'syncing' ? 'Syncing...' : lastSyncStatus}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

function OfflineBanner() {
  const { isOnline, pendingCount } = useSyncStore()
  const [dismissed, setDismissed] = useState(false)

  if (isOnline || dismissed || pendingCount === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-14 left-0 right-0 z-40 md:top-0 md:left-56 md:right-0"
    >
      <div className="bg-amber-500/90 backdrop-blur-sm text-amber-950 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <CloudOff className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            You&apos;re offline — changes will sync when you&apos;re back online
          </span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-amber-950/20 text-amber-900 text-[10px] h-5 px-1.5 border-0">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 p-0.5 rounded hover:bg-amber-950/10 transition-colors"
          aria-label="Dismiss offline banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, view, setView, signOut } = useAuthStore()
  const { isOnline } = useSyncStore()

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
      {/* Offline Banner */}
      <AnimatePresence>
        <OfflineBanner />
      </AnimatePresence>

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
          {/* Sync Status in Sidebar Footer */}
          <div className="flex items-center justify-between px-3 py-2 mb-2">
            <div className="flex items-center gap-2">
              <SyncStatusIcon />
              <span className="text-[11px] text-muted-foreground">
                {!isOnline ? 'Offline' : 'Connected'}
              </span>
            </div>
          </div>

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
        <div className="flex items-center gap-2">
          <SyncStatusIcon />
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
            {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
          </div>
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
