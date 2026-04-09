// ============================================================
// PulseTrack — Challenge Store (Zustand)
// ============================================================

import { create } from 'zustand'
import type { ChallengeDef, ChallengeStats, ActiveChallenge, ChallengeState } from '@/lib/challenges'
import { CHALLENGE_DEFS, getTodayDateString, getWeekKey, pickRandomChallenge } from '@/lib/challenges'
import { useAuthStore, useGamificationStore } from '@/store/auth-store'

const STORAGE_KEY = 'pulsetrack-challenges-v3'

// ---- LocalStorage helpers ----

function loadFromLocalStorage<T>(fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // Corrupted data — fall back
  }
  return fallback
}

function saveToLocalStorage(value: ChallengeState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

// ---- Default state ----

const DEFAULT_STATE: ChallengeState = {
  dailyChallenge: null,
  weeklyChallenge: null,
  lastDailyDate: null,
  lastWeeklyDate: null,
  challengeHistory: [],
}

// ---- Store interface ----

interface ChallengeStore {
  state: ChallengeState
  dailyChallengeDef: ChallengeDef | null
  weeklyChallengeDef: ChallengeDef | null

  /** Initialize challenges (call on app init). Loads from localStorage, rotates if expired. */
  initializeChallenges: () => void

  /** Check if today's/weekly challenges are complete based on current stats */
  checkChallenges: (stats: ChallengeStats) => void

  /** Refresh challenge definitions from current state */
  refreshDefs: () => void

  /** Manually set challenge state (from persistence) */
  loadState: (state: ChallengeState) => void

  /** Award XP for completed challenges */
  awardXp: (amount: number) => Promise<void>
}

// ---- Store ----

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
  state: { ...DEFAULT_STATE },
  dailyChallengeDef: null,
  weeklyChallengeDef: null,

  initializeChallenges: () => {
    const stored = loadFromLocalStorage<ChallengeState>({ ...DEFAULT_STATE })
    const today = getTodayDateString()
    const week = getWeekKey()

    let state: ChallengeState = { ...stored }

    // Rotate daily challenge if date changed
    if (state.lastDailyDate !== today || !state.dailyChallenge) {
      const defId = pickRandomChallenge('daily')
      state.dailyChallenge = {
        defId,
        completed: false,
        completedAt: null,
        activatedAt: new Date().toISOString(),
        type: 'daily',
      }
      state.lastDailyDate = today
    }

    // Rotate weekly challenge if week changed
    if (state.lastWeeklyDate !== week || !state.weeklyChallenge) {
      const defId = pickRandomChallenge('weekly')
      state.weeklyChallenge = {
        defId,
        completed: false,
        completedAt: null,
        activatedAt: new Date().toISOString(),
        type: 'weekly',
      }
      state.lastWeeklyDate = week
    }

    set({ state })
    saveToLocalStorage(state)
    get().refreshDefs()
  },

  checkChallenges: (stats: ChallengeStats) => {
    const { state: currentState } = get()
    let updatedState: ChallengeState = { ...currentState }
    let changed = false
    let xpToAward = 0
    const now = new Date().toISOString()

    // Check daily challenge
    if (updatedState.dailyChallenge && !updatedState.dailyChallenge.completed) {
      const def = CHALLENGE_DEFS.find((d) => d.id === updatedState.dailyChallenge!.defId)
      if (def && def.check(stats)) {
        updatedState = {
          ...updatedState,
          dailyChallenge: {
            ...updatedState.dailyChallenge,
            completed: true,
            completedAt: now,
          },
          challengeHistory: [
            ...updatedState.challengeHistory,
            { defId: updatedState.dailyChallenge.defId, completedAt: now, type: 'daily' },
          ],
        }
        xpToAward += def.xpReward
        changed = true
      }
    }

    // Check weekly challenge
    if (updatedState.weeklyChallenge && !updatedState.weeklyChallenge.completed) {
      const def = CHALLENGE_DEFS.find((d) => d.id === updatedState.weeklyChallenge!.defId)
      if (def && def.check(stats)) {
        updatedState = {
          ...updatedState,
          weeklyChallenge: {
            ...updatedState.weeklyChallenge,
            completed: true,
            completedAt: now,
          },
          challengeHistory: [
            ...updatedState.challengeHistory,
            { defId: updatedState.weeklyChallenge.defId, completedAt: now, type: 'weekly' },
          ],
        }
        xpToAward += def.xpReward
        changed = true
      }
    }

    if (changed) {
      set({ state: updatedState })
      saveToLocalStorage(updatedState)
      get().refreshDefs()

      // Award XP via gamification store
      if (xpToAward > 0) {
        get().awardXp(xpToAward)
      }
    }
  },

  refreshDefs: () => {
    const { state } = get()

    const dailyChallengeDef = state.dailyChallenge
      ? CHALLENGE_DEFS.find((d) => d.id === state.dailyChallenge!.defId) ?? null
      : null

    const weeklyChallengeDef = state.weeklyChallenge
      ? CHALLENGE_DEFS.find((d) => d.id === state.weeklyChallenge!.defId) ?? null
      : null

    set({ dailyChallengeDef, weeklyChallengeDef })
  },

  loadState: (newState: ChallengeState) => {
    set({ state: newState })
    saveToLocalStorage(newState)
    get().refreshDefs()
  },

  awardXp: async (amount: number) => {
    // Directly update gamification store's XP and level
    const gam = useGamificationStore.getState()
    const newXP = gam.xp + amount
    const newLevel = Math.floor(newXP / 500) + 1

    useGamificationStore.setState({
      xp: newXP,
      level: newLevel,
    })

    // Persist to Supabase
    const user = useAuthStore.getState().user
    if (user) {
      try {
        await gam.saveGamification()
      } catch {
        // Silently ignore persistence errors; XP is already in local state
      }
    }
  },
}))
