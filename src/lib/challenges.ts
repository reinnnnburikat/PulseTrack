// ============================================================
// PulseTrack — Daily/Weekly Challenge Engine
// ============================================================

// ---- Types ----

export type ChallengeType = 'daily' | 'weekly'
export type ChallengeCategory = 'sessions' | 'duration' | 'intensity' | 'streak' | 'focus'

export interface ChallengeDef {
  id: string
  title: string
  description: string
  icon: string
  type: ChallengeType
  category: ChallengeCategory
  xpReward: number
  /** Check if challenge is complete given current stats */
  check: (stats: ChallengeStats) => boolean
  /** Get progress as { current, target } for display */
  getProgress: (stats: ChallengeStats) => { current: number; target: number }
}

export interface ChallengeStats {
  todaySessions: number
  todayDuration: number
  todayMaxIntensity: number
  weekSessions: number
  weekDuration: number
  weekMaxIntensity: number
  currentStreak: number
  focusModeSessionsToday: number
}

export interface ActiveChallenge {
  defId: string
  completed: boolean
  completedAt: string | null
  activatedAt: string
  type: ChallengeType
}

export interface ChallengeState {
  dailyChallenge: ActiveChallenge | null
  weeklyChallenge: ActiveChallenge | null
  lastDailyDate: string | null
  lastWeeklyDate: string | null
  challengeHistory: Array<{ defId: string; completedAt: string; type: ChallengeType }>
}

// ---- Challenge Definitions ----

export const CHALLENGE_DEFS: ChallengeDef[] = [
  // ── Daily Challenges (10) ──

  {
    id: 'daily_1_session',
    title: 'One is Enough',
    description: 'Complete 1 session today',
    icon: '🎯',
    type: 'daily',
    category: 'sessions',
    xpReward: 15,
    check: (stats) => stats.todaySessions >= 1,
    getProgress: (stats) => ({ current: Math.min(stats.todaySessions, 1), target: 1 }),
  },
  {
    id: 'daily_3_sessions',
    title: 'Triple Threat',
    description: 'Complete 3 sessions today',
    icon: '🔥',
    type: 'daily',
    category: 'sessions',
    xpReward: 40,
    check: (stats) => stats.todaySessions >= 3,
    getProgress: (stats) => ({ current: Math.min(stats.todaySessions, 3), target: 3 }),
  },
  {
    id: 'daily_15min',
    title: 'Quick Burn',
    description: 'Spend 15 minutes in sessions today',
    icon: '⏱️',
    type: 'daily',
    category: 'duration',
    xpReward: 25,
    check: (stats) => stats.todayDuration >= 15,
    getProgress: (stats) => ({ current: Math.min(stats.todayDuration, 15), target: 15 }),
  },
  {
    id: 'daily_30min',
    title: 'Deep Dive',
    description: 'Spend 30 minutes total today',
    icon: '💪',
    type: 'daily',
    category: 'duration',
    xpReward: 45,
    check: (stats) => stats.todayDuration >= 30,
    getProgress: (stats) => ({ current: Math.min(stats.todayDuration, 30), target: 30 }),
  },
  {
    id: 'daily_intensity_4',
    title: 'Push It',
    description: 'Complete a session at intensity 4+',
    icon: '⚡',
    type: 'daily',
    category: 'intensity',
    xpReward: 30,
    check: (stats) => stats.todayMaxIntensity >= 4,
    getProgress: (stats) => ({
      current: Math.min(stats.todayMaxIntensity, 4),
      target: 4,
    }),
  },
  {
    id: 'daily_intensity_5',
    title: 'Max Out',
    description: 'Complete a session at max intensity',
    icon: '💀',
    type: 'daily',
    category: 'intensity',
    xpReward: 50,
    check: (stats) => stats.todayMaxIntensity >= 5,
    getProgress: (stats) => ({
      current: Math.min(stats.todayMaxIntensity, 5),
      target: 5,
    }),
  },
  {
    id: 'daily_focus',
    title: 'Focus Master',
    description: 'Complete a session with focus mode',
    icon: '🧘',
    type: 'daily',
    category: 'focus',
    xpReward: 35,
    check: (stats) => stats.focusModeSessionsToday >= 1,
    getProgress: (stats) => ({
      current: Math.min(stats.focusModeSessionsToday, 1),
      target: 1,
    }),
  },
  {
    id: 'daily_2_focus',
    title: 'Double Focus',
    description: 'Complete 2 focus mode sessions',
    icon: '🔮',
    type: 'daily',
    category: 'focus',
    xpReward: 55,
    check: (stats) => stats.focusModeSessionsToday >= 2,
    getProgress: (stats) => ({
      current: Math.min(stats.focusModeSessionsToday, 2),
      target: 2,
    }),
  },
  {
    id: 'daily_5_sessions',
    title: 'Overachiever',
    description: 'Complete 5 sessions in a day',
    icon: '🏆',
    type: 'daily',
    category: 'sessions',
    xpReward: 75,
    check: (stats) => stats.todaySessions >= 5,
    getProgress: (stats) => ({ current: Math.min(stats.todaySessions, 5), target: 5 }),
  },
  {
    id: 'daily_45min',
    title: 'Marathon Mind',
    description: 'Spend 45 minutes total today',
    icon: '💎',
    type: 'daily',
    category: 'duration',
    xpReward: 60,
    check: (stats) => stats.todayDuration >= 45,
    getProgress: (stats) => ({ current: Math.min(stats.todayDuration, 45), target: 45 }),
  },

  // ── Weekly Challenges (5) ──

  {
    id: 'weekly_7_sessions',
    title: 'Week Warrior',
    description: 'Complete 7 sessions this week',
    icon: '🌟',
    type: 'weekly',
    category: 'sessions',
    xpReward: 60,
    check: (stats) => stats.weekSessions >= 7,
    getProgress: (stats) => ({ current: Math.min(stats.weekSessions, 7), target: 7 }),
  },
  {
    id: 'weekly_3_hours',
    title: 'Time Investment',
    description: 'Spend 3 hours total this week',
    icon: '⭐',
    type: 'weekly',
    category: 'duration',
    xpReward: 100,
    check: (stats) => stats.weekDuration >= 180,
    getProgress: (stats) => ({ current: Math.min(stats.weekDuration, 180), target: 180 }),
  },
  {
    id: 'weekly_5_day_streak',
    title: 'Streak Legend',
    description: 'Reach a 5-day streak',
    icon: '🚀',
    type: 'weekly',
    category: 'streak',
    xpReward: 80,
    check: (stats) => stats.currentStreak >= 5,
    getProgress: (stats) => ({
      current: Math.min(stats.currentStreak, 5),
      target: 5,
    }),
  },
  {
    id: 'weekly_10_sessions',
    title: 'Session Machine',
    description: 'Complete 10 sessions this week',
    icon: '👑',
    type: 'weekly',
    category: 'sessions',
    xpReward: 120,
    check: (stats) => stats.weekSessions >= 10,
    getProgress: (stats) => ({ current: Math.min(stats.weekSessions, 10), target: 10 }),
  },
  {
    id: 'weekly_5_hours',
    title: 'Dedicated Devotee',
    description: 'Spend 5 hours total this week',
    icon: '💫',
    type: 'weekly',
    category: 'duration',
    xpReward: 200,
    check: (stats) => stats.weekDuration >= 300,
    getProgress: (stats) => ({ current: Math.min(stats.weekDuration, 300), target: 300 }),
  },
]

// ---- Helpers ----

/** Get today's date as YYYY-MM-DD string */
export function getTodayDateString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Get ISO week number for a given date */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** Get a week key string in the format YYYY-WXX */
export function getWeekKey(): string {
  const d = new Date()
  const week = getISOWeekNumber(d)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Pick a random challenge def ID from the pool by type */
export function pickRandomChallenge(type: ChallengeType): string {
  const pool = CHALLENGE_DEFS.filter((def) => def.type === type)
  const idx = Math.floor(Math.random() * pool.length)
  return pool[idx].id
}
