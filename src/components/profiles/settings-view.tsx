'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore, useSettingsStore, useGamificationStore } from '@/store/auth-store'
import { useSyncStore } from '@/store/sync-store'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LogOut,
  Download,
  Trash2,
  Shield,
  Info,
  Volume2,
  Infinity,
  Bell,
  Cloud,
  CloudOff,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  AlertTriangle,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Tone } from '@/lib/types'
import { deleteSyncedSessions, clearAllOfflineData } from '@/lib/db-offline'
import { setMasterVolume, setAmbientVolume } from '@/lib/audio'
import { setHapticEnabled, isHapticEnabled } from '@/lib/haptics'
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  getNextReminderTime,
} from '@/lib/notifications'

const toneDescriptions: Record<Tone, { label: string; desc: string; color: string }> = {
  dominant: { label: 'Dominant', desc: 'Commanding, assertive, controlling', color: 'text-red-400' },
  hypnotic: { label: 'Hypnotic', desc: 'Mesmerizing, rhythmic, dreamy', color: 'text-purple-400' },
  teasing: { label: 'Teasing', desc: 'Playful, provocative, challenging', color: 'text-amber-400' },
}

export function SettingsView() {
  const { user, profile, signOut } = useAuthStore()
  const settings = useSettingsStore()
  const { streak, lastSessionDate } = useGamificationStore()
  const {
    pendingCount,
    lastSyncStatus,
    lastSyncAt,
    isOnline: syncIsOnline,
    syncAll,
  } = useSyncStore()

  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [saved, setSaved] = useState(false)

  // Volume state
  const [masterVol, setMasterVol] = useState(80)
  const [ambientVol, setAmbientVol] = useState(30)

  // Daily reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderHour, setReminderHour] = useState(9)
  const [reminderMinute, setReminderMinute] = useState(0)
  const [nextReminderTime, setNextReminderTime] = useState<Date | null>(null)

  // Haptic feedback state
  const [hapticOn, setHapticOn] = useState(true)

  // Offline data state
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Debounced save
  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      await settings.saveSettings()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 1000)
  }, [settings])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  // Initialize next reminder time display
  useEffect(() => {
    const interval = setInterval(() => {
      setNextReminderTime(getNextReminderTime())
    }, 30000)
    // Initial fetch
    setNextReminderTime(getNextReminderTime())
    return () => clearInterval(interval)
  }, [])

  // Check if user had a session today
  const hasSessionToday = (() => {
    if (!lastSessionDate) return false
    const today = new Date().toISOString().split('T')[0]
    return lastSessionDate === today
  })()

  const handleUpdate = (updates: Record<string, any>) => {
    settings.updateSettings(updates)
    debouncedSave()
  }

  const handleMasterVolumeChange = (value: number[]) => {
    const v = value[0]
    setMasterVol(v)
    setMasterVolume(v / 100)
  }

  const handleAmbientVolumeChange = (value: number[]) => {
    const v = value[0]
    setAmbientVol(v)
    setAmbientVolume(v / 100)
  }

  const handleReminderToggle = (enabled: boolean) => {
    setReminderEnabled(enabled)
    if (enabled) {
      scheduleDailyReminder(reminderHour, reminderMinute, hasSessionToday, streak)
      setNextReminderTime(getNextReminderTime())
      toast.success(`Daily reminder set for ${String(reminderHour).padStart(2, '0')}:${String(reminderMinute).padStart(2, '0')}`)
    } else {
      cancelDailyReminder()
      setNextReminderTime(null)
      toast.success('Daily reminder disabled')
    }
  }

  const handleReminderTimeChange = (newHour: number, newMinute: number) => {
    setReminderHour(newHour)
    setReminderMinute(newMinute)
    if (reminderEnabled) {
      scheduleDailyReminder(newHour, newMinute, hasSessionToday, streak)
      setNextReminderTime(getNextReminderTime())
    }
  }

  const handleClearCache = async () => {
    try {
      await deleteSyncedSessions()
      toast.success('Local cache cleared')
    } catch {
      toast.error('Failed to clear cache')
    }
  }

  const handleClearAllOfflineData = async () => {
    try {
      await clearAllOfflineData()
      setShowClearConfirm(false)
      toast.success('All offline data cleared')
    } catch {
      toast.error('Failed to clear offline data')
    }
  }

  const handleSyncNow = async () => {
    try {
      await syncAll()
      toast.success('Sync complete')
    } catch {
      toast.error('Sync failed')
    }
  }

  const handleExportData = async () => {
    try {
      const token = localStorage.getItem('sb-access-token')
      const res = await fetch('/api/sessions?limit=10000', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      const sessions = json.data || []
      const headers = ['Date', 'Duration (s)', 'Intensity', 'Profile', 'Notes']
      const rows = sessions.map((s: any) => [s.created_at, s.duration, s.intensity, s.profile || '', s.notes || ''])
      const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pulsetrack-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported')
    } catch {
      toast.error('Export failed')
    }
  }

  const formatNextReminder = (date: Date | null) => {
    if (!date) return null
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Never'
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Generate hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i)
  const minuteOptions = [0, 15, 30, 45]

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Timer Settings */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" /> Timer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Active Duration</Label>
              <span className="text-xs font-mono text-primary">{settings.activeDuration} min</span>
            </div>
            <Slider
              value={[settings.activeDuration]}
              onValueChange={([v]) => handleUpdate({ activeDuration: v })}
              min={1}
              max={120}
              step={1}
              className="py-1"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Rest Duration</Label>
              <span className="text-xs font-mono text-emerald-400">{settings.restDuration} min</span>
            </div>
            <Slider
              value={[settings.restDuration]}
              onValueChange={([v]) => handleUpdate({ restDuration: v })}
              min={1}
              max={30}
              step={1}
              className="py-1"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Cycles</Label>
              <div className="flex items-center gap-2">
                {settings.infiniteCycles ? (
                  <span className="text-xs text-purple-400 flex items-center gap-1">
                    <Infinity className="w-3 h-3" /> Infinite
                  </span>
                ) : (
                  <span className="text-xs font-mono">{settings.cycles}</span>
                )}
              </div>
            </div>
            {!settings.infiniteCycles && (
              <Slider
                value={[settings.cycles]}
                onValueChange={([v]) => handleUpdate({ cycles: v })}
                min={1}
                max={20}
                step={1}
                className="py-1"
              />
            )}
            <div className="flex items-center gap-2">
              <Switch checked={settings.infiniteCycles} onCheckedChange={(v) => handleUpdate({ infiniteCycles: v })} />
              <Label className="text-xs text-muted-foreground">Infinite cycles</Label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Lock-in Mode</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Prevent early exit with streak penalty</p>
            </div>
            <Switch checked={settings.lockInMode} onCheckedChange={(v) => handleUpdate({ lockInMode: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Intensity Settings */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" /> Intensity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Intensity Mode</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Show psychological prompts during sessions</p>
            </div>
            <Switch checked={settings.intensityMode} onCheckedChange={(v) => handleUpdate({ intensityMode: v })} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Tone</Label>
            <div className="space-y-2">
              {(Object.entries(toneDescriptions) as [Tone, typeof toneDescriptions[Tone]][]).map(([key, val]) => (
                <motion.button
                  key={key}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleUpdate({ tone: key })}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    settings.tone === key
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/50 bg-background/30 hover:bg-accent/20'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    key === 'dominant' ? 'bg-red-400' : key === 'hypnotic' ? 'bg-purple-400' : 'bg-amber-400'
                  }`} />
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${val.color}`}>{val.label}</span>
                    <p className="text-[10px] text-muted-foreground">{val.desc}</p>
                  </div>
                  {settings.tone === key && (
                    <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Reminder */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Daily Reminder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Session Reminder</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Get a daily nudge to keep your streak</p>
            </div>
            <Switch
              checked={reminderEnabled}
              onCheckedChange={handleReminderToggle}
            />
          </div>

          {reminderEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <Separator className="bg-border/30" />
              <div className="space-y-2">
                <Label className="text-xs">Reminder Time</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(reminderHour)}
                    onValueChange={(v) => handleReminderTimeChange(Number(v), reminderMinute)}
                  >
                    <SelectTrigger className="w-20 text-xs" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {hourOptions.map((h) => (
                        <SelectItem key={h} value={String(h)} className="text-xs">
                          {String(h).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-mono text-muted-foreground">:</span>
                  <Select
                    value={String(reminderMinute)}
                    onValueChange={(v) => handleReminderTimeChange(reminderHour, Number(v))}
                  >
                    <SelectTrigger className="w-20 text-xs" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {minuteOptions.map((m) => (
                        <SelectItem key={m} value={String(m)} className="text-xs">
                          {String(m).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {nextReminderTime && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Bell className="w-3 h-3" />
                  <span>Next reminder: {formatNextReminder(nextReminderTime)}</span>
                </div>
              )}

              {streak > 0 && (
                <p className="text-[10px] text-muted-foreground/60">
                  {hasSessionToday
                    ? `You've already completed a session today — reminder will be skipped`
                    : `You're on a ${streak}-day streak — don't miss today!`
                  }
                </p>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Sound & Notifications */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" /> Sound & Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Sound Effects</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Phase transitions, ticks, achievement sounds</p>
            </div>
            <Switch checked={settings.soundEnabled} onCheckedChange={(v) => handleUpdate({ soundEnabled: v })} />
          </div>

          {/* Master Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Master Volume</Label>
              <span className="text-xs font-mono text-primary">{masterVol}%</span>
            </div>
            <Slider
              value={[masterVol]}
              onValueChange={handleMasterVolumeChange}
              min={0}
              max={100}
              step={1}
              className="py-1"
            />
          </div>

          {/* Ambient Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Ambient Volume</Label>
              <span className="text-xs font-mono text-purple-400">{ambientVol}%</span>
            </div>
            <Slider
              value={[ambientVol]}
              onValueChange={handleAmbientVolumeChange}
              min={0}
              max={100}
              step={1}
              className="py-1"
            />
          </div>

          <Separator className="bg-border/30" />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Haptic Feedback</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Vibration on phase transitions & achievements</p>
            </div>
            <Switch checked={hapticOn} onCheckedChange={(v) => {
              setHapticOn(v)
              setHapticEnabled(v)
            }} />
          </div>

          <Separator className="bg-border/30" />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Browser Notifications</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Session reminders, phase alerts, achievements</p>
            </div>
            <Switch checked={settings.notificationsEnabled} onCheckedChange={async (v) => {
              if (v) {
                const { requestNotificationPermission } = await import('@/lib/notifications')
                const granted = await requestNotificationPermission()
                if (!granted) {
                  toast.error('Notifications permission denied by browser')
                  return
                }
              }
              handleUpdate({ notificationsEnabled: v })
            }} />
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Email</Label>
            <Input value={user?.email || ''} readOnly className="bg-background/30 text-muted-foreground mt-1" />
          </div>
          <div>
            <Label className="text-xs">Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-background/50 mt-1"
              placeholder="Your name"
            />
          </div>
          <Button variant="outline" onClick={signOut} className="w-full border-destructive/30 text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Data & Offline Management */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cloud className="w-4 h-4 text-primary" /> Data & Offline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background/50">
                {lastSyncStatus === 'syncing' ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : lastSyncStatus === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : lastSyncStatus === 'error' ? (
                  <XCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <Cloud className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">
                    {lastSyncStatus === 'syncing' ? 'Syncing...' : lastSyncStatus === 'success' ? 'Synced' : lastSyncStatus === 'error' ? 'Sync failed' : 'Idle'}
                  </span>
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      {pendingCount} pending
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Last sync: {formatLastSync(lastSyncAt)}
                  {!syncIsOnline && (
                    <span className="text-amber-400 ml-1">• Offline</span>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncNow}
              disabled={lastSyncStatus === 'syncing'}
              className="h-7 text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${lastSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
          </div>

          {/* Offline data summary */}
          <div className="text-[11px] text-muted-foreground px-1">
            <div className="flex items-center gap-1.5">
              <WifiOff className="w-3 h-3" />
              <span>
                {pendingCount === 0
                  ? 'All data is synced'
                  : `${pendingCount} item${pendingCount !== 1 ? 's' : ''} waiting to sync`}
              </span>
            </div>
          </div>

          <Separator className="bg-border/30" />

          <div className="space-y-2">
            <Button variant="outline" className="w-full border-border/50 justify-start" onClick={handleExportData}>
              <Download className="w-4 h-4 mr-2" /> Export All Data
            </Button>
            <Button variant="outline" className="w-full border-border/50 justify-start text-muted-foreground" onClick={handleClearCache}>
              <Trash2 className="w-4 h-4 mr-2" /> Clear Synced Cache
            </Button>

            {/* Clear All Offline Data — destructive */}
            {!showClearConfirm ? (
              <Button
                variant="outline"
                className="w-full border-destructive/30 justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setShowClearConfirm(true)}
              >
                <AlertTriangle className="w-4 h-4 mr-2" /> Clear All Offline Data
              </Button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2"
              >
                <p className="text-xs text-destructive font-medium">
                  This will delete ALL offline data including unsynced items.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={handleClearAllOfflineData}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Confirm
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => setShowClearConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="bg-card/60 border-border/50">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">PulseTrack v2.0.0</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Made with 💓</p>
        </CardContent>
      </Card>

      {/* Saved indicator */}
      {saved && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-center text-emerald-400"
        >
          Settings saved
        </motion.p>
      )}
    </div>
  )
}
