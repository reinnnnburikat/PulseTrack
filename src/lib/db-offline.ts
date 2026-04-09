import Dexie, { type Table } from 'dexie'
import type {
  OfflineSession,
  OfflineSettings,
  OfflineProfile,
  OfflineGamification,
  OfflineAchievement,
} from '@/lib/types'

// ============================================================
// Dexie Database — 5-table offline store
// ============================================================

export class PulseTrackDB extends Dexie {
  sessions!: Table<OfflineSession, number>
  settings!: Table<OfflineSettings, number>
  profiles!: Table<OfflineProfile, number>
  gamification!: Table<OfflineGamification, number>
  achievements!: Table<OfflineAchievement, number>

  constructor() {
    super('PulseTrackOffline')
    this.version(3).stores({
      sessions: '++id, session_id, user_id, synced, created_at',
      settings: '++id, user_id, synced, updated_at',
      profiles: '++id, profile_id, user_id, synced, created_at',
      gamification: '++id, user_id, synced, updated_at',
      achievements: '++id, achievement_key, user_id, synced',
    })
  }
}

export const db = new PulseTrackDB()

// ============================================================
// Sessions — CRUD helpers
// ============================================================

export async function saveSessionOffline(session: OfflineSession) {
  return db.sessions.put({ ...session, synced: false })
}

export async function getUnsyncedSessions(userId: string) {
  return db.sessions.where('user_id').equals(userId).and(s => !s.synced).toArray()
}

export async function markSessionSynced(sessionId: string) {
  return db.sessions.where('session_id').equals(sessionId).modify({ synced: true })
}

export async function deleteSyncedSessions() {
  return db.sessions.where('synced').equals(1).delete()
}

export async function getOfflineSessionCount(userId: string) {
  return db.sessions.where('user_id').equals(userId).and(s => !s.synced).count()
}

// ============================================================
// Settings — CRUD helpers
// ============================================================

export async function saveSettingsOffline(settings: OfflineSettings) {
  return db.settings.put({ ...settings, synced: false })
}

export async function getUnsyncedSettings(userId: string) {
  return db.settings.where('user_id').equals(userId).and(s => !s.synced).toArray()
}

export async function markSettingsSynced(userId: string) {
  return db.settings.where('user_id').equals(userId).modify({ synced: true })
}

export async function deleteSyncedSettings() {
  return db.settings.where('synced').equals(1).delete()
}

// ============================================================
// Profiles — CRUD helpers
// ============================================================

export async function saveProfileOffline(profile: OfflineProfile) {
  return db.profiles.put({ ...profile, synced: false })
}

export async function getUnsyncedProfiles(userId: string) {
  return db.profiles.where('user_id').equals(userId).and(p => !p.synced).toArray()
}

export async function markProfileSynced(profileId: string) {
  return db.profiles.where('profile_id').equals(profileId).modify({ synced: true })
}

export async function deleteSyncedProfiles() {
  return db.profiles.where('synced').equals(1).delete()
}

export async function deleteProfileOffline(profileId: string) {
  return db.profiles.where('profile_id').equals(profileId).delete()
}

// ============================================================
// Gamification — CRUD helpers
// ============================================================

export async function saveGamificationOffline(gamification: OfflineGamification) {
  return db.gamification.put({ ...gamification, synced: false })
}

export async function getUnsyncedGamification(userId: string) {
  return db.gamification.where('user_id').equals(userId).and(g => !g.synced).toArray()
}

export async function markGamificationSynced(userId: string) {
  return db.gamification.where('user_id').equals(userId).modify({ synced: true })
}

export async function deleteSyncedGamification() {
  return db.gamification.where('synced').equals(1).delete()
}

// ============================================================
// Achievements — CRUD helpers
// ============================================================

export async function saveAchievementOffline(achievement: OfflineAchievement) {
  return db.achievements.put({ ...achievement, synced: false })
}

export async function getUnsyncedAchievements(userId: string) {
  return db.achievements.where('user_id').equals(userId).and(a => !a.synced).toArray()
}

export async function markAchievementSynced(achievementKey: string) {
  return db.achievements.where('achievement_key').equals(achievementKey).modify({ synced: true })
}

export async function deleteSyncedAchievements() {
  return db.achievements.where('synced').equals(1).delete()
}

// ============================================================
// Bulk operations
// ============================================================

export async function getTotalUnsyncedCount(userId: string): Promise<number> {
  const [sessions, settings, profiles, gamification, achievements] = await Promise.all([
    db.sessions.where('user_id').equals(userId).and(s => !s.synced).count(),
    db.settings.where('user_id').equals(userId).and(s => !s.synced).count(),
    db.profiles.where('user_id').equals(userId).and(p => !p.synced).count(),
    db.gamification.where('user_id').equals(userId).and(g => !g.synced).count(),
    db.achievements.where('user_id').equals(userId).and(a => !a.synced).count(),
  ])
  return sessions + settings + profiles + gamification + achievements
}

export async function clearAllOfflineData() {
  return Promise.all([
    db.sessions.clear(),
    db.settings.clear(),
    db.profiles.clear(),
    db.gamification.clear(),
    db.achievements.clear(),
  ])
}

// ============================================================
// Offline-first cache functions
// ============================================================

export async function cacheSessionsLocally(
  userId: string,
  sessions: Array<{
    id: string; user_id: string; created_at: string; duration: number
    intensity: number; profile: string | null; notes: string | null
  }>
) {
  await db.sessions
    .where('user_id')
    .equals(userId)
    .delete()
  const offlineSessions: OfflineSession[] = sessions.map(s => ({
    session_id: s.id,
    user_id: s.user_id,
    created_at: s.created_at,
    duration: s.duration,
    intensity: s.intensity,
    profile: s.profile,
    notes: s.notes,
    synced: true,
  }))
  return db.sessions.bulkPut(offlineSessions)
}

export async function cacheSettingsLocally(settings: {
  user_id: string; active_duration: number; rest_duration: number
  intensity_mode: boolean; tone: string; lock_in_mode: boolean
  cycles: number; infinite_cycles: boolean
}) {
  const offlineSettings: OfflineSettings = {
    ...settings,
    synced: true,
    updated_at: new Date().toISOString(),
  }
  return db.settings.put(offlineSettings)
}

export async function cacheProfilesLocally(
  userId: string,
  profiles: Array<{
    id: string; user_id: string; name: string; active_duration: number
    rest_duration: number; cycles: number; infinite_cycles: boolean
    tone: string; intensity_mode: boolean; created_at: string
  }>
) {
  await db.profiles
    .where('user_id')
    .equals(userId)
    .delete()
  const offlineProfiles: OfflineProfile[] = profiles.map(p => ({
    profile_id: p.id,
    user_id: p.user_id,
    name: p.name,
    active_duration: p.active_duration,
    rest_duration: p.rest_duration,
    cycles: p.cycles,
    infinite_cycles: p.infinite_cycles,
    tone: p.tone,
    intensity_mode: p.intensity_mode,
    synced: true,
    created_at: p.created_at,
  }))
  return db.profiles.bulkPut(offlineProfiles)
}

export async function getLocalSettings(userId: string): Promise<OfflineSettings | undefined> {
  return db.settings.where('user_id').equals(userId).first()
}

export async function getLocalProfiles(userId: string): Promise<OfflineProfile[]> {
  return db.profiles.where('user_id').equals(userId).toArray()
}

export async function getLocalGamification(userId: string): Promise<OfflineGamification | undefined> {
  return db.gamification.where('user_id').equals(userId).first()
}

export async function cacheGamificationLocally(data: {
  user_id: string; streak: number; longest_streak: number; total_sessions: number
  total_time: number; level: number; xp: number; last_session_date: string | null
}) {
  const offline: OfflineGamification = {
    ...data,
    synced: true,
    updated_at: new Date().toISOString(),
  }
  return db.gamification.put(offline)
}

export async function cacheAchievementsLocally(
  userId: string,
  achievements: Array<{
    id: string; user_id: string; name: string; description: string
    icon: string; unlocked_at: string
  }>
) {
  await db.achievements
    .where('user_id')
    .equals(userId)
    .delete()
  const offlineAchievements: OfflineAchievement[] = achievements.map(a => ({
    achievement_key: a.id,
    user_id: a.user_id,
    name: a.name,
    description: a.description,
    icon: a.icon,
    unlocked_at: a.unlocked_at,
    synced: true,
  }))
  return db.achievements.bulkPut(offlineAchievements)
}

// ============================================================
// Conflict resolution — latest updated_at wins
// ============================================================

export async function resolveSettingsConflict(local: OfflineSettings, remote: OfflineSettings): Promise<OfflineSettings> {
  if (new Date(local.updated_at) >= new Date(remote.updated_at)) {
    return local
  }
  return remote
}

export async function resolveGamificationConflict(local: OfflineGamification, remote: OfflineGamification): Promise<OfflineGamification> {
  if (new Date(local.updated_at) >= new Date(remote.updated_at)) {
    return local
  }
  return remote
}
