'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore, useGamificationStore, useSettingsStore, ACHIEVEMENT_DEFS } from '@/store/auth-store'
import { useSyncStore } from '@/store/sync-store'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Timer, Brain, BookmarkPlus, Flame, Zap, TrendingUp, Clock, Trophy, ArrowRight, Wifi, WifiOff, Medal } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { format, subDays, isToday, parseISO } from 'date-fns'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { playSound } from '@/lib/audio'
import { notifyAchievement } from '@/lib/notifications'
import type { Session } from '@/lib/types'

export function DashboardView() {
  const { user, setView } = useAuthStore()
  const gam = useGamificationStore()
  const settings = useSettingsStore()
  const sync = useSyncStore()

  // Start sync listener on mount
  useEffect(() => {
    const cleanup = useSyncStore.getState().startSyncListener()
    return cleanup
  }, [])

  // Play achievement sound when unlocked
  useEffect(() => {
    if (gam.newlyUnlocked && settings.soundEnabled) {
      playSound('achievement')
    }
    if (gam.newlyUnlocked && settings.notificationsEnabled) {
      const def = ACHIEVEMENT_DEFS.find(a => a.key === gam.newlyUnlocked)
      if (def) notifyAchievement(def.name)
    }
  }, [gam.newlyUnlocked, settings.soundEnabled, settings.notificationsEnabled])

  const { data: sessions = [] } = useQuery({
    queryKey: ['dashboard-sessions'],
    queryFn: async () => {
      if (!user) return []
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/sessions?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      return json.data || []
    },
    enabled: !!user,
  })

  // Weekly chart data
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i)
    const dayStr = format(date, 'yyyy-MM-dd')
    const daySessions = (sessions as Session[]).filter(
      (s) => format(parseISO(s.created_at), 'yyyy-MM-dd') === dayStr
    )
    return {
      day: format(date, 'EEE'),
      sessions: daySessions.length,
      totalMin: Math.round(daySessions.reduce((a, s) => a + s.duration, 0) / 60),
    }
  })

  // Duration trend
  const durationData = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i)
    const dayStr = format(date, 'yyyy-MM-dd')
    const daySessions = (sessions as Session[]).filter(
      (s) => format(parseISO(s.created_at), 'yyyy-MM-dd') === dayStr
    )
    const avg = daySessions.length
      ? Math.round(daySessions.reduce((a, s) => a + s.duration, 0) / daySessions.length / 60)
      : 0
    return { day: format(date, 'MMM d'), avgDuration: avg }
  })

  const recentSessions = (sessions as Session[]).slice(0, 5)
  const todaySessions = (sessions as Session[]).filter((s) => isToday(parseISO(s.created_at)))
  const xpProgress = ((gam.xp % 500) / 500) * 100
  const totalHours = Math.floor(gam.totalTime / 3600)
  const totalMins = Math.floor((gam.totalTime % 3600) / 60)
  const unlockedAchievements = gam.achievements.filter(a => a.unlockedAt)

  const stats = [
    { label: 'Total Sessions', value: gam.totalSessions, icon: Zap, color: 'text-pink-400' },
    { label: 'Total Time', value: totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`, icon: Clock, color: 'text-emerald-400' },
    { label: 'Current Streak', value: gam.streak, icon: Flame, color: 'text-orange-400' },
    { label: `Level ${gam.level}`, value: `${500 - (gam.xp % 500)} XP`, icon: Trophy, color: 'text-violet-400' },
  ]

  const getInsight = () => {
    if (gam.streak >= 30) return { text: '30 days straight. You are a machine.', icon: '💎' }
    if (gam.streak >= 7) return { text: 'A full week of dedication. Legendary.', icon: '🔥' }
    if (gam.streak >= 3) return { text: "You're building momentum. Don't stop now.", icon: '💪' }
    if (todaySessions.length > 0) return { text: "You've already started today. Keep going!", icon: '✨' }
    if (gam.totalSessions === 0) return { text: 'Ready to begin? Start your first session.', icon: '💓' }
    return { text: 'Start a session today to maintain your streak.', icon: '💓' }
  }

  const insight = getInsight()

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Achievement Unlock Toast */}
      <AnimatePresence>
        {gam.newlyUnlocked && (() => {
          const def = ACHIEVEMENT_DEFS.find(a => a.key === gam.newlyUnlocked)
          if (!def) return null
          return (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-card border-amber-500/30 rounded-xl px-5 py-3 flex items-center gap-3 shadow-2xl animate-pulse-glow"
            >
              <span className="text-2xl">{def.icon}</span>
              <div>
                <p className="text-xs text-amber-400 font-bold">Achievement Unlocked!</p>
                <p className="text-sm font-medium">{def.name}</p>
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Sync Status Indicator */}
      <div className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">
            Welcome back{settings.tone === 'dominant' ? '.' : settings.tone === 'teasing' ? '...' : '~'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {insight.icon} {insight.text}
          </p>
        </motion.div>
        <div className="flex items-center gap-2">
          {sync.pendingCount > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-300 border-0">
              <WifiOff className="w-3 h-3 mr-1" /> {sync.pendingCount} pending
            </Badge>
          )}
          <Badge variant="secondary" className={`text-[10px] border-0 ${sync.isOnline ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
            {sync.isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {sync.isOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                {stat.label === 'Current Streak' && gam.streak > 0 && (
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5 }} className="mt-1">
                    <Badge variant="secondary" className="text-[10px] bg-orange-500/20 text-orange-300 border-0">
                      🔥 {gam.streak} day{gam.streak > 1 ? 's' : ''}
                    </Badge>
                  </motion.div>
                )}
                {stat.label.startsWith('Level') && (
                  <div className="mt-2">
                    <Progress value={xpProgress} className="h-1.5 bg-secondary" />
                    <p className="text-[10px] text-muted-foreground mt-1">{gam.xp} / {Math.ceil(gam.xp / 500) * 500} XP</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="bg-card/60 border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setView('session')} className="bg-primary hover:bg-primary/90">
                <Timer className="w-4 h-4 mr-2" />
                Start Session
              </Button>
              <Button variant="outline" onClick={() => setView('quiz')} className="border-border/50">
                <Brain className="w-4 h-4 mr-2" />
                Take Quiz
              </Button>
              <Button variant="outline" onClick={() => setView('profiles')} className="border-border/50">
                <BookmarkPlus className="w-4 h-4 mr-2" />
                Create Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Sessions This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="sessions" fill="oklch(0.72 0.18 320)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Duration Trend (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} axisLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`${value} min`, 'Avg Duration']}
                  />
                  <Bar dataKey="avgDuration" fill="oklch(0.65 0.15 160)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Achievements */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Medal className="w-4 h-4 text-amber-400" />
              Achievements ({unlockedAchievements.length}/{ACHIEVEMENT_DEFS.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {ACHIEVEMENT_DEFS.map((def) => {
                const unlocked = unlockedAchievements.find(a => a.achievement_key === def.key)
                return (
                  <motion.div
                    key={def.key}
                    whileHover={{ scale: 1.1 }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                      unlocked ? 'bg-primary/10 border border-primary/20' : 'bg-background/20 opacity-40'
                    }`}
                    title={`${def.name}: ${def.description}`}
                  >
                    <span className={`text-lg ${unlocked ? '' : 'grayscale'}`}>{def.icon}</span>
                    <span className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-2">{def.name}</span>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Sessions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Sessions</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView('history')} className="text-xs text-muted-foreground">
              View All <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No sessions yet. Start your first one!
              </p>
            ) : (
              <div className="space-y-2">
                {recentSessions.map((s: Session) => (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/30">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {format(parseISO(s.created_at), 'MMM d, h:mm a')}
                      </span>
                      {s.profile && (
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">
                          {s.profile}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatDuration(s.duration)}</span>
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                        I{s.intensity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
