import { create } from 'zustand'

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: string | null
  setOnline: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setPendingCount: (n: number) => void
  syncOfflineSessions: () => Promise<void>
  startSyncListener: () => () => void
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,

  setOnline: (v) => set({ isOnline: v }),
  setSyncing: (v) => set({ isSyncing: v }),
  setPendingCount: (n) => set({ pendingCount: n }),

  syncOfflineSessions: async () => {
    if (get().isSyncing) return
    set({ isSyncing: true })

    try {
      const { getUnsyncedSessions, markSessionSynced, deleteSyncedSessions } = await import('@/lib/db-offline')
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const unsynced = await getUnsyncedSessions(user.id)
      if (unsynced.length === 0) return

      for (const session of unsynced) {
        try {
          await supabase.from('sessions').upsert({
            id: session.session_id,
            user_id: session.user_id,
            created_at: session.created_at,
            duration: session.duration,
            intensity: session.intensity,
            profile: session.profile,
            notes: session.notes,
            updated_at: session.created_at,
          }, { onConflict: 'id' })
          await markSessionSynced(session.session_id!)
        } catch {
          // Skip failed syncs
        }
      }

      // Clean up synced sessions
      await deleteSyncedSessions()
      set({ lastSyncAt: new Date().toISOString() })
    } catch {
      // Sync failed silently
    } finally {
      set({ isSyncing: false })
      // Update pending count
      try {
        const { getOfflineSessionCount } = await import('@/lib/db-offline')
        const { createClient } = await import('@/lib/supabase')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const count = await getOfflineSessionCount(user.id)
          set({ pendingCount: count })
        }
      } catch {}
    }
  },

  startSyncListener: () => {
    // Listen for online/offline events
    const handleOnline = () => {
      set({ isOnline: true })
      // Auto-sync when coming back online
      setTimeout(() => get().syncOfflineSessions(), 1000)
    }
    const handleOffline = () => set({ isOnline: false })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic sync check every 30 seconds when online
    const interval = setInterval(() => {
      if (get().isOnline) get().syncOfflineSessions()
    }, 30000)

    // Initial count check
    setTimeout(async () => {
      try {
        const { getOfflineSessionCount } = await import('@/lib/db-offline')
        const { createClient } = await import('@/lib/supabase')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const count = await getOfflineSessionCount(user.id)
          set({ pendingCount: count })
        }
      } catch {}
    }, 2000)

    // Cleanup function
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  },
}))
