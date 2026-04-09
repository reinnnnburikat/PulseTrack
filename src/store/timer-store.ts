import { create } from 'zustand'
import type { TimerState, Phase, TimerStatus, Tone, SessionMood } from '@/lib/types'
import { apiFetch } from '@/lib/supabase'
import { useSettingsStore } from './auth-store'
import { playSound, startHeartbeat, stopHeartbeat } from '@/lib/audio'
import { notifyPhaseChange, notifySessionComplete } from '@/lib/notifications'
import { vibratePhaseTransition, vibrateWarning, vibrateComplete, vibrateTick } from '@/lib/haptics'

interface TimerStore extends TimerState {
  currentPrompt: string | null
  showEdgingWarning: boolean
  elapsedTime: number
  edgeCount: number
  focusMode: boolean
  lastFiveSeconds: boolean
  sessionMood: SessionMood | null

  startTimer: (profile?: { active_duration: number; rest_duration: number; cycles: number; infinite_cycles: boolean; tone: Tone; intensity_mode: boolean }) => void
  pauseTimer: () => void
  resumeTimer: () => void
  resetTimer: () => void
  tick: () => void
  forceTransition: () => void
  completeSession: () => Promise<void>
  toggleFocusMode: () => void
  setSessionMood: (mood: SessionMood | null) => void
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
  sessionMood: null as SessionMood | null,

  startTimer: (profile) => {
    const settings = useSettingsStore.getState()
    const activeDur = profile?.active_duration ?? settings.activeDuration
    const restDur = profile?.rest_duration ?? settings.restDuration
    const cycles = profile?.cycles ?? settings.cycles
    const infinite = profile?.infinite_cycles ?? settings.infiniteCycles
    const tone = profile?.tone ?? settings.tone
    const intensityMode = profile?.intensity_mode ?? settings.intensityMode

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

    if (settings.soundEnabled) playSound('active-start')
    if (settings.notificationsEnabled) notifyPhaseChange('active', 1)
    vibratePhaseTransition('active')
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

    if (isLastFive && !state.lastFiveSeconds) {
      set({ lastFiveSeconds: true })
      if (settings.soundEnabled) playSound('warning')
      vibrateTick()
    }

    if (state.phase === 'active' && !state.showEdgingWarning) {
      const threshold = Math.round(activeTotal * 0.85)
      const elapsed = activeTotal - newRemaining
      if (elapsed >= threshold) {
        set({ showEdgingWarning: true })
        if (settings.soundEnabled) playSound('warning')
        vibrateWarning()
        return
      }
    }

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

    if (settings.soundEnabled && newElapsed % 15 === 0) {
      playSound(state.phase === 'active' ? 'active-tick' : 'rest-tick')
    }
    if (newElapsed % 30 === 0) {
      vibrateTick()
    }

    if (state.intensityMode && newElapsed % 30 === 0) {
      get().fetchPrompt()
    }
  },

  forceTransition: () => {
    const state = get()
    const settings = useSettingsStore.getState()

    if (state.phase === 'active') {
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
      vibratePhaseTransition('rest')
      if (state.intensityMode) get().fetchPrompt()
    } else {
      const nextCycle = state.cycle + 1
      if (!state.infiniteCycles && nextCycle > state.totalCycles) {
        set({ status: 'completed', phase: 'active', showEdgingWarning: false })
        stopHeartbeat()
        if (settings.soundEnabled) playSound('complete')
        vibrateComplete()
        if (settings.notificationsEnabled) {
          notifySessionComplete(state.cycle, state.elapsedTime)
        }
        return
      }
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
      vibratePhaseTransition('active')
      if (state.intensityMode) get().fetchPrompt()

      if (state.intensityMode && settings.soundEnabled) {
        startHeartbeat(Math.min(140, 60 + state.streak * 5 + newIntensity * 8))
      }
    }
  },

  fetchPrompt: async () => {
    const state = get()
    try {
      const res = await apiFetch(`/api/prompts?tone=${state.tone}&phase=${state.phase}&intensity=${state.currentIntensity}`)
      if (res.data && res.data.length > 0) {
        const random = res.data[Math.floor(Math.random() * res.data.length)]
        set({ currentPrompt: random.content })
      }
    } catch {}
  },

  completeSession: async () => {
    const state = get()
    const { user } = useAuthStore.getState()
    if (!user) return

    const duration = state.elapsedTime

    const metadata: Record<string, unknown> = {}
    if (state.sessionMood) metadata.mood = state.sessionMood
    if (state.focusMode) metadata.focusModeUsed = true
    const notes = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null

    try {
      await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          duration,
          intensity: state.currentIntensity,
          profile: state.activeProfileId,
          notes,
        }),
      })
    } catch {}

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
        notes,
        synced: true,
      })
    } catch {}

    // Check challenges after session completion
    try {
      const { useChallengeStore } = await import('@/store/challenge-store')
      const { useGamificationStore: gamStore } = await import('./auth-store')
      const gam = gamStore.getState()
      const authState = useAuthStore.getState()

      const todayStr = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const [todayRes, weekRes] = await Promise.all([
        apiFetch(`/api/sessions?from=${todayStr}&limit=100`),
        apiFetch(`/api/sessions?from=${weekAgo}&limit=200`),
      ])
      const todaySessions = todayRes.data || []
      const weekSessions = weekRes.data || []
      useChallengeStore.getState().checkChallenges({
        todaySessions: todaySessions.length,
        todayDuration: Math.round(todaySessions.reduce((a: number, s: any) => a + s.duration, 0) / 60),
        todayMaxIntensity: todaySessions.length > 0 ? Math.max(...todaySessions.map((s: any) => s.intensity)) : 0,
        weekSessions: weekSessions.length,
        weekDuration: Math.round(weekSessions.reduce((a: number, s: any) => a + s.duration, 0) / 60),
        weekMaxIntensity: weekSessions.length > 0 ? Math.max(...weekSessions.map((s: any) => s.intensity)) : 0,
        currentStreak: gam.streak,
        focusModeSessionsToday: todaySessions.filter((s: any) => {
          try { return JSON.parse(s.notes || '{}').focusModeUsed } catch { return false }
        }).length,
      })
    } catch {}

    stopHeartbeat()
    set({ sessionMood: null })
    get().resetTimer()
  },

  setSessionMood: (mood: SessionMood | null) => {
    set({ sessionMood: mood })
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
