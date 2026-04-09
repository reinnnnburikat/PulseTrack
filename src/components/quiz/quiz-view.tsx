'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth-store'
import { apiFetch } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Crown,
  Feather,
  ArrowLeftRight,
  Shuffle,
  Flame,
  Heart,
  RotateCcw,
  Save,
  Brain,
  ChevronRight,
  ChevronLeft,
  Compass,
  Sparkles,
} from 'lucide-react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'

interface QuizQuestion {
  id: string
  category: string
  question: string
  options: { label: string; scores: Record<string, number> }[]
}

const categoryIcons: Record<string, string> = {
  orientation: '🧭',
  role: '🎭',
  kinks: '🔥',
  compatibility: '💕',
}

const categoryLabels: Record<string, string> = {
  orientation: 'Orientation',
  role: 'Role',
  kinks: 'Kinks & Interests',
  compatibility: 'Compatibility',
}

const traitIcons: Record<string, React.ReactNode> = {
  dominant: <Crown className="w-6 h-6 text-red-400" />,
  submissive: <Feather className="w-6 h-6 text-blue-300" />,
  switch: <ArrowLeftRight className="w-6 h-6 text-purple-400" />,
  versatile: <Shuffle className="w-6 h-6 text-emerald-400" />,
  top: <Crown className="w-5 h-5 text-orange-400" />,
  bottom: <Feather className="w-5 h-5 text-sky-300" />,
}

const kinkLabels: Record<string, string> = {
  bondage: 'Bondage & Restraint',
  power_exchange: 'Power Exchange',
  impact: 'Impact Play',
  sensory: 'Sensory Play',
  exhibitionist: 'Exhibitionism',
  voyeur: 'Voyeurism',
  fantasy: 'Fantasy Exploration',
  medical: 'Medical Play',
  overstim: 'Overstimulation',
  private: 'Private Only',
}

const compatibilityMap: Record<string, string> = {
  'dominant-top': 'You pair best with someone who finds deep satisfaction in surrendering — someone who trusts your lead and thrives under your command.',
  'dominant-bottom': 'A rare and powerful combination — you find release through surrender, discovering strength in vulnerability while maintaining your inner authority.',
  'submissive-top': 'You lead with gentle care rather than control — a nurturing top who creates safety through service and attention.',
  'submissive-bottom': 'You pair best with someone who leads with confident care — someone who earns your trust and respects the gift of your surrender.',
  'switch': 'You pair best with another Switch who enjoys the dance of power exchange — both of you fluid, communicative, and endlessly adaptable.',
  'versatile': 'Your openness makes you compatible with a wide range of partners. The key is mutual respect and genuine curiosity about each other.',
}

export function QuizView() {
  const { user } = useAuthStore()
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'results'>('intro')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showSaveToast, setShowSaveToast] = useState(false)

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['quiz-questions'],
    queryFn: async () => {
      const res = await fetch('/api/quiz')
      const json = await res.json()
      return json.data || []
    },
  })

  const currentQuestion = questions[questionIndex] as QuizQuestion | undefined

  const handleAnswer = (optionIndex: number) => {
    if (selectedAnswer !== null) return
    setSelectedAnswer(optionIndex)

    if (currentQuestion) {
      const option = currentQuestion.options[optionIndex]
      const newScores = { ...scores }
      for (const [key, value] of Object.entries(option.scores)) {
        newScores[key] = (newScores[key] || 0) + value
      }
      setScores(newScores)
    }

    setTimeout(() => {
      setSelectedAnswer(null)
      if (questionIndex < questions.length - 1) {
        setQuestionIndex(questionIndex + 1)
      } else {
        setPhase('results')
      }
    }, 600)
  }

  const goBack = () => {
    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1)
      setSelectedAnswer(null)
    }
  }

  // Calculate results
  const getResults = () => {
    const s = scores

    // Dominant trait
    const dScore = (s.dominant || 0)
    const sScore = (s.submissive || 0)
    const swScore = (s.switch || 0)
    const dominant_trait = dScore >= sScore && dScore >= swScore ? 'dominant'
      : sScore >= dScore && sScore >= swScore ? 'submissive' : 'switch'

    // Role preference
    const topS = (s.top || 0) + (s.dominant || 0) * 0.3
    const botS = (s.bottom || 0) + (s.submissive || 0) * 0.3
    const versS = (s.versatile || 0) + (s.switch || 0) * 0.3
    const role_preference = topS >= botS && topS >= versS ? 'top'
      : botS >= topS && botS >= versS ? 'bottom'
      : versS >= topS && versS >= botS ? 'versatile' : 'switch'

    // Kinks
    const kinkScores = Object.entries(s)
      .filter(([k]) => !['dominant', 'submissive', 'switch', 'top', 'bottom', 'versatile', 'teasing', 'sensible', 'explorer', 'observer', 'private', 'personality_first'].includes(k))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
    const kinks = kinkScores.map(([k]) => k)

    // Compatibility
    const compatKey = `${dominant_trait}-${role_preference}`
    const compatibility_type = compatibilityMap[compatKey] || compatibilityMap[dominant_trait] || compatibilityMap[role_preference] || 'Your unique profile means deep connection comes through honest communication and mutual respect.'

    return { dominant_trait, role_preference, kinks, compatibility_type }
  }

  const saveResults = async () => {
    if (!user) return
    const results = getResults()

    try {
      await apiFetch('/api/quiz', {
        method: 'POST',
        body: JSON.stringify({
          scores,
          dominant_trait: results.dominant_trait,
          role_preference: results.role_preference,
          kinks: results.kinks,
          compatibility_type: results.compatibility_type,
        }),
      })
      setShowSaveToast(true)
      setTimeout(() => setShowSaveToast(false), 3000)
    } catch {}
  }

  const results = phase === 'results' ? getResults() : null
  const sortedTraits = Object.entries(scores).sort(([, a], [, b]) => b - a).slice(0, 8)
  const maxTraitScore = sortedTraits.length > 0 ? sortedTraits[0][1] : 1

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <AnimatePresence mode="wait">
        {/* INTRO */}
        {phase === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center text-center py-12 space-y-6">
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2.5, repeat: Infinity }}>
              <Brain className="w-16 h-16 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Discover Your Profile</h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
                Answer honestly to uncover your dominant traits, role preference, kinks, and ideal compatibility match.
                <br /><br />
                <span className="text-xs text-muted-foreground/60">13 questions • ~3 minutes • Completely private</span>
              </p>
            </div>
            <Button size="lg" onClick={() => setPhase('quiz')} className="bg-primary hover:bg-primary/90 px-10">
              Start Quiz <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}

        {/* QUIZ */}
        {phase === 'quiz' && currentQuestion && (
          <motion.div key={`q-${questionIndex}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="space-y-6 py-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">
                  {categoryIcons[currentQuestion.category]} {categoryLabels[currentQuestion.category] || currentQuestion.category}
                </Badge>
                <span>{questionIndex + 1} / {questions.length}</span>
              </div>
              <Progress value={((questionIndex + 1) / questions.length) * 100} className="h-1" />
            </div>

            {/* Question */}
            <Card className="bg-card/80 border-border/50">
              <CardContent className="py-8 px-6">
                <h2 className="text-lg font-medium text-center leading-relaxed">
                  {currentQuestion.question}
                </h2>
              </CardContent>
            </Card>

            {/* Options */}
            <div className="space-y-2">
              {currentQuestion.options.map((option, i) => (
                <motion.button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                    selectedAnswer === i
                      ? 'bg-primary/15 border-primary/50 text-primary'
                      : 'bg-card/60 border-border/50 hover:bg-accent/30 hover:border-accent'
                  }`}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Back */}
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={goBack} disabled={questionIndex === 0}
                className="text-muted-foreground text-xs">
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
            </div>
          </motion.div>
        )}

        {/* RESULTS */}
        {phase === 'results' && results && (
          <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} className="space-y-4 py-4">
            <div className="text-center mb-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
                {traitIcons[results.dominant_trait] || <Sparkles className="w-10 h-10 text-primary" />}
              </motion.div>
              <h1 className="text-2xl font-bold mt-3 capitalize">{results.dominant_trait}</h1>
              <p className="text-muted-foreground text-sm mt-1">Core Orientation</p>
            </div>

            {/* Role */}
            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Role Preference</p>
                    <p className="text-lg font-semibold capitalize flex items-center gap-2">
                      {traitIcons[results.role_preference]}
                      {results.role_preference}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {results.role_preference === 'top' && <Crown className="w-6 h-6 text-orange-400" />}
                    {results.role_preference === 'bottom' && <Feather className="w-6 h-6 text-sky-300" />}
                    {results.role_preference === 'versatile' && <Shuffle className="w-6 h-6 text-emerald-400" />}
                    {results.role_preference === 'switch' && <ArrowLeftRight className="w-6 h-6 text-purple-400" />}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Kinks */}
            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-3">Your Top Interests</p>
                <div className="flex flex-wrap gap-2">
                  {results.kinks.map((kink, i) => (
                    <motion.div
                      key={kink}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                    >
                      <Badge variant="outline" className={`text-xs py-1.5 px-3 border-0 ${
                        i === 0 ? 'bg-red-500/15 text-red-300' :
                        i === 1 ? 'bg-amber-500/15 text-amber-300' :
                        'bg-emerald-500/15 text-emerald-300'
                      }`}>
                        {i === 0 && <Flame className="w-3 h-3 mr-1" />}
                        {i === 1 && <Heart className="w-3 h-3 mr-1" />}
                        {i === 2 && <Compass className="w-3 h-3 mr-1" />}
                        {kinkLabels[kink] || kink}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Compatibility */}
            <Card className="bg-card/60 border-primary/20 border animate-pulse-glow">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Heart className="w-3 h-3 text-primary" /> Compatibility
                </p>
                <p className="text-sm leading-relaxed">{results.compatibility_type}</p>
              </CardContent>
            </Card>

            {/* Score Breakdown */}
            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-3">Score Breakdown</p>
                <div className="space-y-2">
                  {sortedTraits.map(([trait, score], i) => (
                    <div key={trait} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-28 truncate capitalize">{trait}</span>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(score / maxTraitScore) * 100}%` }}
                          transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-6 text-right">{score}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Radar Chart */}
            {sortedTraits.length >= 3 && (
              <Card className="bg-card/60 border-border/50">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-primary" /> Profile Radar
                  </p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={sortedTraits.map(([trait, score]) => ({
                        trait: trait.charAt(0).toUpperCase() + trait.slice(1),
                        score,
                      }))}>
                        <PolarGrid stroke="rgba(255,255,255,0.08)" />
                        <PolarAngleAxis
                          dataKey="trait"
                          tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 'auto']}
                          tick={false}
                          axisLine={false}
                        />
                        <Radar
                          name="Score"
                          dataKey="score"
                          stroke="oklch(0.72 0.18 320)"
                          fill="oklch(0.72 0.18 320)"
                          fillOpacity={0.25}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setPhase('intro'); setQuestionIndex(0); setScores({}); setSelectedAnswer(null) }}
                className="flex-1 border-border/50">
                <RotateCcw className="w-4 h-4 mr-2" /> Retake
              </Button>
              <Button onClick={saveResults} className="flex-1 bg-primary">
                <Save className="w-4 h-4 mr-2" /> Save Results
              </Button>
            </div>

            {/* Save Toast */}
            <AnimatePresence>
              {showSaveToast && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm text-emerald-400"
                >
                  Results saved successfully
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
