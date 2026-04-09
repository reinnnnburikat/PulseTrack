import { create } from 'zustand'

interface MatchState {
  selectedUserId: string | null
  selectedUserName: string | null
  selectUser: (userId: string, userName: string | null) => void
  clearSelection: () => void
}

export const useMatchStore = create<MatchState>((set) => ({
  selectedUserId: null,
  selectedUserName: null,

  selectUser: (userId, userName) => set({ selectedUserId: userId, selectedUserName: userName }),
  clearSelection: () => set({ selectedUserId: null, selectedUserName: null }),
}))
