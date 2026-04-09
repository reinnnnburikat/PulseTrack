'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore, useGamificationStore, useSettingsStore, ACHIEVEMENT_DEFS } from '@/store/auth-store'
import { useSyncStore } from '@/store/sync-store'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Timer,
  Brain,
  BookmarkPlus,
  Flame,
  Zap,
  TrendingUp,
  Clock,
  Trophy,
  ArrowRight,
  Wifi,
  WifiOff,
  Medal,
  Lock,
  Star,
  Target,
  Sparkles,
  Sun,
  Moon,
  CalendarDays,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { format, subDays, isToday, parseISO, isSameDay } from 'date-fns'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { apiFetch } from '@/lib/supabase'
import { playSound } from '@/lib/audio'
import { notifyAchievement } from '@/lib/notifications'
import { checkAndNotifyStreak } from '@/lib/notifications'
import { vibrateAchievement } from '@/lib/haptics'
import { useChallengeStore } from '@/store/challenge-store'
import type { ChallengeStats } from '@/lib/challenges'
import type { Session, SessionMood } from '@/lib/types'
import { MOOD_CONFIG } from '@/lib/types'
import type { AchievementDef } from '@/store/auth-store'

// ---- Achievement Detail Modal State ----
interface SelectedAchievement {
  def: AchievementDef
  unlocked: boolean
  unlockedAt: string | null
  progressHint: string
}

export function DashboardView() {
  const { user, setView } = useAuthStore()
  const gam = useGamificationStore()
  const settings = useSettingsStore()
  const sync = useSyncStore()

  const [selectedAchievement, setSelectedAchievement] = useState<SelectedAchievement | null>(null)

  // Start sync listener on mount
  useEffect(() => {
    const cleanup = useSyncStore.getState().startSyncListener()
    return cleanup
  }, [])

  // Streak notification check on mount
  useEffect(() => {
    if (settings.notificationsEnabled) {
      checkAndNotifyStreak(gam.streak, gam.lastSessionDate)
    }
  }, [settings.notificationsEnabled]) // Only re-run if notifications setting changes

  // Play achievement sound + haptic when unlocked
  useEffect(() => {
    if (gam.newlyUnlocked && settings.soundEnabled) {
      playSound('achievement')
      vibrateAchievement()
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
      const res = await apiFetch('/api/sessions?limit=200')
      return res.data || []
    },
    enabled: !!user,
  })

  const typedSessions = sessions as Session[]

  // ---- Computed data ----

  // Weekly chart data
  const weeklyData = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i)
      const dayStr = format(date, 'yyyy-MM-dd')
      const daySessions = typedSessions.filter(
        (s) => format(parseISO(s.created_at), 'yyyy-MM-dd') === dayStr
      )
      return {
        day: format(date, 'EEE'),
        sessions: daySessions.length,
        totalMin: Math.round(daySessions.reduce((a, s) => a + s.duration, 0) / 60),
      }
    }), [typedSessions])

  // Duration trend
  const durationData = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => {
      const date = subDays(new Date(), 13 - i)
      const dayStr = format(date, 'yyyy-MM-dd')
      const daySessions = typedSessions.filter(
        (s) => format(parseISO(s.created_at), 'yyyy-MM-dd') === dayStr
      )
      const avg = daySessions.length
        ? Math.round(daySessions.reduce((a, s) => a + s.duration, 0) / daySessions.length / 60)
        : 0
      return { day: format(date, 'MMM d'), avgDuration: avg }
    }), [typedSessions])

  // Streak heatmap data — last 30 days
  const heatmapData = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i)
      const dayStr = format(date, 'yyyy-MM-dd')
      const daySessions = typedSessions.filter(
        (s) => format(parseISO(s.created_at), 'yyyy-MM-dd') === dayStr
      )
      return {
        date,
        dateStr: dayStr,
        dayLabel: format(date, 'd'),
        monthLabel: format(date, 'MMM'),
        count: daySessions.length,
        isToday: isToday(date),
      }
    }), [typedSessions])

  // Personal bests
  const personalBests = useMemo(() => {
    if (typedSessions.length === 0) return { longestSession: 0, highestIntensity: 0 }
    return {
      longestSession: Math.max(...typedSessions.map(s => s.duration)),
      highestIntensity: Math.max(...typedSessions.map(s => s.intensity)),
    }
  }, [typedSessions])

  // Average session duration
  const avgSessionDuration = useMemo(() => {
    if (typedSessions.length === 0) return 0
    return Math.round(typedSessions.reduce((a, s) => a + s.duration, 0) / typedSessions.length / 60)
  }, [typedSessions])

  // Sessions with high intensity (4+)
  const highIntensityCount = useMemo(() =>
    typedSessions.filter(s => s.intensity >= 4).length
  , [typedSessions])

  const recentSessions = typedSessions.slice(0, 5)
  const todaySessions = typedSessions.filter((s) => isToday(parseISO(s.created_at)))
  const xpInLevel = gam.xp % 500
  const xpToNext = 500 - xpInLevel
  const xpProgress = (xpInLevel / 500) * 100
  const totalHours = Math.floor(gam.totalTime / 3600)
  const totalMins = Math.floor((gam.totalTime % 3600) / 60)
  const unlockedAchievements = gam.achievements.filter(a => a.unlockedAt)
  const closeToLevelUp = xpToNext < 100

  // ---- Challenge Store ----
  const challenge = useChallengeStore()

  // ---- Phase 3: Mood Analytics ----
  const moodData = useMemo(() => {
    const moodCounts: Record<string, number> = {}
    for (const s of typedSessions) {
      if (s.mood) {
        moodCounts[s.mood] = (moodCounts[s.mood] || 0) + 1
      }
    }
    return Object.entries(moodCounts).map(([mood, count]) => ({
      mood,
      count,
      emoji: MOOD_CONFIG[mood as SessionMood]?.emoji || '😊',
      label: MOOD_CONFIG[mood as SessionMood]?.label || mood,
      color: MOOD_CONFIG[mood as SessionMood]?.color || 'text-muted-foreground',
    }))
  }, [typedSessions])

  // ---- Phase 3: Time-of-Day Analysis ----
  const timeOfDayData = useMemo(() => {
    const hourBuckets = Array.from({ length: 6 }, (_, i) => ({
      label: i === 0 ? '12-4am' : i === 1 ? '4-8am' : i === 2 ? '8am-12pm' : i === 3 ? '12-4pm' : i === 4 ? '4-8pm' : '8pm-12am',
      sessions: 0,
      avgDuration: 0,
      durations: [] as number[],
    }))
    for (const s of typedSessions) {
      const hour = parseISO(s.created_at).getHours()
      const bucket = hour < 4 ? 0 : hour < 8 ? 1 : hour < 12 ? 2 : hour < 16 ? 3 : hour < 20 ? 4 : 5
      hourBuckets[bucket].sessions++
      hourBuckets[bucket].durations.push(s.duration)
    }
    return hourBuckets.map(b => ({
      ...b,
      avgDuration: b.durations.length > 0 ? Math.round(b.durations.reduce((a, d) => a + d, 0) / b.durations.length / 60) : 0,
    }))
  }, [typedSessions])

  // ---- Phase 3: Best Performing Hour ----
  const bestHour = useMemo(() => {
    const hourCounts: Record<number, number> = {}
    for (const s of typedSessions) {
      const h = parseISO(s.created_at).getHours()
      hourCounts[h] = (hourCounts[h] || 0) + 1
    }
    let maxHour = 0
    let maxCount = 0
    for (const [h, count] of Object.entries(hourCounts)) {
      if (count > maxCount) { maxHour = parseInt(h); maxCount = count }
    }
    if (maxCount === 0) return null
    return { hour: maxHour, count: maxCount, label: maxHour === 0 ? '12am' : maxHour < 12 ? `${maxHour}am` : maxHour === 12 ? '12pm' : `${maxHour - 12}pm` }
  }, [typedSessions])

  // ---- Phase 3: Challenge Stats ----
  const challengeStats = useMemo((): ChallengeStats => {
    const todayStr = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const today = typedSessions.filter(s => format(parseISO(s.created_at), 'yyyy-MM-dd') === todayStr)
    const week = typedSessions.filter(s => new Date(s.created_at) >= new Date(weekAgo))
    return {
      todaySessions: today.length,
      todayDuration: Math.round(today.reduce((a, s) => a + s.duration, 0) / 60),
      todayMaxIntensity: today.length > 0 ? Math.max(...today.map(s => s.intensity)) : 0,
      weekSessions: week.length,
      weekDuration: Math.round(week.reduce((a, s) => a + s.duration, 0) / 60),
      weekMaxIntensity: week.length > 0 ? Math.max(...week.map(s => s.intensity)) : 0,
      currentStreak: gam.streak,
      focusModeSessionsToday: today.filter(s => {
        try { return JSON.parse(s.notes || '{}').focusModeUsed } catch { return false }
      }).length,
    }
  }, [typedSessions, gam.streak])

  // ---- Weekly Summary ----
  const weeklySummary = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - mondayOffset)
    weekStart.setHours(0, 0, 0, 0)

    // This week sessions
    const thisWeekSessions = typedSessions.filter(s => new Date(s.created_at) >= weekStart)
    const thisWeekTotalMin = Math.round(thisWeekSessions.reduce((a, s) => a + s.duration, 0) / 60)

    // Best day this week
    const dayCounts: Record<string, number> = {}
    for (const s of thisWeekSessions) {
      const dayStr = format(parseISO(s.created_at), 'yyyy-MM-dd')
      dayCounts[dayStr] = (dayCounts[dayStr] || 0) + 1
    }
    let bestDay = ''
    let bestDayCount = 0
    for (const [day, count] of Object.entries(dayCounts)) {
      if (count > bestDayCount) { bestDay = day; bestDayCount = count }
    }

    // Last week sessions
    const lastWeekStart = new Date(weekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekSessions = typedSessions.filter(s => {
      const d = new Date(s.created_at)
      return d >= lastWeekStart && d < weekStart
    })
    const diff = thisWeekSessions.length - lastWeekSessions.length

    // Format total time
    const hours = Math.floor(thisWeekTotalMin / 60)
    const mins = thisWeekTotalMin % 60
    const formattedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

    return {
      sessions: thisWeekSessions.length,
      formattedTime,
      bestDay: bestDay ? format(parseISO(bestDay), 'EEEE') : null,
      bestDayCount,
      diff,
      lastWeekSessions: lastWeekSessions.length,
    }
  }, [typedSessions])

  // Initialize challenges on mount
  useEffect(() => {
    if (user) {
      challenge.initializeChallenges()
      // Check challenge progress on mount
      setTimeout(() => challenge.checkChallenges(challengeStats), 1000)
    }
  }, [user])

  // ---- Stats ----
  const stats = [
    { label: 'Total Sessions', value: gam.totalSessions, icon: Zap, color: 'text-pink-400' },
    { label: 'Total Time', value: totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`, icon: Clock, color: 'text-emerald-400' },
    { label: 'Current Streak', value: gam.streak, icon: Flame, color: 'text-orange-400' },
  ]

  // ---- Insights ----
  const getInsight = useCallback(() => {
    // Intensity-heavy user
    if (typedSessions.length >= 5 && highIntensityCount / typedSessions.length > 0.6) {
      return { text: 'You gravitate toward intensity. Stay balanced.', icon: '⚡' }
    }
    // Short sessions
    if (typedSessions.length >= 3 && avgSessionDuration > 0 && avgSessionDuration < 15) {
      return { text: 'Try extending your sessions for deeper results', icon: '⏱️' }
    }
    // Streak-based insights
    if (gam.streak >= 30) return { text: '30 days straight. You are a machine.', icon: '💎' }
    if (gam.streak >= 7) return { text: 'A full week of dedication. Legendary.', icon: '🔥' }
    if (gam.streak >= 3) return { text: "You're building momentum. Don't stop now.", icon: '💪' }
    // Streak at risk
    if (gam.streak > 0 && todaySessions.length === 0) {
      return { text: `Start a session to continue your ${gam.streak}-day streak`, icon: '🔥' }
    }
    if (todaySessions.length > 0) return { text: "You've already started today. Keep going!", icon: '✨' }
    if (gam.totalSessions === 0) return { text: 'Ready to begin? Start your first session.', icon: '💓' }
    return { text: 'Start a session today to maintain your streak.', icon: '💓' }
  }, [gam.streak, todaySessions.length, gam.totalSessions, highIntensityCount, typedSessions.length, avgSessionDuration])

  const insight = getInsight()

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const formatDurationLong = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  // ---- Achievement click handler ----
  const handleAchievementClick = useCallback((def: AchievementDef) => {
    const unlocked = unlockedAchievements.find(a => a.achievement_key === def.key)
    let progressHint = ''

    if (!unlocked) {
      // Generate progress hint for locked achievements
      if (def.key === 'first_session') progressHint = gam.totalSessions >= 1 ? 'Almost there!' : 'Complete 1 session'
      else if (def.key === 'five_sessions') progressHint = `Complete ${Math.max(0, 5 - gam.totalSessions)} more session${5 - gam.totalSessions !== 1 ? 's' : ''}`
      else if (def.key === 'twenty_sessions') progressHint = `${gam.totalSessions}/20 sessions`
      else if (def.key === 'fifty_sessions') progressHint = `${gam.totalSessions}/50 sessions`
      else if (def.key === 'hundred_sessions') progressHint = `${gam.totalSessions}/100 sessions`
      else if (def.key === 'three_day_streak') progressHint = `${gam.streak}/3 day streak`
      else if (def.key === 'seven_day_streak') progressHint = `${gam.streak}/7 day streak`
      else if (def.key === 'thirty_day_streak') progressHint = `${gam.streak}/30 day streak`
      else if (def.key === 'double_streak') progressHint = `${gam.streak}/10 day streak`
      else if (def.key === 'one_hour') progressHint = `${Math.floor(gam.totalTime / 60)}/60 minutes`
      else if (def.key === 'ten_hours') progressHint = `${Math.floor(gam.totalTime / 3600)}/10 hours`
      else if (def.key === 'level_5') progressHint = `Level ${gam.level}/5`
      else if (def.key === 'level_10') progressHint = `Level ${gam.level}/10`
      else if (def.key === 'intensity_5') progressHint = 'Reach intensity 5 in a session'
      else if (def.key === 'quiz_complete') progressHint = 'Complete the personality quiz'
      else if (def.key === 'profile_created') progressHint = 'Create a session profile'
      else if (def.key === 'longest_streak_7') progressHint = `Longest: ${gam.longestStreak}/7 days`
      else if (def.key === 'night_owl') progressHint = 'Complete a session after midnight'
      else if (def.key === 'early_bird') progressHint = 'Complete a session before 7 AM'
      else if (def.key === 'marathon') progressHint = 'Complete a 60+ minute session'
      else if (def.key === 'intensity_master') progressHint = `${highIntensityCount}/10 sessions at intensity 4+`
      else if (def.key === 'profile_master') progressHint = 'Create 5 session profiles'
      else progressHint = 'Keep going to unlock this!'
    }

    setSelectedAchievement({
      def,
      unlocked: !!unlocked,
      unlockedAt: unlocked?.unlockedAt ?? null,
      progressHint,
    })
  }, [unlockedAchievements, gam, highIntensityCount])

  // ---- Heatmap color helper ----
  const getHeatmapColor = (count: number, isToday: boolean) => {
    if (count === 0) return 'bg-secondary/30'
    if (count === 1) return 'bg-emerald-500/40'
    if (count === 2) return 'bg-emerald-500/65'
    return 'bg-emerald-500'
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

      {/* Achievement Detail Modal */}
      <Dialog open={!!selectedAchievement} onOpenChange={(open) => { if (!open) setSelectedAchievement(null) }}>
        <DialogContent className="bg-card border-border/50 max-w-sm">
          <DialogHeader className="items-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-6xl mb-2"
            >
              {selectedAchievement?.def.icon}
            </motion.div>
            <DialogTitle className="text-xl">
              {selectedAchievement?.def.name}
            </DialogTitle>
            <DialogDescription className="text-center">
              {selectedAchievement?.def.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 pt-2">
            {selectedAchievement?.unlocked ? (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.15 }}
                >
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 border px-3 py-1">
                    <Star className="w-3 h-3 mr-1" />
                    Unlocked
                  </Badge>
                </motion.div>
                {selectedAchievement.unlockedAt && (
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(selectedAchievement.unlockedAt), 'MMMM d, yyyy')}
                  </p>
                )}
              </>
            ) : (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.15 }}
                >
                  <Badge variant="secondary" className="bg-secondary/50 text-muted-foreground border-0 px-3 py-1">
                    <Lock className="w-3 h-3 mr-1" />
                    Locked
                  </Badge>
                </motion.div>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedAchievement?.progressHint}
                </p>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-border/50"
              onClick={() => setSelectedAchievement(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header: Welcome + Insight + Sync Status */}
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

      {/* Stats Cards + Enhanced XP Display */}
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
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Enhanced XP / Level Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className={`bg-card/60 border-border/50 ${closeToLevelUp ? 'border-primary/50' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className={`w-4 h-4 text-violet-400`} />
                <span className="text-xs text-muted-foreground">Level</span>
              </div>
              <div className="flex items-baseline gap-1">
                <motion.p
                  className={`text-4xl font-black ${closeToLevelUp ? 'text-primary' : ''}`}
                  animate={closeToLevelUp ? {
                    textShadow: [
                      '0 0 4px oklch(0.72 0.18 320 / 0.0)',
                      '0 0 16px oklch(0.72 0.18 320 / 0.6)',
                      '0 0 4px oklch(0.72 0.18 320 / 0.0)',
                    ],
                  } : {}}
                  transition={closeToLevelUp ? { duration: 2, repeat: Infinity } : {}}
                >
                  {gam.level}
                </motion.p>
                {closeToLevelUp && (
                  <motion.span
                    className="text-xs text-primary font-semibold"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Almost!
                  </motion.span>
                )}
              </div>
              <div className="mt-2 space-y-1">
                <div className="relative">
                  <Progress
                    value={xpProgress}
                    className={`h-2 bg-secondary ${closeToLevelUp ? '[&>[data-slot=progress-indicator]]:bg-primary' : ''}`}
                  />
                  {closeToLevelUp && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/20"
                      animate={{ opacity: [0, 0.5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {xpToNext} XP to next level
                </p>
                <p className="text-[9px] text-muted-foreground/60">
                  {gam.xp.toLocaleString()} total XP
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Streak Calendar Heatmap */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              Activity — Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Month labels */}
            <div className="flex items-center mb-2">
              {heatmapData.reduce<{ labels: { text: string; index: number }[]; lastMonth: string }>((acc, day, i) => {
                const month = day.monthLabel
                if (month !== acc.lastMonth) {
                  acc.labels.push({ text: month, index: i })
                  acc.lastMonth = month
                }
                return acc
              }, { labels: [], lastMonth: '' }).labels.map((label) => (
                <span
                  key={label.text + label.index}
                  className="text-[9px] text-muted-foreground absolute"
                  style={{ left: `${(label.index / 30) * 100 + 2}%` }}
                >
                  {label.text}
                </span>
              ))}
            </div>
            {/* Heatmap grid */}
            <div className="relative flex flex-wrap gap-1">
              {heatmapData.map((day, i) => (
                <motion.div
                  key={day.dateStr}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.015, 0.5) }}
                  whileHover={{ scale: 1.3 }}
                  className={`relative w-[calc((100%-29px)/30)] aspect-square rounded-sm min-w-[10px] min-h-[10px] max-w-[18px] max-h-[18px] cursor-default transition-colors ${getHeatmapColor(day.count, day.isToday)} ${day.isToday ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                  title={`${format(day.date, 'MMM d, yyyy')}: ${day.count} session${day.count !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 mt-3 text-[9px] text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-0.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-secondary/30" />
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40" />
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/65" />
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              </div>
              <span>More</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
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

      {/* Weekly Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.225 }}>
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-sky-400" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-background/30">
                <p className="text-xs text-muted-foreground">Sessions</p>
                <p className="text-lg font-bold">{weeklySummary.sessions}</p>
              </div>
              <div className="p-3 rounded-lg bg-background/30">
                <p className="text-xs text-muted-foreground">Total Time</p>
                <p className="text-lg font-bold">{weeklySummary.formattedTime}</p>
              </div>
              <div className="p-3 rounded-lg bg-background/30">
                <p className="text-xs text-muted-foreground">Best Day</p>
                <p className="text-lg font-bold">{weeklySummary.bestDay || '—'}</p>
                {weeklySummary.bestDay && (
                  <p className="text-[10px] text-muted-foreground">{weeklySummary.bestDayCount} session{weeklySummary.bestDayCount !== 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-background/30">
                <p className="text-xs text-muted-foreground">vs Last Week</p>
                {weeklySummary.diff > 0 ? (
                  <p className="text-lg font-bold text-emerald-400">+{weeklySummary.diff} session{weeklySummary.diff !== 1 ? 's' : ''}</p>
                ) : weeklySummary.diff < 0 ? (
                  <p className="text-lg font-bold text-red-400">{weeklySummary.diff} session{Math.abs(weeklySummary.diff) !== 1 ? 's' : ''}</p>
                ) : weeklySummary.sessions > 0 ? (
                  <p className="text-lg font-bold text-muted-foreground">Same</p>
                ) : (
                  <p className="text-lg font-bold">—</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Phase 3: Daily + Weekly Challenges */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }}>
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Challenges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Daily Challenge */}
              {challenge.dailyChallengeDef && (
                <div className={`p-3 rounded-lg border transition-all ${challenge.state.dailyChallenge?.completed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-primary/5 border-primary/20'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{challenge.dailyChallengeDef.icon}</span>
                      <div>
                        <p className="text-xs font-medium">{challenge.dailyChallengeDef.title}</p>
                        <p className="text-[10px] text-muted-foreground">Daily · +{challenge.dailyChallengeDef.xpReward} XP</p>
                      </div>
                    </div>
                    {challenge.state.dailyChallenge?.completed && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px]">Done!</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">{challenge.dailyChallengeDef.description}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>{(() => {
                        const p = challenge.dailyChallengeDef.getProgress(challengeStats)
                        const unit = challenge.dailyChallengeDef.category === 'duration' ? 'min' : challenge.dailyChallengeDef.category === 'intensity' ? '' : ''
                        return `${p.current}${unit} / ${p.target}${unit}`
                      })()}</span>
                      <span>{Math.min(100, Math.round((() => {
                        const p = challenge.dailyChallengeDef.getProgress(challengeStats)
                        return (p.current / p.target) * 100
                      })()))}%</span>
                    </div>
                    <Progress value={Math.min(100, (() => {
                      const p = challenge.dailyChallengeDef.getProgress(challengeStats)
                      return (p.current / p.target) * 100
                    })())} className="h-1.5 bg-secondary [&>[data-slot=progress-indicator]]:bg-primary" />
                  </div>
                </div>
              )}

              {/* Weekly Challenge */}
              {challenge.weeklyChallengeDef && (
                <div className={`p-3 rounded-lg border transition-all ${challenge.state.weeklyChallenge?.completed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-violet-500/5 border-violet-500/20'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{challenge.weeklyChallengeDef.icon}</span>
                      <div>
                        <p className="text-xs font-medium">{challenge.weeklyChallengeDef.title}</p>
                        <p className="text-[10px] text-muted-foreground">Weekly · +{challenge.weeklyChallengeDef.xpReward} XP</p>
                      </div>
                    </div>
                    {challenge.state.weeklyChallenge?.completed && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px]">Done!</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">{challenge.weeklyChallengeDef.description}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>{(() => {
                        const p = challenge.weeklyChallengeDef.getProgress(challengeStats)
                        const unit = challenge.weeklyChallengeDef.category === 'duration' ? 'min' : ''
                        return `${p.current}${unit} / ${p.target}${unit}`
                      })()}</span>
                      <span>{Math.min(100, Math.round((() => {
                        const p = challenge.weeklyChallengeDef.getProgress(challengeStats)
                        return (p.current / p.target) * 100
                      })()))}%</span>
                    </div>
                    <Progress value={Math.min(100, (() => {
                      const p = challenge.weeklyChallengeDef.getProgress(challengeStats)
                      return (p.current / p.target) * 100
                    })())} className="h-1.5 bg-secondary [&>[data-slot=progress-indicator]]:bg-violet-400" />
                  </div>
                </div>
              )}
            </div>
            {challenge.state.challengeHistory.length > 0 && (
              <p className="text-[9px] text-muted-foreground mt-2">{challenge.state.challengeHistory.length} challenge{challenge.state.challengeHistory.length !== 1 ? 's' : ''} completed total</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
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
                  <Tooltip contentStyle={{ background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
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
                Duration Trend (14d)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} axisLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} formatter={(value: number) => [`${value} min`, 'Avg Duration']} />
                  <Bar dataKey="avgDuration" fill="oklch(0.65 0.15 160)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Phase 3: Mood Distribution */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flame className="w-4 h-4 text-pink-400" />
                Mood Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              {moodData.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-muted-foreground text-center">Rate your mood after sessions to see distribution here</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={moodData} dataKey="count" nameKey="mood" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2}
                      stroke="none">
                      {moodData.map((_, i) => (
                        <Cell key={i} fill={['oklch(0.72 0.18 320)', 'oklch(0.65 0.15 160)', 'oklch(0.70 0.15 280)', 'oklch(0.65 0.22 25)', 'oklch(0.55 0.05 260)', 'oklch(0.75 0.15 350)', 'oklch(0.50 0.02 260)'][i % 7]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number, name: string) => {
                        const m = moodData.find(d => d.mood === name)
                        return [`${value} session${value !== 1 ? 's' : ''}`, m?.label || name]
                      }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {/* Mood legend */}
              {moodData.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {moodData.slice(0, 5).map(m => (
                    <span key={m.mood} className="text-[9px] text-muted-foreground flex items-center gap-1">
                      {m.emoji} {m.count}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Phase 3: Time-of-Day Analysis + Best Hour */}
      {typedSessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400" />
                Time-of-Day Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeOfDayData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="sessions" fill="oklch(0.70 0.15 55)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {bestHour && (
                <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Moon className="w-3 h-3" />
                  <span>Peak activity: <span className="font-medium text-foreground">{bestHour.label}</span> ({bestHour.count} session{bestHour.count !== 1 ? 's' : ''})</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Personal Bests */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33 }}>
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Medal className="w-4 h-4 text-amber-400" />
              Personal Bests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/30">
                <div className="w-9 h-9 rounded-lg bg-pink-500/15 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-pink-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Longest Session</p>
                  <p className="text-sm font-bold">
                    {typedSessions.length > 0 ? formatDurationLong(personalBests.longestSession) : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/30">
                <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Highest Intensity</p>
                  <p className="text-sm font-bold">
                    {typedSessions.length > 0 ? `I${personalBests.highestIntensity}` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Achievements Grid */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Medal className="w-4 h-4 text-amber-400" />
              Achievements ({unlockedAchievements.length}/{ACHIEVEMENT_DEFS.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-2">
              {ACHIEVEMENT_DEFS.map((def, i) => {
                const unlocked = unlockedAchievements.find(a => a.achievement_key === def.key)
                return (
                  <motion.button
                    key={def.key}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    onClick={() => handleAchievementClick(def)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all cursor-pointer ${
                      unlocked
                        ? 'bg-primary/10 border border-primary/20 hover:bg-primary/15'
                        : 'bg-background/20 opacity-40 hover:opacity-60'
                    }`}
                  >
                    <span className={`text-lg ${unlocked ? '' : 'grayscale'}`}>{def.icon}</span>
                    <span className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-2">{def.name}</span>
                  </motion.button>
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
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentSessions.map((s: Session) => {
                  let sessionMood: SessionMood | null = null
                  if (s.mood) sessionMood = s.mood as SessionMood
                  return (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/30">
                    <div className="flex items-center gap-3">
                      {sessionMood && <span className="text-sm">{MOOD_CONFIG[sessionMood]?.emoji}</span>}
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
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
