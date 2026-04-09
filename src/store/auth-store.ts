import { create } from 'zustand'
import type { AppView, UserSettings, GamificationState, UserProfile, Achievement } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  view: AppView
  setView: (view: AppView) => void
  setProfile: (profile: UserProfile | null) => void
  initialize: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  view: 'dashboard',

  setView: (view) => set({ view }),
  setProfile: (profile) => set({ profile }),

  initialize: async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        set({ user: session.user, session, loading: false })
        // Fetch or create profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (profile) {
          set({ profile })
        } else {
          const { data: newProfile } = await supabase
            .from('user_profiles')
            .insert({
              user_id: session.user.id,
              email: session.user.email || '',
              display_name: session.user.user_metadata?.full_name || null,
              avatar_url: session.user.user_metadata?.avatar_url || null,
            })
            .select()
            .single()
          set({ profile: newProfile })
        }

        // Fetch settings
        const { data: settings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        if (settings) {
          get().initSettings(settings as UserSettings)
        }

        // Fetch gamification
        const { data: gam } = await supabase
          .from('gamification')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
        if (gam) {
          useGamificationStore.getState().loadGamification(gam as any)
        }

        // Fetch achievements
        const { data: achs } = await supabase
          .from('achievements')
          .select('*')
          .eq('user_id', session.user.id)
        if (achs) {
          useGamificationStore.getState().loadAchievements(achs as any[])
        }
      } else {
        set({ loading: false })
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          set({ user: session.user, session })
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, session: null, profile: null })
        }
      })
    } catch (e) {
      console.error('Auth init error:', e)
      set({ loading: false })
    }
  },

  signOut: async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null, view: 'dashboard' })
  },
}))

// ---- Settings Store ----

interface SettingsState {
  activeDuration: number
  restDuration: number
  intensityMode: boolean
  tone: 'dominant' | 'hypnotic' | 'teasing'
  lockInMode: boolean
  cycles: number
  infiniteCycles: boolean
  soundEnabled: boolean
  notificationsEnabled: boolean
  initSettings: (s: Partial<UserSettings>) => void
  updateSettings: (s: Partial<SettingsState>) => void
  saveSettings: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  activeDuration: 25,
  restDuration: 5,
  intensityMode: false,
  tone: 'teasing',
  lockInMode: false,
  cycles: 4,
  infiniteCycles: false,
  soundEnabled: true,
  notificationsEnabled: true,

  initSettings: (s) => set({
    activeDuration: s.active_duration ?? 25,
    restDuration: s.rest_duration ?? 5,
    intensityMode: s.intensity_mode ?? false,
    tone: (s.tone as any) ?? 'teasing',
    lockInMode: s.lock_in_mode ?? false,
    cycles: s.cycles ?? 4,
    infiniteCycles: s.infinite_cycles ?? false,
  }),

  updateSettings: (s) => set(s),

  saveSettings: async () => {
    const { user } = useAuthStore.getState()
    if (!user) return
    const state = get()
    const supabase = createClient()

    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        active_duration: state.activeDuration,
        rest_duration: state.restDuration,
        intensity_mode: state.intensityMode,
        tone: state.tone,
        lock_in_mode: state.lockInMode,
        cycles: state.cycles,
        infinite_cycles: state.infiniteCycles,
      }, { onConflict: 'user_id' })
  },
}))

// ---- Achievement Definitions ----

export interface AchievementDef {
  key: string
  name: string
  description: string
  icon: string
  check: (state: { totalSessions: number; totalTime: number; streak: number; longestStreak: number; level: number; xp: number }, context?: Record<string, number>) => boolean
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { key: 'first_session', name: 'First Step', description: 'Complete your first session', icon: '🎯', check: (s) => s.totalSessions >= 1 },
  { key: 'five_sessions', name: 'Getting Started', description: 'Complete 5 sessions', icon: '⭐', check: (s) => s.totalSessions >= 5 },
  { key: 'twenty_sessions', name: 'Dedicated', description: 'Complete 20 sessions', icon: '💫', check: (s) => s.totalSessions >= 20 },
  { key: 'fifty_sessions', name: 'Half Century', description: 'Complete 50 sessions', icon: '🔥', check: (s) => s.totalSessions >= 50 },
  { key: 'hundred_sessions', name: 'Centurion', description: 'Complete 100 sessions', icon: '👑', check: (s) => s.totalSessions >= 100 },
  { key: 'three_day_streak', name: 'On a Roll', description: 'Maintain a 3-day streak', icon: '📈', check: (s) => s.streak >= 3 },
  { key: 'seven_day_streak', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '⚡', check: (s) => s.streak >= 7 },
  { key: 'thirty_day_streak', name: 'Unstoppable', description: 'Maintain a 30-day streak', icon: '💎', check: (s) => s.streak >= 30 },
  { key: 'one_hour', name: 'Time Invested', description: 'Accumulate 1 hour total', icon: '⏱️', check: (s) => s.totalTime >= 3600 },
  { key: 'ten_hours', name: 'Time Master', description: 'Accumulate 10 hours total', icon: '🕐', check: (s) => s.totalTime >= 36000 },
  { key: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: '🌟', check: (s) => s.level >= 5 },
  { key: 'level_10', name: 'Elite', description: 'Reach level 10', icon: '🏆', check: (s) => s.level >= 10 },
  { key: 'intensity_5', name: 'Edge Walker', description: 'Complete a session at intensity 5', icon: '💀', check: (_s, ctx) => (ctx?.peakIntensity ?? 0) >= 5 },
  { key: 'quiz_complete', name: 'Self-Discovery', description: 'Complete the personality quiz', icon: '🧠', check: (_s, ctx) => (ctx?.quizCompleted ?? 0) >= 1 },
  { key: 'profile_created', name: 'Planner', description: 'Create a session profile', icon: '📋', check: (_s, ctx) => (ctx?.profilesCreated ?? 0) >= 1 },
  { key: 'longest_streak_7', name: 'Personal Best', description: 'Set a longest streak of 7+', icon: '🏅', check: (s) => s.longestStreak >= 7 },
  { key: 'night_owl', name: 'Night Owl', description: 'Complete a session after midnight', icon: '🦉', check: (_s, ctx) => (ctx?.afterMidnight ?? 0) >= 1 },
  { key: 'early_bird', name: 'Early Bird', description: 'Complete a session before 7 AM', icon: '🐦', check: (_s, ctx) => (ctx?.before7AM ?? 0) >= 1 },
  { key: 'marathon', name: 'Marathon', description: 'Complete a session lasting 60+ minutes', icon: '🏃', check: (_s, ctx) => (ctx?.longSession ?? 0) >= 1 },
  { key: 'double_streak', name: 'Double Digits', description: 'Reach a 10-day streak', icon: '🔥', check: (s) => s.streak >= 10 },
  { key: 'intensity_master', name: 'Intensity Master', description: 'Complete 10 sessions at intensity 4+', icon: '⚡', check: (_s, ctx) => (ctx?.highIntensitySessions ?? 0) >= 10 },
  { key: 'profile_master', name: 'Profile Collector', description: 'Create 5 session profiles', icon: '🎯', check: (_s, ctx) => (ctx?.profilesCreated ?? 0) >= 5 },
]

// ---- Gamification Store ----

interface GamStore {
  streak: number
  longestStreak: number
  totalSessions: number
  totalTime: number
  level: number
  xp: number
  lastSessionDate: string | null
  achievements: Achievement[]
  newlyUnlocked: string | null
  loadGamification: (g: Partial<GamificationState>) => void
  loadAchievements: (achs: any[]) => void
  incrementSessions: (duration: number, context?: Record<string, number>) => void
  resetStreak: () => void
  saveGamification: () => Promise<void>
  checkAchievements: (context?: Record<string, number>) => Promise<string[]>
}

export const useGamificationStore = create<GamStore>((set, get) => ({
  streak: 0,
  longestStreak: 0,
  totalSessions: 0,
  totalTime: 0,
  level: 1,
  xp: 0,
  lastSessionDate: null,
  achievements: [],
  newlyUnlocked: null,

  loadGamification: (g) => set({
    streak: g.streak ?? 0,
    longestStreak: g.longest_streak ?? 0,
    totalSessions: g.total_sessions ?? 0,
    totalTime: g.total_time ?? 0,
    level: g.level ?? 1,
    xp: g.xp ?? 0,
    lastSessionDate: (g as any).last_session_date ?? null,
  }),

  loadAchievements: (achs) => set({
    achievements: (achs || []).map((a: any) => ({
      id: a.id,
      achievement_key: a.achievement_key,
      name: a.name,
      description: a.description,
      icon: a.icon,
      unlockedAt: a.unlocked_at,
    })),
  }),

  incrementSessions: (duration: number, context?: Record<string, number>) => {
    const state = get()
    const today = new Date().toISOString().split('T')[0]

    // Check if streak should continue or reset
    let newStreak = 1
    if (state.lastSessionDate) {
      const lastDate = new Date(state.lastSessionDate)
      const todayDate = new Date(today)
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        newStreak = state.streak + 1
      } else if (diffDays === 0) {
        newStreak = state.streak // Same day, don't increment
      }
      // diffDays > 1 means streak broken — new streak starts at 1
    }

    const xpGain = Math.round(duration / 60 * 10) + (newStreak > 3 ? 20 : 0) // Bonus XP for streaks
    const newXP = state.xp + xpGain
    const newLevel = Math.floor(newXP / 500) + 1

    set({
      totalSessions: state.totalSessions + 1,
      totalTime: state.totalTime + duration,
      xp: newXP,
      level: newLevel,
      longestStreak: Math.max(state.longestStreak, newStreak),
      streak: newStreak,
      lastSessionDate: today,
    })

    get().saveGamification()

    // Check achievements after a short delay
    setTimeout(() => {
      get().checkAchievements(context)
    }, 500)
  },

  resetStreak: () => {
    set({ streak: 0 })
    get().saveGamification()
  },

  saveGamification: async () => {
    const { user } = useAuthStore.getState()
    if (!user) return
    const state = get()
    const supabase = createClient()

    await supabase
      .from('gamification')
      .upsert({
        user_id: user.id,
        streak: state.streak,
        longest_streak: state.longestStreak,
        total_sessions: state.totalSessions,
        total_time: state.totalTime,
        level: state.level,
        xp: state.xp,
        last_session_date: state.lastSessionDate,
      }, { onConflict: 'user_id' })
  },

  checkAchievements: async (context?: Record<string, number>) => {
    const { user } = useAuthStore.getState()
    if (!user) return []

    const state = get()
    const unlockedKeys = new Set(state.achievements.map(a => a.achievement_key))
    const newUnlocks: string[] = []

    for (const def of ACHIEVEMENT_DEFS) {
      if (unlockedKeys.has(def.key)) continue
      if (def.check(state, context)) {
        newUnlocks.push(def.key)
        // Save to DB
        try {
          const supabase = createClient()
          await supabase.from('achievements').upsert({
            user_id: user.id,
            achievement_key: def.key,
            name: def.name,
            description: def.description,
            icon: def.icon,
            unlocked_at: new Date().toISOString(),
          }, { onConflict: 'user_id,achievement_key' })
        } catch {}
      }
    }

    if (newUnlocks.length > 0) {
      // Refresh achievements
      const supabase = createClient()
      const { data: achs } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user.id)
      if (achs) {
        set({
          achievements: achs.map((a: any) => ({
            id: a.id,
            achievement_key: a.achievement_key,
            name: a.name,
            description: a.description,
            icon: a.icon,
            unlockedAt: a.unlocked_at,
          })),
          newlyUnlocked: newUnlocks[0],
        })
        // Clear the new unlock notification after 5 seconds
        setTimeout(() => set({ newlyUnlocked: null }), 5000)
      }
    }

    return newUnlocks
  },
}))
