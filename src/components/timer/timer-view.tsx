'use client'

import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTimerStore } from '@/store/timer-store'
import { useAuthStore, useSettingsStore } from '@/store/auth-store'
import { createClient } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Play, Pause, RotateCcw, SkipForward, Zap, Trophy, AlertTriangle } from 'lucide-react'
import type { SessionProfile, Tone } from '@/lib/types'

export function TimerView() {
  const { user } = useAuthStore()
  const settings = useSettingsStore()
  const timer = useTimerStore()
  const [selectedProfile, setSelectedProfile] = useState<string>('custom')

  // Fetch profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      if (!user) return []
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/profiles', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      return json.data || []
    },
    enabled: !!user,
  })

  const selectedProfileData = profiles.find((p: SessionProfile) => p.id === selectedProfile)

  // Timer tick
  useEffect(() => {
    if (timer.status !== 'running') return
    const interval = setInterval(() => {
      useTimerStore.getState().tick()
    }, 1000)
    return () => clearInterval(interval)
  }, [timer.status])

  // Audio cue on phase change
  const prevPhaseRef = useRef(timer.phase)
  useEffect(() => {
    if (timer.phase !== prevPhaseRef.current) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = timer.phase === 'active' ? 440 : 330
        gain.gain.value = 0.1
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
      } catch {}
      prevPhaseRef.current = timer.phase
    }
  }, [timer.phase])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const progress = timer.phase === 'active'
    ? ((timer.activeDuration - timer.remainingSeconds) / timer.activeDuration) * 100
    : ((timer.restDuration - timer.remainingSeconds) / timer.restDuration) * 100

  const totalDuration = timer.phase === 'active' ? timer.activeDuration : timer.restDuration
  const circumference = 2 * Math.PI * 90
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const handleStart = () => {
    const profile = selectedProfileData
      ? {
          active_duration: selectedProfileData.active_duration,
          rest_duration: selectedProfileData.rest_duration,
          cycles: selectedProfileData.cycles,
          infinite_cycles: selectedProfileData.infinite_cycles,
          tone: selectedProfileData.tone as Tone,
          intensity_mode: selectedProfileData.intensity_mode,
        }
      : undefined
    timer.startTimer(profile)
  }

  const handleCompleteEarly = () => {
    if (timer.lockInMode) {
      setShowLockInDialog(true)
    } else {
      timer.completeSession()
    }
  }

  const [showLockInDialog, setShowLockInDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(timer.status === 'completed')

  useEffect(() => {
    if (timer.status === 'completed') setShowCompleteDialog(true)
  }, [timer.status])

  return (
    <div className="max-w-lg mx-auto flex flex-col items-center gap-6 py-4">
      {/* Profile Selector */}
      {timer.status === 'idle' && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <Select value={selectedProfile} onValueChange={setSelectedProfile}>
            <SelectTrigger className="bg-card/60 border-border/50">
              <SelectValue placeholder="Select profile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom (default settings)</SelectItem>
              {profiles.map((p: SessionProfile) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.active_duration}m/{p.rest_duration}m)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      )}

      {/* Active profile badge */}
      {selectedProfileData && (
        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
          {selectedProfileData.name}
        </Badge>
      )}

      {/* Timer Circle */}
      <motion.div
        className={`relative ${timer.showEdgingWarning ? 'animate-edge-warning rounded-full' : ''}`}
        animate={{
          boxShadow: timer.phase === 'active'
            ? '0 0 40px oklch(0.72 0.18 320 / 20%)'
            : '0 0 40px oklch(0.65 0.15 160 / 20%)',
        }}
        transition={{ duration: 0.5 }}
      >
        <svg width="280" height="280" viewBox="0 0 200 200" className="md:w-[320px] md:h-[320px]">
          {/* Background circle */}
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
          {/* Progress circle */}
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke={timer.phase === 'active' ? 'oklch(0.72 0.18 320)' : 'oklch(0.65 0.15 160)'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xs font-bold uppercase tracking-widest mb-2 ${
            timer.phase === 'active' ? 'text-pink-400' : 'text-emerald-400'
          }`}>
            {timer.phase}
          </span>
          <span className="text-5xl md:text-6xl font-bold tabular-nums tracking-tight">
            {formatTime(timer.remainingSeconds)}
          </span>
          <span className="text-sm text-muted-foreground mt-2">
            Cycle {timer.cycle}{timer.infiniteCycles ? '' : ` / ${timer.totalCycles}`}
          </span>

          {/* Intensity badge */}
          <div className="flex items-center gap-1 mt-3">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-muted-foreground">Intensity</span>
            <div className="flex gap-0.5 ml-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i <= timer.currentIntensity ? 'bg-amber-400' : 'bg-muted/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Edging Warning */}
      <AnimatePresence>
        {timer.showEdgingWarning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 text-danger px-4 py-2 rounded-lg bg-danger/10 border border-danger/20"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Approaching limit — prepare for transition</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt Display */}
      <AnimatePresence mode="wait">
        {timer.intensityMode && timer.currentPrompt && timer.status === 'running' && (
          <motion.div
            key={timer.currentPrompt}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <Card className="bg-card/80 backdrop-blur border-primary/20 animate-pulse-glow">
              <CardContent className="p-5 text-center">
                <p className="text-sm text-muted-foreground mb-2 italic">{timer.tone}</p>
                <p className="text-lg font-medium leading-relaxed">{timer.currentPrompt}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Intensity Mode Toggle */}
      {timer.status === 'idle' && (
        <div className="flex items-center gap-3">
          <Switch
            checked={timer.intensityMode}
            onCheckedChange={(checked) => useSettingsStore.getState().updateSettings({ intensityMode: checked })}
          />
          <label className="text-sm text-muted-foreground">Intensity Mode</label>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {timer.status === 'idle' && (
          <Button size="lg" onClick={handleStart} className="bg-primary hover:bg-primary/90 px-8">
            <Play className="w-5 h-5 mr-2" />
            Start
          </Button>
        )}

        {timer.status === 'running' && (
          <>
            <Button size="lg" variant="outline" onClick={timer.pauseTimer} className="border-border/50 px-6">
              <Pause className="w-5 h-5 mr-2" />
              Pause
            </Button>
            <Button size="lg" variant="outline" onClick={timer.forceTransition} className="border-border/50">
              <SkipForward className="w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleCompleteEarly} className="border-border/50 text-muted-foreground">
              <RotateCcw className="w-5 h-5" />
            </Button>
          </>
        )}

        {timer.status === 'paused' && (
          <>
            <Button size="lg" onClick={timer.resumeTimer} className="bg-primary hover:bg-primary/90 px-8">
              <Play className="w-5 h-5 mr-2" />
              Resume
            </Button>
            <Button size="lg" variant="outline" onClick={timer.resetTimer} className="border-border/50">
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset
            </Button>
          </>
        )}
      </div>

      {/* Adaptive info */}
      {timer.status !== 'idle' && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Streak: {timer.streak}</span>
          <span>•</span>
          <span>Difficulty adjusts with streak</span>
        </div>
      )}

      {/* Completion Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Session Complete!
            </DialogTitle>
            <DialogDescription>
              Great work finishing this session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Time</span>
              <span className="font-medium">{formatTime(timer.elapsedTime)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cycles Completed</span>
              <span className="font-medium">{timer.cycle - (timer.phase === 'active' ? 1 : 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Peak Intensity</span>
              <span className="font-medium flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> {timer.currentIntensity}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                await timer.completeSession()
                setShowCompleteDialog(false)
              }}
              className="bg-primary hover:bg-primary/90"
            >
              Save Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock-in Warning Dialog */}
      <Dialog open={showLockInDialog} onOpenChange={setShowLockInDialog}>
        <DialogContent className="bg-card border-danger/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="w-5 h-5" />
              Lock-in Mode Active
            </DialogTitle>
            <DialogDescription>
              Exiting early will reset your current streak. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockInDialog(false)} className="border-border/50">
              Continue Session
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const { useGamificationStore } = await import('@/store/auth-store')
                useGamificationStore.getState().resetStreak()
                await timer.completeSession()
                setShowLockInDialog(false)
              }}
            >
              Exit & Reset Streak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


