// ============================================================
// PulseTrack — Browser Notification Helpers
// ============================================================

// ---------------------------------------------------------------------------
// Core Notification API Wrappers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Existing Notification Functions (backward compatible)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 1. Notification Scheduler — Simple in-memory scheduling
// ---------------------------------------------------------------------------

/** In-memory handle for the scheduled daily reminder timeout */
let dailyReminderTimerId: ReturnType<typeof setTimeout> | null = null

/** Stores the configured reminder time (hour, minute) for re-scheduling */
let dailyReminderConfig: { hour: number; minute: number } | null = null

/**
 * Calculate the number of milliseconds until the next occurrence of
 * `hour:minute` in local time. If the time already passed today,
 * schedule for tomorrow.
 */
function msUntilNext(hour: number, minute: number): number {
  const now = new Date()
  const target = new Date()
  target.setHours(hour, minute, 0, 0)

  // If the target time is in the past (or exactly now), push to tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }

  return target.getTime() - now.getTime()
}

/**
 * Internal: fire the daily reminder and immediately re-schedule for the
 * next day so the loop continues without gaps.
 */
function fireAndRescheduleReminder(hasSessionToday: boolean, streak?: number) {
  dailyReminderTimerId = null // clear before re-scheduling

  if (!hasSessionToday) {
    const streakText = streak ? ` You're on a ${streak}-day streak!` : ''
    sendNotification('💓 Daily Reminder', {
      body: `Don't break your streak! Complete a session today.${streakText}`,
      tag: 'daily-reminder',
    })
  }

  // Re-schedule if config is still set
  if (dailyReminderConfig) {
    scheduleDailyReminder(
      dailyReminderConfig.hour,
      dailyReminderConfig.minute,
      hasSessionToday,
      streak,
    )
  }
}

/**
 * Schedule a daily notification at a specific time.
 *
 * - `hour`   — 0-23
 * - `minute` — 0-59
 * - `hasSessionToday` — if true the notification will be skipped for this
 *   specific firing (the reminder itself still re-schedules for tomorrow).
 * - `streak` — optional current streak count to include in the message.
 *
 * Uses `setTimeout` so all scheduling is in-memory and resets on reload.
 */
export function scheduleDailyReminder(
  hour: number,
  minute: number,
  hasSessionToday = false,
  streak?: number,
): void {
  // Cancel any existing reminder first
  cancelDailyReminder()

  dailyReminderConfig = { hour, minute }

  const delay = msUntilNext(hour, minute)
  dailyReminderTimerId = setTimeout(
    () => fireAndRescheduleReminder(hasSessionToday, streak),
    delay,
  )
}

/**
 * Cancel the currently scheduled daily reminder, if any.
 */
export function cancelDailyReminder(): void {
  if (dailyReminderTimerId !== null) {
    clearTimeout(dailyReminderTimerId)
    dailyReminderTimerId = null
  }
  dailyReminderConfig = null
}

/**
 * Returns a `Date` representing the next scheduled reminder, or `null` if
 * no reminder has been scheduled.
 */
export function getNextReminderTime(): Date | null {
  if (!dailyReminderConfig) return null
  const now = new Date()
  const target = new Date()
  target.setHours(dailyReminderConfig.hour, dailyReminderConfig.minute, 0, 0)
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target
}

// ---------------------------------------------------------------------------
// 2. Streak Check Notification — called on app init
// ---------------------------------------------------------------------------

/**
 * Compare a date string to "today" (local timezone).
 * Returns:
 *  - `'today'`       if the date is today
 *  - `'yesterday'`   if the date is yesterday
 *  - `'older'`       otherwise
 */
function classifyDate(dateStr: string): 'today' | 'yesterday' | 'older' {
  const date = new Date(dateStr)
  const now = new Date()

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)

  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (dateStart.getTime() === todayStart.getTime()) return 'today'
  if (dateStart.getTime() === yesterdayStart.getTime()) return 'yesterday'
  return 'older'
}

/**
 * Called on app init. Checks if the streak is at risk and sends a
 * notification if appropriate.
 *
 * - If `streak >= 3` and the last session was yesterday → gentle reminder.
 * - If `streak >= 7` and the last session was yesterday → more urgent reminder.
 * - If `lastSessionDate` is `null` or older than yesterday → no notification.
 */
export function checkAndNotifyStreak(
  streak: number,
  lastSessionDate: string | null,
): void {
  if (!lastSessionDate || streak < 3) return

  const classification = classifyDate(lastSessionDate)
  if (classification !== 'yesterday') return

  if (streak >= 7) {
    sendNotification('🔥 Your streak is ON FIRE!', {
      body: `You have a ${streak}-day streak — don't let it burn out! Complete a session today.`,
      tag: 'streak-check-urgent',
    })
  } else {
    sendNotification('💓 Keep it going!', {
      body: `You have a ${streak}-day streak. One more session today to keep your momentum!`,
      tag: 'streak-check',
    })
  }
}

// ---------------------------------------------------------------------------
// 3. Rich Achievement Notification
// ---------------------------------------------------------------------------

/**
 * Enhanced achievement notification that includes an icon description and
 * extra context in the notification body.
 */
export function notifyAchievementRich(
  name: string,
  icon: string,
  description: string,
): void {
  sendNotification('🏅 Achievement Unlocked!', {
    body: `${icon} ${name}\n${description}`,
    tag: 'achievement-rich',
  })
}

// ---------------------------------------------------------------------------
// 4. Weekly Summary Notification
// ---------------------------------------------------------------------------

/**
 * Sends a weekly progress report notification.
 *
 * - `totalSessions`  — number of sessions completed this week
 * - `totalTime`      — total session time in **seconds**
 * - `avgIntensity`   — average intensity level (e.g. 3.4)
 */
export function notifyWeeklySummary(
  totalSessions: number,
  totalTime: number,
  avgIntensity: number,
): void {
  const mins = Math.floor(totalTime / 60)
  const intensityLabel =
    avgIntensity >= 4.5
      ? '🔥 Intense'
      : avgIntensity >= 3
        ? '💪 Solid'
        : '🌱 Building'

  sendNotification('📊 Your Weekly Summary', {
    body: `${totalSessions} session${totalSessions !== 1 ? 's' : ''} · ${mins} min total · Avg intensity: ${avgIntensity.toFixed(1)} ${intensityLabel}`,
    tag: 'weekly-summary',
  })
}

// ---------------------------------------------------------------------------
// 5. Notification Preferences Helper
// ---------------------------------------------------------------------------

/** Well-known notification type keys */
export type NotificationType =
  | 'dailyReminder'
  | 'streakWarning'
  | 'achievement'
  | 'phaseChange'
  | 'sessionComplete'
  | 'weeklySummary'
  | 'streakCheck'

/**
 * Check whether a notification of the given `type` should be displayed
 * based on the user's preferences map.
 *
 * The `preferences` record maps `NotificationType` keys to booleans.
 * If a key is missing from the record the notification is **allowed**
 * (opt-out model — the user must explicitly disable a type to suppress it).
 */
export function shouldShowNotification(
  type: string,
  preferences: Record<string, boolean>,
): boolean {
  // If the type has an explicit entry, use it; otherwise default to showing
  if (type in preferences) {
    return preferences[type] === true
  }
  return true
}
