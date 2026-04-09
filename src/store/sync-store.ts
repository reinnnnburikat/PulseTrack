import { create } from 'zustand'
import { apiFetch } from '@/lib/supabase'

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: string | null
  lastSyncStatus: SyncStatus
  setOnline: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setPendingCount: (n: number) => void
  setLastSyncStatus: (s: SyncStatus) => void

  syncOfflineSessions: () => Promise<void>
  syncOfflineSettings: () => Promise<void>
  syncOfflineProfiles: () => Promise<void>
  syncOfflineGamification: () => Promise<void>
  syncOfflineAchievements: () => Promise<void>

  syncAll: () => Promise<void>
  cacheRemoteData: () => Promise<void>
  updatePendingCount: () => Promise<void>
  startSyncListener: () => () => void
}

async function getUser() {
  try {
    const res = await apiFetch('/api/auth/me')
    return res.user || null
  } catch {
    return null
  }
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastSyncStatus: 'idle' as SyncStatus,

  setOnline: (v) => set({ isOnline: v }),
  setSyncing: (v) => set({ isSyncing: v }),
  setPendingCount: (n) => set({ pendingCount: n }),
  setLastSyncStatus: (s) => set({ lastSyncStatus: s }),

  syncOfflineSessions: async () => {
    const user = await getUser()
    if (!user) return

    try {
      const {
        getUnsyncedSessions,
        markSessionSynced,
        deleteSyncedSessions,
      } = await import('@/lib/db-offline')

      const unsynced = await getUnsyncedSessions(user.id)
      if (unsynced.length === 0) return

      for (const session of unsynced) {
        try {
          await apiFetch('/api/sessions', {
            method: 'POST',
            body: JSON.stringify({
              id: session.session_id,
              duration: session.duration,
              intensity: session.intensity,
              profile: session.profile,
              notes: session.notes,
            }),
          })
          await markSessionSynced(session.session_id!)
        } catch {}
      }

      await deleteSyncedSessions()
    } catch {}
  },

  syncOfflineSettings: async () => {
    const user = await getUser()
    if (!user) return

    try {
      const {
        getUnsyncedSettings,
        markSettingsSynced,
        deleteSyncedSettings,
        getLocalSettings,
      } = await import('@/lib/db-offline')

      const unsynced = await getUnsyncedSettings(user.id)
      if (unsynced.length === 0) return

      for (const settings of unsynced) {
        try {
          await apiFetch('/api/settings', {
            method: 'PUT',
            body: JSON.stringify({
              active_duration: settings.active_duration,
              rest_duration: settings.rest_duration,
              intensity_mode: settings.intensity_mode,
              tone: settings.tone,
              lock_in_mode: settings.lock_in_mode,
              cycles: settings.cycles,
              infinite_cycles: settings.infinite_cycles,
            }),
          })
          await markSettingsSynced(user.id)
        } catch {}
      }

      await deleteSyncedSettings()
    } catch {}
  },

  syncOfflineProfiles: async () => {
    const user = await getUser()
    if (!user) return

    try {
      const {
        getUnsyncedProfiles,
        markProfileSynced,
        deleteSyncedProfiles,
      } = await import('@/lib/db-offline')

      const unsynced = await getUnsyncedProfiles(user.id)
      if (unsynced.length === 0) return

      for (const profile of unsynced) {
        try {
          await apiFetch('/api/profiles', {
            method: 'POST',
            body: JSON.stringify({
              id: profile.profile_id,
              name: profile.name,
              active_duration: profile.active_duration,
              rest_duration: profile.rest_duration,
              cycles: profile.cycles,
              infinite_cycles: profile.infinite_cycles,
              tone: profile.tone,
              intensity_mode: profile.intensity_mode,
            }),
          })
          await markProfileSynced(profile.profile_id!)
        } catch {}
      }

      await deleteSyncedProfiles()
    } catch {}
  },

  syncOfflineGamification: async () => {
    const user = await getUser()
    if (!user) return

    try {
      const {
        getUnsyncedGamification,
        markGamificationSynced,
        deleteSyncedGamification,
      } = await import('@/lib/db-offline')

      const unsynced = await getUnsyncedGamification(user.id)
      if (unsynced.length === 0) return

      for (const gam of unsynced) {
        try {
          await apiFetch('/api/gamification', {
            method: 'PUT',
            body: JSON.stringify({
              streak: gam.streak,
              longest_streak: gam.longest_streak,
              total_sessions: gam.total_sessions,
              total_time: gam.total_time,
              level: gam.level,
              xp: gam.xp,
              last_session_date: gam.last_session_date,
            }),
          })
          await markGamificationSynced(user.id)
        } catch {}
      }

      await deleteSyncedGamification()
    } catch {}
  },

  syncOfflineAchievements: async () => {
    const user = await getUser()
    if (!user) return

    try {
      const {
        getUnsyncedAchievements,
        markAchievementSynced,
        deleteSyncedAchievements,
      } = await import('@/lib/db-offline')

      const unsynced = await getUnsyncedAchievements(user.id)
      if (unsynced.length === 0) return

      for (const achievement of unsynced) {
        try {
          await apiFetch('/api/achievements', {
            method: 'POST',
            body: JSON.stringify({
              achievement_key: achievement.achievement_key,
              name: achievement.name,
              description: achievement.description,
              icon: achievement.icon,
              unlocked_at: achievement.unlocked_at,
            }),
          })
          await markAchievementSynced(achievement.achievement_key!)
        } catch {}
      }

      await deleteSyncedAchievements()
    } catch {}
  },

  syncAll: async () => {
    if (get().isSyncing) return
    set({ isSyncing: true, lastSyncStatus: 'syncing' })

    try {
      const state = get()
      await Promise.allSettled([
        state.syncOfflineSessions(),
        state.syncOfflineSettings(),
        state.syncOfflineProfiles(),
        state.syncOfflineGamification(),
        state.syncOfflineAchievements(),
      ])

      set({
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'success',
      })
    } catch {
      set({ lastSyncStatus: 'error' })
    } finally {
      set({ isSyncing: false })
      get().updatePendingCount()
    }
  },

  cacheRemoteData: async () => {
    const user = await getUser()
    if (!user) return

    try {
      const {
        cacheSessionsLocally,
        cacheSettingsLocally,
        cacheProfilesLocally,
        cacheGamificationLocally,
        cacheAchievementsLocally,
      } = await import('@/lib/db-offline')

      const [sessionsRes, settingsRes, profilesRes, gamRes, achRes] = await Promise.allSettled([
        apiFetch('/api/sessions?limit=100'),
        apiFetch('/api/settings'),
        apiFetch('/api/profiles'),
        apiFetch('/api/gamification'),
        apiFetch('/api/achievements'),
      ])

      if (sessionsRes.status === 'fulfilled' && sessionsRes.value.data?.length > 0) {
        await cacheSessionsLocally(user.id, sessionsRes.value.data)
      }
      if (settingsRes.status === 'fulfilled' && settingsRes.value.data) {
        await cacheSettingsLocally(settingsRes.value.data)
      }
      if (profilesRes.status === 'fulfilled' && profilesRes.value.data?.length > 0) {
        await cacheProfilesLocally(user.id, profilesRes.value.data)
      }
      if (gamRes.status === 'fulfilled' && gamRes.value.data) {
        await cacheGamificationLocally(gamRes.value.data)
      }
      if (achRes.status === 'fulfilled' && achRes.value.data?.length > 0) {
        await cacheAchievementsLocally(user.id, achRes.value.data)
      }
    } catch {}
  },

  updatePendingCount: async () => {
    try {
      const { getTotalUnsyncedCount } = await import('@/lib/db-offline')
      const user = await getUser()
      if (user) {
        const count = await getTotalUnsyncedCount(user.id)
        set({ pendingCount: count })
      }
    } catch {}
  },

  startSyncListener: () => {
    const handleOnline = () => {
      set({ isOnline: true })
      setTimeout(() => {
        get().syncAll()
      }, 1000)
    }
    const handleOffline = () => set({ isOnline: false })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const interval = setInterval(() => {
      if (get().isOnline) get().syncAll()
    }, 30000)

    setTimeout(async () => {
      await get().updatePendingCount()
      if (get().isOnline) {
        await get().cacheRemoteData()
      }
    }, 2000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  },
}))
