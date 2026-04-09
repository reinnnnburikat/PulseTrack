import Dexie, { type Table } from 'dexie'
import type { OfflineSession } from '@/lib/types'

export class PulseTrackDB extends Dexie {
  sessions!: Table<OfflineSession, number>

  constructor() {
    super('PulseTrackOffline')
    this.version(2).stores({
      sessions: '++id, session_id, user_id, synced, created_at'
    })
  }
}

export const db = new PulseTrackDB()

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

export async function clearAllOfflineData() {
  return db.sessions.clear()
}
