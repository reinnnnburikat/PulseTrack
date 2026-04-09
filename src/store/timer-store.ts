import { create } from 'zustand'
import type { TimerState, Phase, TimerStatus, Tone } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { useSettingsStore } from './auth-store'

interface TimerStore extends TimerState {
  currentPrompt: string | null
  showEdgingWarning: boolean
  elapsedTime: number

  startTimer: (profile?: { active_duration: number; rest_duration: number; cycles: number; infinite_cycles: boolean; tone: Tone; intensity_mode: boolean }) => void
  pauseTimer: () => void
  resumeTimer: () => void
  resetTimer: () => void
  tick: () => void
  forceTransition: () => void
  completeSession: () => Promise<void>
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  status: 'idle' as TimerStatus,
  phase: 'active' as Phase,
  cycle: 1,
  totalCycles: 4,
  infiniteCycles: false,
  remainingSeconds: 25 * 60,
  activeDuration: 25 * 60,
  restDuration: 5 * 60,
  currentIntensity: 1,
  streak: 0,
  lockInMode: false,
  intensityMode: false,
  tone: 'teasing' as Tone,
  activeProfileId: null,
  currentPrompt: null,
  showEdgingWarning: false,
  elapsedTime: 0,

  startTimer: (profile) => {
    const settings = useSettingsStore.getState()
    const activeDur = profile?.active_duration ?? settings.activeDuration
    const restDur = profile?.rest_duration ?? settings.restDuration
    const cycles = profile?.cycles ?? settings.cycles
    const infinite = profile?.infinite_cycles ?? settings.infiniteCycles
    const tone = profile?.tone ?? settings.tone
    const intensityMode = profile?.intensity_mode ?? settings.intensityMode

    // Adaptive logic: increase difficulty with streak
    const { streak } = get()
    const adaptiveMultiplier = streak > 7 ? 1.3 : streak > 3 ? 1.15 : 1
    const adaptiveDur = Math.round(activeDur * adaptiveMultiplier)
    const adaptiveRest = Math.round(restDur * (streak > 7 ? 0.7 : streak > 3 ? 0.85 : 1))

    set({
      status: 'running',
      phase: 'active',
      cycle: 1,
      totalCycles: cycles,
      infiniteCycles: infinite,
      remainingSeconds: adaptiveDur * 60,
      activeDuration: adaptiveDur * 60,
      restDuration: adaptiveRest * 60,
      currentIntensity: Math.min(5, Math.max(1, Math.floor(streak / 2) + 1)),
      streak,
      lockInMode: settings.lockInMode,
      intensityMode,
      tone,
      elapsedTime: 0,
      currentPrompt: null,
      showEdgingWarning: false,
    })
  },

  pauseTimer: () => set({ status: 'paused' }),
  resumeTimer: () => set({ status: 'running' }),

  resetTimer: () => set({
    status: 'idle',
    phase: 'active',
    cycle: 1,
    remainingSeconds: useSettingsStore.getState().activeDuration * 60,
    elapsedTime: 0,
    currentPrompt: null,
    showEdgingWarning: false,
  }),

  tick: () => {
    const state = get()
    if (state.status !== 'running') return

    const newRemaining = state.remainingSeconds - 1
    const newElapsed = state.elapsedTime + 1

    // Edging warning at 85% of active phase
    const activeTotal = state.activeDuration
    if (state.phase === 'active' && !state.showEdgingWarning) {
      const threshold = Math.round(activeTotal * 0.85)
      const remaining = activeTotal - newRemaining
      if (remaining >= threshold) {
        set({ showEdgingWarning: true })
        return
      }
    }

    // Force transition slightly randomized at ~90%+ of active phase
    if (state.phase === 'active' && state.showEdgingWarning) {
      const elapsed = activeTotal - newRemaining
      const maxPoint = activeTotal
      const variance = Math.random() * (activeTotal * 0.08)
      if (elapsed >= maxPoint - variance) {
        get().forceTransition()
        return
      }
    }

    if (newRemaining <= 0) {
      get().forceTransition()
      return
    }

    set({ remainingSeconds: newRemaining, elapsedTime: newElapsed })

    // Show prompts at intervals (every 30s)
    if (state.intensityMode && newElapsed % 30 === 0) {
      get().fetchPrompt()
    }
  },

  forceTransition: () => {
    const state = get()
    if (state.phase === 'active') {
      // Transition to rest
      set({
        phase: 'rest',
        remainingSeconds: state.restDuration,
        showEdgingWarning: false,
        currentPrompt: null,
      })
      if (state.intensityMode) get().fetchPrompt()
    } else {
      // Rest complete, next cycle
      const nextCycle = state.cycle + 1
      if (!state.infiniteCycles && nextCycle > state.totalCycles) {
        set({ status: 'completed', phase: 'active', showEdgingWarning: false })
        return
      }
      // Increase intensity per cycle
      set({
        phase: 'active',
        cycle: nextCycle,
        remainingSeconds: state.activeDuration,
        currentIntensity: Math.min(5, state.currentIntensity + (nextCycle % 2 === 0 ? 1 : 0)),
        showEdgingWarning: false,
        currentPrompt: null,
      })
      if (state.intensityMode) get().fetchPrompt()
    }
  },

  fetchPrompt: async () => {
    const state = get()
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('prompts')
        .select('content')
        .eq('tone', state.tone)
        .eq('phase', state.phase)
        .gte('intensity', state.currentIntensity - 1)
        .lte('intensity', state.currentIntensity + 1)

      if (data && data.length > 0) {
        const random = data[Math.floor(Math.random() * data.length)]
        set({ currentPrompt: random.content })
      }
    } catch {
      // Silently fail for prompts
    }
  },

  completeSession: async () => {
    const state = get()
    const { user } = useAuthStore.getState()
    if (!user) return

    const duration = state.elapsedTime

    // Save session to Supabase
    const supabase = createClient()
    await supabase.from('sessions').insert({
      user_id: user.id,
      duration,
      intensity: state.currentIntensity,
      profile: state.activeProfileId,
    })

    // Update gamification
    const { useGamificationStore } = await import('./auth-store')
    useGamificationStore.getState().incrementSessions(duration)

    // Save to offline DB as backup
    try {
      const { saveSessionOffline } = await import('@/lib/db-offline')
      await saveSessionOffline({
        session_id: crypto.randomUUID(),
        user_id: user.id,
        created_at: new Date().toISOString(),
        duration,
        intensity: state.currentIntensity,
        profile: state.activeProfileId,
        notes: null,
        synced: true,
      })
    } catch {}

    get().resetTimer()
  },
}))
