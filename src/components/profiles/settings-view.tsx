'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore, useSettingsStore } from '@/store/auth-store'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { LogOut, Download, Trash2, Shield, Info, Volume2, Infinity } from 'lucide-react'
import { toast } from 'sonner'
import type { Tone } from '@/lib/types'
import { deleteSyncedSessions } from '@/lib/db-offline'

const toneDescriptions: Record<Tone, { label: string; desc: string; color: string }> = {
  dominant: { label: 'Dominant', desc: 'Commanding, assertive, controlling', color: 'text-red-400' },
  hypnotic: { label: 'Hypnotic', desc: 'Mesmerizing, rhythmic, dreamy', color: 'text-purple-400' },
  teasing: { label: 'Teasing', desc: 'Playful, provocative, challenging', color: 'text-amber-400' },
}

export function SettingsView() {
  const { user, profile, signOut } = useAuthStore()
  const settings = useSettingsStore()
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [saved, setSaved] = useState(false)

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

  const handleUpdate = (updates: Record<string, any>) => {
    settings.updateSettings(updates)
    debouncedSave()
  }

  const handleClearCache = async () => {
    try {
      await deleteSyncedSessions()
      toast.success('Local cache cleared')
    } catch {
      toast.error('Failed to clear cache')
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

      {/* Data */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full border-border/50 justify-start" onClick={handleExportData}>
            <Download className="w-4 h-4 mr-2" /> Export All Data
          </Button>
          <Button variant="outline" className="w-full border-border/50 justify-start text-muted-foreground" onClick={handleClearCache}>
            <Trash2 className="w-4 h-4 mr-2" /> Clear Local Cache
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="bg-card/60 border-border/50">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">PulseTrack v1.0.0</p>
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

import { useRef } from 'react'
