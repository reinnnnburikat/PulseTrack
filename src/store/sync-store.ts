import { create } from 'zustand'

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

  // Individual sync methods
  syncOfflineSessions: () => Promise<void>
  syncOfflineSettings: () => Promise<void>
  syncOfflineProfiles: () => Promise<void>
  syncOfflineGamification: () => Promise<void>
  syncOfflineAchievements: () => Promise<void>

  // Combined sync
  syncAll: () => Promise<void>

  // Cache remote data locally
  cacheRemoteData: () => Promise<void>

  // Update pending count helper
  updatePendingCount: () => Promise<void>

  // Start listeners
  startSyncListener: () => () => void
}

async function getUser() {
  const { createClient } = await import('@/lib/supabase')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
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

  // ---- Sessions sync ----
  syncOfflineSessions: async () => {
    const user = await getUser()
    if (!user) return

    const {
      getUnsyncedSessions,
      markSessionSynced,
      deleteSyncedSessions,
    } = await import('@/lib/db-offline')
    const { createClient } = await import('@/lib/supabase')
    const supabase = createClient()

    const unsynced = await getUnsyncedSessions(user.id)
    if (unsynced.length === 0) return

    for (const session of unsynced) {
      try {
        await supabase.from('sessions').upsert(
          {
            id: session.session_id,
            user_id: session.user_id,
            created_at: session.created_at,
            duration: session.duration,
            intensity: session.intensity,
            profile: session.profile,
            notes: session.notes,
            updated_at: session.created_at,
          },
          { onConflict: 'id' },
        )
        await markSessionSynced(session.session_id!)
      } catch {
        // Skip failed individual syncs
      }
    }

    await deleteSyncedSessions()
  },

  // ---- Settings sync ----
  syncOfflineSettings: async () => {
    const user = await getUser()
    if (!user) return

    const {
      getUnsyncedSettings,
      markSettingsSynced,
      deleteSyncedSettings,
      resolveSettingsConflict,
      getLocalSettings,
    } = await import('@/lib/db-offline')
    const { createClient } = await import('@/lib/supabase')
    const supabase = createClient()

    const unsynced = await getUnsyncedSettings(user.id)
    if (unsynced.length === 0) return

    for (const settings of unsynced) {
      try {
        // Check remote for conflict
        const { data: remote } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', settings.user_id)
          .single()

        const local = await getLocalSettings(user.id)
        if (remote && local) {
          const resolved = await resolveSettingsConflict(local, {
            ...settings,
            id: undefined,
          })
          await supabase.from('user_settings').upsert(
            {
              user_id: resolved.user_id,
              active_duration: resolved.active_duration,
              rest_duration: resolved.rest_duration,
              intensity_mode: resolved.intensity_mode,
              tone: resolved.tone,
              lock_in_mode: resolved.lock_in_mode,
              cycles: resolved.cycles,
              infinite_cycles: resolved.infinite_cycles,
            },
            { onConflict: 'user_id' },
          )
        } else {
          await supabase.from('user_settings').upsert(
            {
              user_id: settings.user_id,
              active_duration: settings.active_duration,
              rest_duration: settings.rest_duration,
              intensity_mode: settings.intensity_mode,
              tone: settings.tone,
              lock_in_mode: settings.lock_in_mode,
              cycles: settings.cycles,
              infinite_cycles: settings.infinite_cycles,
            },
            { onConflict: 'user_id' },
          )
        }
        await markSettingsSynced(user.id)
      } catch {
        // Skip failed sync
      }
    }

    await deleteSyncedSettings()
  },

  // ---- Profiles sync ----
  syncOfflineProfiles: async () => {
    const user = await getUser()
    if (!user) return

    const {
      getUnsyncedProfiles,
      markProfileSynced,
      deleteSyncedProfiles,
    } = await import('@/lib/db-offline')
    const { createClient } = await import('@/lib/supabase')
    const supabase = createClient()

    const unsynced = await getUnsyncedProfiles(user.id)
    if (unsynced.length === 0) return

    for (const profile of unsynced) {
      try {
        await supabase.from('session_profiles').upsert(
          {
            id: profile.profile_id,
            user_id: profile.user_id,
            name: profile.name,
            active_duration: profile.active_duration,
            rest_duration: profile.rest_duration,
            cycles: profile.cycles,
            infinite_cycles: profile.infinite_cycles,
            tone: profile.tone,
            intensity_mode: profile.intensity_mode,
            created_at: profile.created_at,
          },
          { onConflict: 'id' },
        )
        await markProfileSynced(profile.profile_id!)
      } catch {
        // Skip failed sync
      }
    }

    await deleteSyncedProfiles()
  },

  // ---- Gamification sync ----
  syncOfflineGamification: async () => {
    const user = await getUser()
    if (!user) return

    const {
      getUnsyncedGamification,
      markGamificationSynced,
      deleteSyncedGamification,
      resolveGamificationConflict,
      getLocalGamification,
    } = await import('@/lib/db-offline')
    const { createClient } = await import('@/lib/supabase')
    const supabase = createClient()

    const unsynced = await getUnsyncedGamification(user.id)
    if (unsynced.length === 0) return

    for (const gam of unsynced) {
      try {
        // Check remote for conflict
        const { data: remote } = await supabase
          .from('gamification')
          .select('*')
          .eq('user_id', gam.user_id)
          .single()

        const local = await getLocalGamification(user.id)
        if (remote && local) {
          const resolved = await resolveGamificationConflict(local, {
            ...gam,
            id: undefined,
          })
          await supabase.from('gamification').upsert(
            {
              user_id: resolved.user_id,
              streak: resolved.streak,
              longest_streak: resolved.longest_streak,
              total_sessions: resolved.total_sessions,
              total_time: resolved.total_time,
              level: resolved.level,
              xp: resolved.xp,
              last_session_date: resolved.last_session_date,
            },
            { onConflict: 'user_id' },
          )
        } else {
          await supabase.from('gamification').upsert(
            {
              user_id: gam.user_id,
              streak: gam.streak,
              longest_streak: gam.longest_streak,
              total_sessions: gam.total_sessions,
              total_time: gam.total_time,
              level: gam.level,
              xp: gam.xp,
              last_session_date: gam.last_session_date,
            },
            { onConflict: 'user_id' },
          )
        }
        await markGamificationSynced(user.id)
      } catch {
        // Skip failed sync
      }
    }

    await deleteSyncedGamification()
  },

  // ---- Achievements sync ----
  syncOfflineAchievements: async () => {
    const user = await getUser()
    if (!user) return

    const {
      getUnsyncedAchievements,
      markAchievementSynced,
      deleteSyncedAchievements,
    } = await import('@/lib/db-offline')
    const { createClient } = await import('@/lib/supabase')
    const supabase = createClient()

    const unsynced = await getUnsyncedAchievements(user.id)
    if (unsynced.length === 0) return

    for (const achievement of unsynced) {
      try {
        await supabase.from('achievements').upsert(
          {
            id: achievement.achievement_key,
            user_id: achievement.user_id,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            unlocked_at: achievement.unlocked_at,
          },
          { onConflict: 'id' },
        )
        await markAchievementSynced(achievement.achievement_key!)
      } catch {
        // Skip failed sync
      }
    }

    await deleteSyncedAchievements()
  },

  // ---- Sync all data types ----
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

  // ---- Cache remote data locally for offline access ----
  cacheRemoteData: async () => {
    const user = await getUser()
    if (!user) return

    const { createClient } = await import('@/lib/supabase')
    const supabase = createClient()

    try {
      const {
        cacheSessionsLocally,
        cacheSettingsLocally,
        cacheProfilesLocally,
        cacheGamificationLocally,
        cacheAchievementsLocally,
      } = await import('@/lib/db-offline')

      // Cache sessions (last 100)
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (sessions && sessions.length > 0) {
        await cacheSessionsLocally(user.id, sessions)
      }

      // Cache settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (settings) {
        await cacheSettingsLocally(settings)
      }

      // Cache profiles
      const { data: profiles } = await supabase
        .from('session_profiles')
        .select('*')
        .eq('user_id', user.id)
      if (profiles && profiles.length > 0) {
        await cacheProfilesLocally(user.id, profiles)
      }

      // Cache gamification
      const { data: gamification } = await supabase
        .from('gamification')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (gamification) {
        await cacheGamificationLocally(gamification)
      }

      // Cache achievements
      const { data: achievements } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user.id)
      if (achievements && achievements.length > 0) {
        await cacheAchievementsLocally(user.id, achievements)
      }
    } catch {
      // Cache failed silently
    }
  },

  // ---- Update pending count ----
  updatePendingCount: async () => {
    try {
      const { getTotalUnsyncedCount } = await import('@/lib/db-offline')
      const user = await getUser()
      if (user) {
        const count = await getTotalUnsyncedCount(user.id)
        set({ pendingCount: count })
      }
    } catch {
      // Ignore
    }
  },

  // ---- Start sync listeners ----
  startSyncListener: () => {
    const handleOnline = () => {
      set({ isOnline: true })
      // Sync everything when coming back online
      setTimeout(() => {
        get().syncAll()
      }, 1000)
    }
    const handleOffline = () => set({ isOnline: false })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic sync every 30 seconds when online
    const interval = setInterval(() => {
      if (get().isOnline) get().syncAll()
    }, 30000)

    // Initial: update pending count and cache remote data
    setTimeout(async () => {
      await get().updatePendingCount()
      // Cache remote data for offline access
      if (get().isOnline) {
        await get().cacheRemoteData()
      }
    }, 2000)

    // Cleanup function
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  },
}))
