// ============================================================
// PulseTrack — Browser Notification Helpers
// ============================================================

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function sendNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      icon: '/logo.svg',
      badge: '/logo.svg',
      ...options,
    })
  } catch {
    // Notification might fail in some contexts
  }
}

export function notifyPhaseChange(phase: 'active' | 'rest', cycle: number) {
  const title = phase === 'active' ? '💓 Active Phase' : '🌿 Rest Phase'
  const body = phase === 'active'
    ? `Cycle ${cycle} — Time to push!`
    : `Cycle ${cycle} — Take a breather.`
  sendNotification(title, { body, tag: 'phase-change' })
}

export function notifySessionComplete(cycles: number, duration: number) {
  const mins = Math.floor(duration / 60)
  const title = '🏆 Session Complete!'
  const body = `${cycles} cycle${cycles > 1 ? 's' : ''} completed in ${mins} minutes. Great work!`
  sendNotification(title, { body, tag: 'session-complete' })
}

export function notifyStreakWarning(streak: number) {
  sendNotification('⚡ Streak at Risk!', {
    body: `You have a ${streak}-day streak. Complete a session today to keep it going!`,
    tag: 'streak-warning',
  })
}

export function notifyAchievement(name: string) {
  sendNotification('🏅 Achievement Unlocked!', {
    body: name,
    tag: 'achievement',
  })
}
