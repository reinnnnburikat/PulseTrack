// ============================================================
// PulseTrack — Type Definitions
// ============================================================

export type Tone = 'dominant' | 'hypnotic' | 'teasing'
export type Phase = 'active' | 'rest'
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'
export type AppView = 'dashboard' | 'session' | 'history' | 'profiles' | 'quiz' | 'settings'

// ---- Database row types ----

export interface Session {
  id: string
  user_id: string
  created_at: string
  duration: number
  intensity: number
  profile: string | null
  notes: string | null
  updated_at?: string
}

export interface UserSettings {
  user_id: string
  active_duration: number
  rest_duration: number
  intensity_mode: boolean
  tone: Tone
  lock_in_mode: boolean
  cycles: number
  infinite_cycles: boolean
}

export interface Prompt {
  id: string
  tone: Tone
  phase: Phase
  intensity: number
  content: string
}

export interface SessionProfile {
  id: string
  user_id: string
  name: string
  active_duration: number
  rest_duration: number
  cycles: number
  infinite_cycles: boolean
  tone: Tone
  intensity_mode: boolean
  created_at: string
}

export interface QuizQuestion {
  id: string
  category: string
  question: string
  options: QuizOption[]
}

export interface QuizOption {
  label: string
  scores: Record<string, number>
}

export interface QuizResult {
  id: string
  user_id: string
  created_at: string
  scores: Record<string, number>
  dominant_trait: string
  role_preference: string
  kinks: string[]
  compatibility_type: string
}

export interface UserProfile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

// ---- Timer state ----

export interface TimerState {
  status: TimerStatus
  phase: Phase
  cycle: number
  totalCycles: number
  infiniteCycles: boolean
  remainingSeconds: number
  activeDuration: number
  restDuration: number
  currentIntensity: number
  streak: number
  lockInMode: boolean
  intensityMode: boolean
  tone: Tone
  activeProfileId: string | null
}

// ---- Gamification ----

export interface GamificationState {
  streak: number
  longestStreak: number
  totalSessions: number
  totalTime: number
  level: number
  xp: number
  achievements: Achievement[]
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlockedAt: string | null
}

// ---- Offline ----

export interface OfflineSession {
  id?: number
  session_id: string
  user_id: string
  created_at: string
  duration: number
  intensity: number
  profile: string | null
  notes: string | null
  synced: boolean
}
