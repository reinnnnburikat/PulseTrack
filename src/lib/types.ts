// ============================================================
// PulseTrack — Type Definitions
// ============================================================

export type Tone = 'dominant' | 'hypnotic' | 'teasing'
export type Phase = 'active' | 'rest'
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'
export type AppView = 'dashboard' | 'session' | 'history' | 'profiles' | 'quiz' | 'discover' | 'matches' | 'settings'

// ---- Database row types ----

export interface Session {
  id: string
  user_id: string
  created_at: string
  duration: number
  intensity: number
  profile: string | null
  mood: string | null
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

export interface OfflineSettings {
  id?: number
  user_id: string
  active_duration: number
  rest_duration: number
  intensity_mode: boolean
  tone: string
  lock_in_mode: boolean
  cycles: number
  infinite_cycles: boolean
  synced: boolean
  updated_at: string
}

export interface OfflineProfile {
  id?: number
  profile_id: string
  user_id: string
  name: string
  active_duration: number
  rest_duration: number
  cycles: number
  infinite_cycles: boolean
  tone: string
  intensity_mode: boolean
  synced: boolean
  created_at: string
}

export interface OfflineGamification {
  id?: number
  user_id: string
  streak: number
  longest_streak: number
  total_sessions: number
  total_time: number
  level: number
  xp: number
  last_session_date: string | null
  synced: boolean
  updated_at: string
}

export interface OfflineAchievement {
  id?: number
  achievement_key: string
  user_id: string
  name: string
  description: string
  icon: string
  unlocked_at: string
  synced: boolean
}

// ---- Mood & Tags (Phase 3) ----

export type SessionMood = 'energized' | 'calm' | 'focused' | 'intense' | 'tired' | 'happy' | 'neutral'

export const MOOD_CONFIG: Record<SessionMood, { emoji: string; label: string; color: string }> = {
  energized: { emoji: '⚡', label: 'Energized', color: 'text-yellow-400' },
  calm: { emoji: '😌', label: 'Calm', color: 'text-sky-400' },
  focused: { emoji: '🎯', label: 'Focused', color: 'text-violet-400' },
  intense: { emoji: '🔥', label: 'Intense', color: 'text-red-400' },
  tired: { emoji: '😴', label: 'Tired', color: 'text-gray-400' },
  happy: { emoji: '😊', label: 'Happy', color: 'text-pink-400' },
  neutral: { emoji: '😐', label: 'Neutral', color: 'text-muted-foreground' },
}

export interface SessionMetadata {
  mood: SessionMood | null
  tags: string[]
  focusModeUsed: boolean
}
