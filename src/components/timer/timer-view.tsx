'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTimerStore } from '@/store/timer-store'
import { useAuthStore, useSettingsStore } from '@/store/auth-store'
import { createClient } from '@/lib/supabase'
import {
  startAmbient,
  stopAmbient,
  modulateAmbient,
  startBreathingGuide,
  stopBreathingGuide,
} from '@/lib/audio'
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
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Zap,
  Trophy,
  AlertTriangle,
  Volume2,
  VolumeX,
  Wind,
  Maximize,
  Minimize,
} from 'lucide-react'
import type { SessionProfile, Tone, SessionMood } from '@/lib/types'
import { MOOD_CONFIG } from '@/lib/types'

// ---- Floating Particles Component ----

function FloatingParticles({ phase }: { phase: 'active' | 'rest' }) {
  const particles = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 2 + Math.random() * 4,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 10,
      opacity: 0.1 + Math.random() * 0.3,
    }))
  }, [])

  const color = phase === 'active' ? 'bg-pink-400/30' : 'bg-emerald-400/30'

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute rounded-full ${color}`}
          style={{
            left: p.left,
            bottom: '-10px',
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -window.innerHeight - 20],
            x: [0, (Math.random() - 0.5) * 60],
            opacity: [p.opacity, p.opacity * 1.5, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  )
}

// ---- Breathing Guide Circle ----

function useBreathingPhase(active: boolean) {
  const [phaseLabel, setPhaseLabel] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale')
  const labelRef = useRef(phaseLabel)

  useEffect(() => {
    if (!active) {
      // Reset via timeout to satisfy the lint rule (async callback)
      const resetTimer = setTimeout(() => {
        setPhaseLabel('Inhale')
        labelRef.current = 'Inhale'
      }, 0)
      return () => clearTimeout(resetTimer)
    }

    const INHALE = 4000
    const HOLD = 7000
    const EXHALE = 8000

    const scheduleCycle = () => {
      const holdTimer = setTimeout(() => {
        setPhaseLabel('Hold')
        labelRef.current = 'Hold'
      }, INHALE)
      const exhaleTimer = setTimeout(() => {
        setPhaseLabel('Exhale')
        labelRef.current = 'Exhale'
      }, INHALE + HOLD)
      const cycleTimer = setTimeout(() => {
        setPhaseLabel('Inhale')
        labelRef.current = 'Inhale'
        scheduleCycle()
      }, INHALE + HOLD + EXHALE)

      return () => {
        clearTimeout(holdTimer)
        clearTimeout(exhaleTimer)
        clearTimeout(cycleTimer)
      }
    }

    // Start first cycle via micro-task to satisfy lint
    const startTimer = setTimeout(() => {
      setPhaseLabel('Inhale')
      labelRef.current = 'Inhale'
      const cleanup = scheduleCycle()
      cleanupRef.current = cleanup
    }, 0)

    const cleanupRef = { current: (() => {}) as () => void }

    return () => {
      clearTimeout(startTimer)
      cleanupRef.current?.()
    }
  }, [active])

  return phaseLabel
}

function BreathingGuideCircle({ active }: { active: boolean }) {
  const phaseLabel = useBreathingPhase(active)

  const scaleMap = {
    Inhale: 1.4,
    Hold: 1.4,
    Exhale: 1,
  }

  const durationMap = {
    Inhale: 4,
    Hold: 7,
    Exhale: 8,
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
        >
          <div className="relative">
            {/* Outer glow ring */}
            <motion.div
              animate={{
                scale: [1, 1.6, 1.6, 1],
                opacity: [0.1, 0.2, 0.2, 0.1],
              }}
              transition={{
                duration: 19,
                repeat: Infinity,
                times: [0, 4 / 19, 11 / 19, 1],
                ease: 'easeInOut',
              }}
              className="absolute -inset-8 rounded-full bg-emerald-400/10 blur-xl"
            />
            {/* Main circle */}
            <motion.div
              key={phaseLabel}
              animate={{
                scale: scaleMap[phaseLabel],
              }}
              transition={{
                duration: durationMap[phaseLabel],
                ease: 'easeInOut',
              }}
              className="w-32 h-32 md:w-40 md:h-40 rounded-full border-2 border-emerald-400/30 bg-emerald-400/5 flex items-center justify-center"
            >
              <motion.span
                key={`label-${phaseLabel}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-emerald-300/60 text-sm font-light tracking-widest uppercase"
              >
                {phaseLabel}
              </motion.span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---- Focus Mode Exit Confirmation ----

function FocusExitConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border/50 rounded-2xl p-6 mx-4 max-w-sm w-full text-center shadow-2xl"
      >
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-1">Exit Focus Mode?</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Lock-in mode is active. Exiting will reset your streak.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onCancel} className="border-border/50">
            Stay Focused
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
          >
            Exit & Reset
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ---- Main Timer View Component ----

export function TimerView() {
  const { user } = useAuthStore()
  const settings = useSettingsStore()
  const timer = useTimerStore()
  const [selectedProfile, setSelectedProfile] = useState<string>('custom')

  // Local audio states
  const [ambientOn, setAmbientOn] = useState(false)
  const [breathingOn, setBreathingOn] = useState(false)
  const [showFocusExitConfirm, setShowFocusExitConfirm] = useState(false)

  // Refs to prevent audio re-trigger
  const ambientStartedRef = useRef(false)
  const breathingStartedRef = useRef(false)
  const prevPhaseRef = useRef(timer.phase)
  const prevIntensityRef = useRef(timer.currentIntensity)

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

  // ---- Timer tick ----
  useEffect(() => {
    if (timer.status !== 'running') return
    const interval = setInterval(() => {
      useTimerStore.getState().tick()
    }, 1000)
    return () => clearInterval(interval)
  }, [timer.status])

  // ---- Audio: Ambient integration ----
  // Start ambient when focus mode ON + timer running, or when ambientOn toggled in normal mode
  useEffect(() => {
    const isFocusAndActive = timer.focusMode && (timer.status === 'running' || timer.status === 'paused')
    const shouldPlay = isFocusAndActive || (ambientOn && timer.status !== 'idle')

    if (shouldPlay && !ambientStartedRef.current) {
      ambientStartedRef.current = true
      startAmbient(timer.tone)
      modulateAmbient(timer.currentIntensity)
    } else if (!shouldPlay && ambientStartedRef.current) {
      ambientStartedRef.current = false
      stopAmbient()
    }
  }, [timer.focusMode, timer.status, ambientOn, timer.tone])

  // ---- Audio: Breathing guide integration ----
  useEffect(() => {
    const isInRestPhase = timer.phase === 'rest' && timer.status === 'running'
    const shouldBreath = (timer.focusMode && isInRestPhase) || (breathingOn && isInRestPhase)

    if (shouldBreath && !breathingStartedRef.current) {
      breathingStartedRef.current = true
      startBreathingGuide()
    } else if (!shouldBreath && breathingStartedRef.current) {
      breathingStartedRef.current = false
      stopBreathingGuide()
    }
  }, [timer.phase, timer.status, timer.focusMode, breathingOn])

  // ---- Audio: Modulate ambient on intensity change ----
  useEffect(() => {
    if (ambientStartedRef.current && timer.currentIntensity !== prevIntensityRef.current) {
      prevIntensityRef.current = timer.currentIntensity
      modulateAmbient(timer.currentIntensity)
    }
  }, [timer.currentIntensity])

  // ---- Track phase changes for cleanup ----
  useEffect(() => {
    prevPhaseRef.current = timer.phase
  }, [timer.phase])

  // ---- Cleanup audio on unmount ----
  useEffect(() => {
    return () => {
      stopAmbient()
      stopBreathingGuide()
      ambientStartedRef.current = false
      breathingStartedRef.current = false
    }
  }, [])

  // ---- Stop audio when timer completes/resets ----
  useEffect(() => {
    if (timer.status === 'idle' || timer.status === 'completed') {
      stopAmbient()
      stopBreathingGuide()
      ambientStartedRef.current = false
      breathingStartedRef.current = false
      setAmbientOn(false)
      setBreathingOn(false)
    }
  }, [timer.status])

  // ---- Escape key handling ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && timer.focusMode && timer.status !== 'idle') {
        if (timer.lockInMode) {
          setShowFocusExitConfirm(true)
        } else {
          timer.toggleFocusMode()
          setAmbientOn(false)
          setBreathingOn(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [timer.focusMode, timer.status, timer.lockInMode])

  // ---- Compute derived values ----
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

  // ---- Handlers ----
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

  const handleFocusModeToggle = useCallback(() => {
    if (timer.focusMode) {
      timer.toggleFocusMode()
      setAmbientOn(false)
      setBreathingOn(false)
    } else if (timer.status === 'running' || timer.status === 'paused') {
      timer.toggleFocusMode()
    }
  }, [timer.focusMode, timer.status])

  const handleFocusExitConfirm = async () => {
    setShowFocusExitConfirm(false)
    const { useGamificationStore } = await import('@/store/auth-store')
    useGamificationStore.getState().resetStreak()
    timer.toggleFocusMode()
    setAmbientOn(false)
    setBreathingOn(false)
  }

  const [showLockInDialog, setShowLockInDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [showMoodSelector, setShowMoodSelector] = useState(false)
  const [selectedMood, setSelectedMood] = useState<SessionMood | null>(null)
  const [moodAnimating, setMoodAnimating] = useState(false)

  // When timer completes, show mood selector first
  useEffect(() => {
    if (timer.status === 'completed') {
      setShowMoodSelector(true)
      setShowCompleteDialog(false)
    }
  }, [timer.status])

  // When mood selector is dismissed (skip or select), show completion dialog
  const handleMoodSelect = useCallback((mood: SessionMood) => {
    setSelectedMood(mood)
    timer.setSessionMood(mood)
    setMoodAnimating(true)
    setTimeout(() => {
      setShowMoodSelector(false)
      setShowCompleteDialog(true)
      setMoodAnimating(false)
    }, 300)
  }, [timer])

  const handleMoodSkip = useCallback(() => {
    setSelectedMood(null)
    timer.setSessionMood(null)
    setShowMoodSelector(false)
    setShowCompleteDialog(true)
  }, [timer])

  // ---- Phase-based gradient configs ----
  const gradientBg = timer.phase === 'active'
    ? 'from-pink-950/90 via-rose-950/95 to-fuchsia-950/90'
    : 'from-emerald-950/90 via-teal-950/95 to-cyan-950/90'

  const gradientAccent = timer.phase === 'active'
    ? 'radial-gradient(ellipse at 50% 0%, oklch(0.55 0.18 330 / 30%) 0%, transparent 70%)'
    : 'radial-gradient(ellipse at 50% 100%, oklch(0.55 0.15 165 / 30%) 0%, transparent 70%)'

  const isImmersive = timer.focusMode && timer.status !== 'idle'

  // ==========================================================
  // IMMERSIVE FOCUS MODE OVERLAY
  // ==========================================================

  return (
    <>
      {/* Normal mode container */}
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
        {selectedProfileData && timer.status === 'idle' && (
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
            {selectedProfileData.name}
          </Badge>
        )}

        {/* Timer Circle */}
        <motion.div
          className={`relative ${timer.showEdgingWarning ? 'rounded-full' : ''}`}
          style={timer.showEdgingWarning ? {
            animation: 'edge-warning-border 0.8s ease-in-out infinite',
            borderRadius: '50%',
          } : undefined}
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
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i <= timer.currentIntensity
                        ? 'bg-amber-400 scale-110'
                        : 'bg-muted/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Edging Warning - Enhanced with pulsing border */}
        <AnimatePresence>
          {timer.showEdgingWarning && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 text-danger px-4 py-2 rounded-lg border overflow-hidden relative"
              style={{
                backgroundColor: 'oklch(0.60 0.24 25 / 10%)',
                borderColor: 'oklch(0.60 0.24 25 / 30%)',
              }}
            >
              {/* Pulsing border glow */}
              <motion.div
                className="absolute inset-0 rounded-lg"
                animate={{
                  boxShadow: [
                    '0 0 0px oklch(0.60 0.24 25 / 0%)',
                    '0 0 12px oklch(0.60 0.24 25 / 40%)',
                    '0 0 0px oklch(0.60 0.24 25 / 0%)',
                  ],
                }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <AlertTriangle className="w-4 h-4 shrink-0" />
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
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={timer.intensityMode}
                onCheckedChange={(checked) => useSettingsStore.getState().updateSettings({ intensityMode: checked })}
              />
              <label className="text-sm text-muted-foreground">Intensity Mode</label>
            </div>
          </div>
        )}

        {/* Focus Mode Toggle + Audio Controls + Edge Count */}
        {timer.status !== 'idle' && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleFocusModeToggle}
              className={`text-xs ${timer.focusMode ? 'text-primary' : 'text-muted-foreground'}`}>
              {timer.focusMode ? <Minimize className="w-3.5 h-3.5 mr-1" /> : <Maximize className="w-3.5 h-3.5 mr-1" />}
              {timer.focusMode ? 'Exit Focus' : 'Focus Mode'}
            </Button>

            {/* Ambient sound toggle (normal mode) */}
            {!timer.focusMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAmbientOn(!ambientOn)}
                className={`text-xs ${ambientOn ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {ambientOn ? <Volume2 className="w-3.5 h-3.5 mr-1" /> : <VolumeX className="w-3.5 h-3.5 mr-1" />}
                Ambient
              </Button>
            )}

            {/* Breathing guide toggle (normal mode) */}
            {!timer.focusMode && timer.phase === 'rest' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBreathingOn(!breathingOn)}
                className={`text-xs ${breathingOn ? 'text-emerald-400' : 'text-muted-foreground'}`}
              >
                <Wind className="w-3.5 h-3.5 mr-1" />
                Breathe
              </Button>
            )}

            {timer.edgeCount > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-300 border-0">
                Edge #{timer.edgeCount}
              </Badge>
            )}
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
      </div>

      {/* ==========================================================
           IMMERSIVE FOCUS MODE OVERLAY
           ========================================================== */}
      <AnimatePresence>
        {isImmersive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b ${gradientBg} overflow-hidden`}
          >
            {/* Phase-aware radial accent */}
            <div
              className="absolute inset-0 transition-all duration-[2000ms]"
              style={{ background: gradientAccent }}
            />

            {/* Animated gradient shift overlay */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{
                background: timer.phase === 'active'
                  ? [
                      'radial-gradient(circle at 30% 40%, oklch(0.55 0.20 325 / 15%) 0%, transparent 50%)',
                      'radial-gradient(circle at 70% 60%, oklch(0.50 0.22 340 / 15%) 0%, transparent 50%)',
                      'radial-gradient(circle at 50% 30%, oklch(0.55 0.18 310 / 15%) 0%, transparent 50%)',
                      'radial-gradient(circle at 30% 40%, oklch(0.55 0.20 325 / 15%) 0%, transparent 50%)',
                    ]
                  : [
                      'radial-gradient(circle at 40% 60%, oklch(0.50 0.15 160 / 12%) 0%, transparent 50%)',
                      'radial-gradient(circle at 60% 40%, oklch(0.45 0.17 175 / 12%) 0%, transparent 50%)',
                      'radial-gradient(circle at 50% 70%, oklch(0.50 0.13 155 / 12%) 0%, transparent 50%)',
                      'radial-gradient(circle at 40% 60%, oklch(0.50 0.15 160 / 12%) 0%, transparent 50%)',
                    ],
              }}
              transition={{
                duration: timer.phase === 'active' ? 12 : 16,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Floating Particles */}
            <FloatingParticles phase={timer.phase} />

            {/* Breathing Guide Circle (rest phase only) */}
            <BreathingGuideCircle active={timer.phase === 'rest'} />

            {/* Timer content */}
            <div className="relative z-20 flex flex-col items-center gap-8">
              {/* Phase label */}
              <motion.span
                key={timer.phase}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm md:text-base font-bold uppercase tracking-[0.3em] ${
                  timer.phase === 'active' ? 'text-pink-300' : 'text-emerald-300'
                }`}
              >
                {timer.phase} phase
              </motion.span>

              {/* Timer Circle - Larger in focus mode */}
              <motion.div
                className="relative"
                animate={{
                  boxShadow: timer.phase === 'active'
                    ? '0 0 60px oklch(0.72 0.18 320 / 30%), 0 0 120px oklch(0.72 0.18 320 / 10%)'
                    : '0 0 60px oklch(0.65 0.15 160 / 30%), 0 0 120px oklch(0.65 0.15 160 / 10%)',
                }}
                transition={{ duration: 0.8 }}
              >
                <svg width="300" height="300" viewBox="0 0 200 200" className="md:w-[380px] md:h-[380px]">
                  {/* Background circle */}
                  <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  {/* Progress circle */}
                  <motion.circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke={timer.phase === 'active' ? 'oklch(0.72 0.18 320)' : 'oklch(0.65 0.15 160)'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 100 100)"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                  />
                  {/* Inner glow ring */}
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke={timer.phase === 'active' ? 'oklch(0.72 0.18 320 / 8%)' : 'oklch(0.65 0.15 160 / 8%)'}
                    strokeWidth="1"
                  />
                </svg>

                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {/* Timer display */}
                  <motion.span
                    key={timer.remainingSeconds}
                    initial={{ scale: 1 }}
                    animate={{ scale: timer.lastFiveSeconds ? [1, 1.02, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-7xl md:text-8xl font-bold tabular-nums tracking-tight text-white"
                    style={{
                      textShadow: timer.phase === 'active'
                        ? '0 0 30px oklch(0.72 0.18 320 / 50%), 0 0 60px oklch(0.72 0.18 320 / 20%)'
                        : '0 0 30px oklch(0.65 0.15 160 / 50%), 0 0 60px oklch(0.65 0.15 160 / 20%)',
                    }}
                  >
                    {formatTime(timer.remainingSeconds)}
                  </motion.span>

                  {/* Cycle counter */}
                  <span className="text-sm text-white/50 mt-2 tracking-wide">
                    Cycle {timer.cycle}{timer.infiniteCycles ? '' : ` / ${timer.totalCycles}`}
                  </span>

                  {/* Intensity dots - Dramatic */}
                  <div className="flex items-center gap-1.5 mt-4">
                    <Zap className="w-4 h-4 text-amber-400" />
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: i <= timer.currentIntensity ? [1, 1.3, 1] : 1,
                          opacity: i <= timer.currentIntensity ? 1 : 0.3,
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: i <= timer.currentIntensity ? Infinity : 0,
                          delay: i * 0.1,
                        }}
                        className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                          i <= timer.currentIntensity ? 'bg-amber-400' : 'bg-white/10'
                        }`}
                        style={i <= timer.currentIntensity ? {
                          boxShadow: '0 0 8px oklch(0.75 0.15 85 / 60%)',
                        } : undefined}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Prompt - Larger with glow in focus mode */}
              <AnimatePresence mode="wait">
                {timer.intensityMode && timer.currentPrompt && timer.status === 'running' && (
                  <motion.div
                    key={timer.currentPrompt}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md mx-4"
                  >
                    <p className="text-sm text-white/40 mb-1 italic text-center">{timer.tone}</p>
                    <p
                      className="text-lg md:text-xl font-medium leading-relaxed text-center px-6 py-4 rounded-xl"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(12px)',
                        textShadow: timer.phase === 'active'
                          ? '0 0 20px oklch(0.72 0.18 320 / 40%)'
                          : '0 0 20px oklch(0.65 0.15 160 / 40%)',
                      }}
                    >
                      {timer.currentPrompt}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Edging Warning - Enhanced in focus mode */}
              <AnimatePresence>
                {timer.showEdgingWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border relative overflow-hidden"
                    style={{
                      backgroundColor: 'oklch(0.60 0.24 25 / 15%)',
                      borderColor: 'oklch(0.60 0.24 25 / 40%)',
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 rounded-xl"
                      animate={{
                        boxShadow: [
                          '0 0 0px oklch(0.60 0.24 25 / 0%), inset 0 0 0px oklch(0.60 0.24 25 / 0%)',
                          '0 0 16px oklch(0.60 0.24 25 / 50%), inset 0 0 8px oklch(0.60 0.24 25 / 20%)',
                          '0 0 0px oklch(0.60 0.24 25 / 0%), inset 0 0 0px oklch(0.60 0.24 25 / 0%)',
                        ],
                      }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-sm font-medium text-red-300">Approaching limit — prepare for transition</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Minimal Controls in Focus Mode */}
              <div className="flex items-center gap-4 mt-2">
                {timer.status === 'running' && (
                  <motion.div
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={timer.pauseTimer}
                      className="text-white/70 hover:text-white hover:bg-white/10 rounded-full w-14 h-14 p-0"
                    >
                      <Pause className="w-6 h-6" />
                    </Button>
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={timer.forceTransition}
                      className="text-white/70 hover:text-white hover:bg-white/10 rounded-full w-14 h-14 p-0"
                    >
                      <SkipForward className="w-6 h-6" />
                    </Button>
                  </motion.div>
                )}

                {timer.status === 'paused' && (
                  <motion.div
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={timer.resumeTimer}
                      className="text-white/70 hover:text-white hover:bg-white/10 rounded-full w-14 h-14 p-0"
                    >
                      <Play className="w-6 h-6" />
                    </Button>
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={timer.forceTransition}
                      className="text-white/70 hover:text-white hover:bg-white/10 rounded-full w-14 h-14 p-0"
                    >
                      <SkipForward className="w-6 h-6" />
                    </Button>
                  </motion.div>
                )}
              </div>

              {/* Exit focus hint */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 1 }}
                className="text-[11px] text-white/30 tracking-wide"
              >
                Press Esc to exit focus mode
              </motion.p>
            </div>

            {/* Focus Exit Confirmation Overlay */}
            <AnimatePresence>
              {showFocusExitConfirm && (
                <FocusExitConfirm
                  onConfirm={handleFocusExitConfirm}
                  onCancel={() => setShowFocusExitConfirm(false)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==========================================================
           MOOD SELECTOR OVERLAY (post-session)
           ========================================================== */}
      <AnimatePresence>
        {showMoodSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-gradient-to-b from-violet-950/85 via-purple-950/90 to-fuchsia-950/85 backdrop-blur-sm overflow-hidden"
          >
            {/* Soft animated radial accent */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{
                background: [
                  'radial-gradient(circle at 30% 30%, oklch(0.60 0.15 300 / 15%) 0%, transparent 50%)',
                  'radial-gradient(circle at 70% 70%, oklch(0.55 0.18 330 / 15%) 0%, transparent 50%)',
                  'radial-gradient(circle at 50% 50%, oklch(0.60 0.12 280 / 12%) 0%, transparent 50%)',
                  'radial-gradient(circle at 30% 30%, oklch(0.60 0.15 300 / 15%) 0%, transparent 50%)',
                ],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Soft floating particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 15 }, (_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-violet-400/20"
                  style={{
                    left: `${Math.random() * 100}%`,
                    bottom: '-10px',
                    width: 3 + Math.random() * 4,
                    height: 3 + Math.random() * 4,
                    opacity: 0.15 + Math.random() * 0.2,
                  }}
                  animate={{
                    y: [0, -(typeof window !== 'undefined' ? window.innerHeight : 800) - 20],
                    x: [0, (Math.random() - 0.5) * 40],
                    opacity: [0.15, 0.3, 0],
                  }}
                  transition={{
                    duration: 10 + Math.random() * 10,
                    delay: Math.random() * 8,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
              ))}
            </div>

            {/* Centered mood card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-10 bg-card/80 backdrop-blur-xl border border-border/40 rounded-2xl p-6 md:p-8 mx-4 max-w-md w-full shadow-2xl"
            >
              {/* Celebration icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', damping: 15, stiffness: 200 }}
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 flex items-center justify-center"
              >
                <Trophy className="w-8 h-8 text-amber-400" />
              </motion.div>

              <h2 className="text-xl font-bold text-center mb-1">
                How did that feel?
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Tap a mood to record how your session went
              </p>

              {/* Mood grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {(Object.keys(MOOD_CONFIG) as SessionMood[]).map((mood, index) => {
                  const config = MOOD_CONFIG[mood]
                  const isSelected = selectedMood === mood
                  return (
                    <motion.button
                      key={mood}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => !moodAnimating && handleMoodSelect(mood)}
                      disabled={moodAnimating}
                      className={`relative flex items-center gap-2 px-3 py-2.5 rounded-full border transition-all duration-200 cursor-pointer disabled:cursor-default ${
                        isSelected
                          ? 'border-primary bg-primary/15 shadow-[0_0_12px_oklch(0.72_0.18_320/25%)]'
                          : 'border-border/50 bg-muted/30 hover:bg-muted/50 hover:border-border'
                      }`}
                    >
                      <span className="text-lg leading-none">{config.emoji}</span>
                      <span className={`text-xs font-medium ${isSelected ? config.color : 'text-muted-foreground'}`}>
                        {config.label}
                      </span>
                      {/* Selected glow pulse */}
                      {isSelected && (
                        <motion.div
                          layoutId="mood-glow"
                          className="absolute inset-0 rounded-full border-2 border-primary/40"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}
                    </motion.button>
                  )
                })}
              </div>

              {/* Skip link */}
              <div className="mt-5 text-center">
                <button
                  onClick={handleMoodSkip}
                  disabled={moodAnimating}
                  className="text-xs text-muted-foreground hover:text-muted-foreground/80 transition-colors disabled:cursor-default"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==========================================================
           DIALOGS (always rendered, not inside focus overlay)
           ========================================================== */}

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
            {selectedMood && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mood</span>
                <span className={`font-medium flex items-center gap-1 ${MOOD_CONFIG[selectedMood].color}`}>
                  {MOOD_CONFIG[selectedMood].emoji} {MOOD_CONFIG[selectedMood].label}
                </span>
              </div>
            )}
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

      {/* Inline style for edge-warning-border animation */}
      <style jsx global>{`
        @keyframes edge-warning-border {
          0%, 100% { box-shadow: 0 0 0 0px oklch(0.60 0.24 25 / 0%); }
          50% { box-shadow: 0 0 0 4px oklch(0.60 0.24 25 / 30%); }
        }
      `}</style>
    </>
  )
}
