import { create } from 'zustand'
import type { AppView, UserSettings, GamificationState, UserProfile } from '@/lib/types'
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

// ---- Gamification Store ----

interface GamStore {
  streak: number
  longestStreak: number
  totalSessions: number
  totalTime: number
  level: number
  xp: number
  loadGamification: (g: Partial<GamificationState>) => void
  incrementSessions: (duration: number) => void
  resetStreak: () => void
  saveGamification: () => Promise<void>
}

export const useGamificationStore = create<GamStore>((set, get) => ({
  streak: 0,
  longestStreak: 0,
  totalSessions: 0,
  totalTime: 0,
  level: 1,
  xp: 0,

  loadGamification: (g) => set({
    streak: g.streak ?? 0,
    longestStreak: g.longest_streak ?? 0,
    totalSessions: g.total_sessions ?? 0,
    totalTime: g.total_time ?? 0,
    level: g.level ?? 1,
    xp: g.xp ?? 0,
  }),

  incrementSessions: (duration: number) => {
    const state = get()
    const today = new Date().toISOString().split('T')[0]
    const xpGain = Math.round(duration / 60 * 10)
    const newXP = state.xp + xpGain
    const newLevel = Math.floor(newXP / 500) + 1
    set({
      totalSessions: state.totalSessions + 1,
      totalTime: state.totalTime + duration,
      xp: newXP,
      level: newLevel,
      longestStreak: Math.max(state.longestStreak, state.streak + 1),
      streak: state.streak + 1,
    })
    get().saveGamification()
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
        last_session_date: new Date().toISOString().split('T')[0],
      }, { onConflict: 'user_id' })
  },
}))
