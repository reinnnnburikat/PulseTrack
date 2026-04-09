'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth-store'
import { apiFetch } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  Heart,
  HeartCrack,
  Star,
  Sparkles,
  Users,
  Shield,
  Target,
  Zap,
  Loader2,
} from 'lucide-react'

interface MatchResult {
  id: string
  matched_user: { id: string; display_name: string | null; avatar_url: string | null }
  compatibility_score: number
  match_details: {
    roleScore: number
    kinkScore: number
    aTopRole: string
    bTopRole: string
    dimensions: Record<string, { a: number; b: number; match: number }>
  }
  matched_quiz: {
    dominant_trait: string
    role_preference: string
    kinks: string[]
  } | null
  created_at: string
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Soul Match'
  if (score >= 80) return 'Strong Match'
  if (score >= 70) return 'Good Match'
  if (score >= 60) return 'Moderate'
  return 'Low Compatibility'
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/15 border-emerald-500/30'
  if (score >= 60) return 'bg-amber-500/15 border-amber-500/30'
  return 'bg-red-500/15 border-red-500/30'
}

function buildRadarData(details: any) {
  if (!details?.dimensions) return []
  return Object.entries(details.dimensions)
    .filter(([_, v]: any) => v.a > 0 || v.b > 0)
    .slice(0, 8)
    .map(([key, val]: any) => ({
      dimension: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      you: val.a,
      them: val.b,
      match: val.match,
    }))
}

export function MatchesView() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null)
  const [calculating, setCalculating] = useState(false)

  // Get pre-selected user from discover view
  const preSelectedUser = typeof window !== 'undefined' ? (window as any).__selectedMatchUser : null
  const preSelectedName = typeof window !== 'undefined' ? (window as any).__selectedMatchName : null

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const res = await apiFetch('/api/matches')
      return (res.data || []) as MatchResult[]
    },
    enabled: !!user,
  })

  const matchMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return apiFetch('/api/matches', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      // Clean up window globals
      if (typeof window !== 'undefined') {
        delete (window as any).__selectedMatchUser
        delete (window as any).__selectedMatchName
      }
    },
  })

  const handleCalculate = async (targetUserId: string) => {
    setCalculating(true)
    try {
      await matchMutation.mutateAsync(targetUserId)
    } catch {}
    setCalculating(false)
  }

  // Sorted by score desc
  const sortedMatches = [...matches].sort((a, b) => b.compatibility_score - a.compatibility_score)

  // Selected match radar data
  const radarData = selectedMatch ? buildRadarData(selectedMatch.match_details) : []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="w-6 h-6 text-primary" />
            Compatibility Matches
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compare your quiz results with others
          </p>
        </div>
        {preSelectedUser && calculating && (
          <Badge className="bg-primary/15 text-primary border-0">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Calculating...
          </Badge>
        )}
      </div>

      {calculating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Heart className="w-12 h-12 text-primary mx-auto" />
          </motion.div>
          <p className="text-sm text-muted-foreground mt-3">Analyzing compatibility...</p>
        </motion.div>
      )}

      {sortedMatches.length === 0 && !calculating ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No matches yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Browse profiles and check compatibility to see results here.
          </p>
          <Button
            variant="outline"
            className="mt-4 border-primary/30 text-primary"
            onClick={() => useAuthStore.getState().setView('discover')}
          >
            <Users className="w-4 h-4 mr-2" />
            Browse Profiles
          </Button>
        </motion.div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Match Cards */}
          <div className="space-y-3">
            {sortedMatches.map((match: MatchResult, i: number) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedMatch?.id === match.id
                      ? 'border-primary/50 bg-primary/5'
                      : 'bg-card/60 border-border/50 hover:border-primary/30'
                  }`}
                  onClick={() => setSelectedMatch(selectedMatch?.id === match.id ? null : match)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold shrink-0">
                        {match.matched_user.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">
                          {match.matched_user.display_name || 'Anonymous'}
                        </h3>
                        {match.matched_quiz && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[9px] border-0 bg-secondary/50">
                              {match.matched_quiz.dominant_trait}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {match.matched_quiz.role_preference}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-2xl font-black ${getScoreColor(match.compatibility_score)}`}>
                          {match.compatibility_score}%
                        </p>
                        <p className={`text-[9px] ${getScoreColor(match.compatibility_score)}`}>
                          {getScoreLabel(match.compatibility_score)}
                        </p>
                      </div>
                    </div>

                    {/* Mini progress bars */}
                    <div className="flex gap-3 mt-3">
                      <div className="flex-1">
                        <p className="text-[9px] text-muted-foreground mb-1">Role Match</p>
                        <Progress
                          value={match.match_details?.roleScore || 0}
                          className="h-1.5 bg-secondary [&>[data-slot=progress-indicator]]:bg-primary"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] text-muted-foreground mb-1">Interest Overlap</p>
                        <Progress
                          value={match.match_details?.kinkScore || 0}
                          className="h-1.5 bg-secondary [&>[data-slot=progress-indicator]]:bg-emerald-400"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Match Detail Panel */}
          <div className="lg:sticky lg:top-6">
            <AnimatePresence mode="wait">
              {selectedMatch ? (
                <motion.div
                  key={selectedMatch.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-4"
                >
                  {/* Score Header */}
                  <Card className={`${getScoreBg(selectedMatch.compatibility_score)} border`}>
                    <CardContent className="p-6 text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                      >
                        <Heart className={`w-10 h-10 mx-auto mb-2 ${getScoreColor(selectedMatch.compatibility_score)}`} />
                      </motion.div>
                      <motion.p
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.2 }}
                        className={`text-4xl font-black ${getScoreColor(selectedMatch.compatibility_score)}`}
                      >
                        {selectedMatch.compatibility_score}%
                      </motion.p>
                      <p className={`text-sm mt-1 ${getScoreColor(selectedMatch.compatibility_score)}`}>
                        {getScoreLabel(selectedMatch.compatibility_score)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        with {selectedMatch.matched_user.display_name || 'Anonymous'}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Breakdown */}
                  <Card className="bg-card/60 border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 rounded-lg bg-secondary/30">
                          <Shield className="w-5 h-5 text-primary mx-auto mb-1" />
                          <p className="text-lg font-bold">{selectedMatch.match_details?.roleScore || 0}%</p>
                          <p className="text-[10px] text-muted-foreground">Role Match</p>
                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                            {selectedMatch.match_details?.aTopRole || '?'} ↔ {selectedMatch.match_details?.bTopRole || '?'}
                          </p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-secondary/30">
                          <Star className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                          <p className="text-lg font-bold">{selectedMatch.match_details?.kinkScore || 0}%</p>
                          <p className="text-[10px] text-muted-foreground">Interest Overlap</p>
                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                            Cosine similarity
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Radar Chart */}
                  {radarData.length > 0 && (
                    <Card className="bg-card/60 border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-400" />
                          Profile Comparison
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                              <PolarGrid stroke="rgba(255,255,255,0.08)" />
                              <PolarAngleAxis
                                dataKey="dimension"
                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                              />
                              <PolarRadiusAxis
                                angle={30}
                                domain={[0, 'auto']}
                                tick={false}
                                axisLine={false}
                              />
                              <Radar
                                name="You"
                                dataKey="you"
                                stroke="oklch(0.72 0.18 320)"
                                fill="oklch(0.72 0.18 320)"
                                fillOpacity={0.2}
                                strokeWidth={2}
                              />
                              <Radar
                                name="Them"
                                dataKey="them"
                                stroke="oklch(0.65 0.15 160)"
                                fill="oklch(0.65 0.15 160)"
                                fillOpacity={0.2}
                                strokeWidth={2}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: 'rgba(20,20,30,0.95)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                }}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex items-center justify-center gap-4 mt-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-[oklch(0.72_0.18_320)]" />
                            <span className="text-[10px] text-muted-foreground">You</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-[oklch(0.65_0.15_160)]" />
                            <span className="text-[10px] text-muted-foreground">
                              {selectedMatch.matched_user.display_name || 'Them'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Their Kinks */}
                  {selectedMatch.matched_quiz?.kinks && (
                    <Card className="bg-card/60 border-border/50">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-2">Their Top Interests</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedMatch.matched_quiz.kinks.map((kink, i) => (
                            <Badge
                              key={kink}
                              variant="outline"
                              className="text-[10px] py-0.5 px-2 border-0 bg-primary/10 text-primary/80"
                            >
                              {kink}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center h-64 border border-dashed border-border/50 rounded-xl"
                >
                  <div className="text-center">
                    <HeartCrack className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Select a match to see details
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}
