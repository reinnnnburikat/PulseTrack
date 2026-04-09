import { create } from 'zustand'
import type { TimerState, Phase, TimerStatus, Tone } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { useSettingsStore } from './auth-store'
import { playSound, startHeartbeat, stopHeartbeat } from '@/lib/audio'
import { notifyPhaseChange, notifySessionComplete } from '@/lib/notifications'

interface TimerStore extends TimerState {
  currentPrompt: string | null
  showEdgingWarning: boolean
  elapsedTime: number
  edgeCount: number
  focusMode: boolean
  lastFiveSeconds: boolean

  startTimer: (profile?: { active_duration: number; rest_duration: number; cycles: number; infinite_cycles: boolean; tone: Tone; intensity_mode: boolean }) => void
  pauseTimer: () => void
  resumeTimer: () => void
  resetTimer: () => void
  tick: () => void
  forceTransition: () => void
  completeSession: () => Promise<void>
  toggleFocusMode: () => void
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
  edgeCount: 0,
  focusMode: false,
  lastFiveSeconds: false,

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
      edgeCount: 0,
      lastFiveSeconds: false,
    })

    // Audio + notifications
    if (settings.soundEnabled) playSound('active-start')
    if (settings.notificationsEnabled) notifyPhaseChange('active', 1)
    if (intensityMode && settings.soundEnabled) {
      const heartbeatBPM = Math.min(120, 60 + streak * 5)
      startHeartbeat(heartbeatBPM)
    }
  },

  pauseTimer: () => {
    set({ status: 'paused' })
    stopHeartbeat()
  },

  resumeTimer: () => {
    set({ status: 'running' })
    const state = get()
    if (state.intensityMode) {
      const heartbeatBPM = Math.min(120, 60 + state.streak * 5)
      startHeartbeat(heartbeatBPM)
    }
  },

  resetTimer: () => {
    stopHeartbeat()
    set({
      status: 'idle',
      phase: 'active',
      cycle: 1,
      remainingSeconds: useSettingsStore.getState().activeDuration * 60,
      elapsedTime: 0,
      currentPrompt: null,
      showEdgingWarning: false,
      edgeCount: 0,
      lastFiveSeconds: false,
    })
    // Exit focus mode on reset
    if (get().focusMode) {
      set({ focusMode: false })
      try { document.exitFullscreen?.() } catch {}
    }
  },

  tick: () => {
    const state = get()
    if (state.status !== 'running') return

    const settings = useSettingsStore.getState()
    const newRemaining = state.remainingSeconds - 1
    const newElapsed = state.elapsedTime + 1
    const activeTotal = state.activeDuration
    const isLastFive = newRemaining <= 5 && newRemaining > 0

    // Last 5 seconds warning sound
    if (isLastFive && !state.lastFiveSeconds) {
      set({ lastFiveSeconds: true })
      if (settings.soundEnabled) playSound('warning')
    }

    // Edging warning at 85% of active phase
    if (state.phase === 'active' && !state.showEdgingWarning) {
      const threshold = Math.round(activeTotal * 0.85)
      const elapsed = activeTotal - newRemaining
      if (elapsed >= threshold) {
        set({ showEdgingWarning: true })
        if (settings.soundEnabled) playSound('warning')
        return
      }
    }

    // Force transition with randomized timing (88-98% of active phase)
    if (state.phase === 'active' && state.showEdgingWarning) {
      const elapsed = activeTotal - newRemaining
      const minPoint = Math.round(activeTotal * 0.88)
      const maxPoint = Math.round(activeTotal * 0.98)
      const triggerPoint = minPoint + Math.random() * (maxPoint - minPoint)
      if (elapsed >= triggerPoint) {
        get().forceTransition()
        return
      }
    }

    if (newRemaining <= 0) {
      get().forceTransition()
      return
    }

    set({ remainingSeconds: newRemaining, elapsedTime: newElapsed, lastFiveSeconds: isLastFive })

    // Tick sound every 15 seconds
    if (settings.soundEnabled && newElapsed % 15 === 0) {
      playSound(state.phase === 'active' ? 'active-tick' : 'rest-tick')
    }

    // Show prompts at intervals (every 30s)
    if (state.intensityMode && newElapsed % 30 === 0) {
      get().fetchPrompt()
    }
  },

  forceTransition: () => {
    const state = get()
    const settings = useSettingsStore.getState()

    if (state.phase === 'active') {
      // Transition to rest
      set({
        phase: 'rest',
        remainingSeconds: state.restDuration,
        showEdgingWarning: false,
        currentPrompt: null,
        lastFiveSeconds: false,
        edgeCount: state.edgeCount + 1,
      })
      if (settings.soundEnabled) playSound('rest-start')
      if (settings.notificationsEnabled) notifyPhaseChange('rest', state.cycle)
      if (state.intensityMode) get().fetchPrompt()
    } else {
      // Rest complete, next cycle
      const nextCycle = state.cycle + 1
      if (!state.infiniteCycles && nextCycle > state.totalCycles) {
        set({ status: 'completed', phase: 'active', showEdgingWarning: false })
        stopHeartbeat()
        if (settings.soundEnabled) playSound('complete')
        if (settings.notificationsEnabled) {
          notifySessionComplete(state.cycle, state.elapsedTime)
        }
        return
      }
      // Increase intensity per cycle (escalating)
      const intensityBoost = state.intensityMode ? (nextCycle % 2 === 0 ? 1 : 0) : (nextCycle % 3 === 0 ? 1 : 0)
      const newIntensity = Math.min(5, state.currentIntensity + intensityBoost)
      set({
        phase: 'active',
        cycle: nextCycle,
        remainingSeconds: state.activeDuration,
        currentIntensity: newIntensity,
        showEdgingWarning: false,
        currentPrompt: null,
        lastFiveSeconds: false,
      })
      if (settings.soundEnabled) playSound('active-start')
      if (settings.notificationsEnabled) notifyPhaseChange('active', nextCycle)
      if (state.intensityMode) get().fetchPrompt()

      // Speed up heartbeat with intensity
      if (state.intensityMode && settings.soundEnabled) {
        startHeartbeat(Math.min(140, 60 + state.streak * 5 + newIntensity * 8))
      }
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

    // Update gamification with context for achievement checking
    const { useGamificationStore } = await import('./auth-store')
    useGamificationStore.getState().incrementSessions(duration, {
      peakIntensity: state.currentIntensity,
      edgeCount: state.edgeCount,
    })

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

    stopHeartbeat()
    get().resetTimer()
  },

  toggleFocusMode: async () => {
    const newState = !get().focusMode
    set({ focusMode: newState })
    try {
      if (newState) {
        await document.documentElement.requestFullscreen?.()
      } else {
        await document.exitFullscreen?.()
      }
    } catch {}
  },
}))
