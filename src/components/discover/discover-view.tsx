'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth-store'
import { apiFetch } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Heart,
  Crown,
  Feather,
  ArrowLeftRight,
  Shuffle,
  Users,
  Flame,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { setView } from '@/store/auth-store'

const roleIcons: Record<string, React.ReactNode> = {
  top: <Crown className="w-4 h-4 text-orange-400" />,
  bottom: <Feather className="w-4 h-4 text-sky-300" />,
  versatile: <Shuffle className="w-4 h-4 text-emerald-400" />,
  switch: <ArrowLeftRight className="w-4 h-4 text-purple-400" />,
}

const traitIcons: Record<string, React.ReactNode> = {
  dominant: <Crown className="w-5 h-5 text-red-400" />,
  submissive: <Feather className="w-5 h-5 text-blue-300" />,
  switch: <ArrowLeftRight className="w-5 h-5 text-purple-400" />,
}

const kinkLabels: Record<string, string> = {
  bondage: 'Bondage',
  power_exchange: 'Power Exchange',
  impact: 'Impact Play',
  sensory: 'Sensory Play',
  overstim: 'Overstimulation',
  exhibitionist: 'Exhibitionism',
  private: 'Private',
  explorer: 'Explorer',
}

export function DiscoverView() {
  const { user } = useAuthStore()
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [traitFilter, setTraitFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['discover', roleFilter, traitFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (traitFilter !== 'all') params.set('trait', traitFilter)
      const res = await apiFetch(`/api/discover?${params.toString()}`)
      return res.data || []
    },
    enabled: !!user,
  })

  const filteredProfiles = searchQuery
    ? profiles.filter((p: any) =>
        p.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : profiles

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Discover
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse profiles and find compatible partners
        </p>
      </div>

      {/* Filters */}
      <Card className="bg-card/60 border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50 border-border/50"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-background/50 border-border/50">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
                <SelectItem value="versatile">Versatile</SelectItem>
                <SelectItem value="switch">Switch</SelectItem>
              </SelectContent>
            </Select>
            <Select value={traitFilter} onValueChange={setTraitFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-background/50 border-border/50">
                <SelectValue placeholder="Trait" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Traits</SelectItem>
                <SelectItem value="dominant">Dominant</SelectItem>
                <SelectItem value="submissive">Submissive</SelectItem>
                <SelectItem value="switch">Switch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Profiles Grid */}
      {filteredProfiles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {profiles.length === 0
              ? 'No profiles yet. Complete the quiz to be discoverable!'
              : 'No results match your filters.'}
          </p>
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filteredProfiles.map((profile: any, i: number) => (
            <motion.div
              key={profile.user_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="bg-card/60 border-border/50 hover:border-primary/30 transition-all duration-300 group">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary text-lg font-bold shrink-0">
                      {profile.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">
                          {profile.display_name || 'Anonymous'}
                        </h3>
                        <Badge variant="secondary" className="text-[10px] bg-violet-500/15 text-violet-300 border-0 shrink-0">
                          Lv.{profile.level}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {profile.total_sessions} sessions
                      </p>
                    </div>
                  </div>

                  {/* Quiz Results */}
                  {profile.quiz && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {traitIcons[profile.quiz.dominant_trait]}
                          <span className="text-sm font-medium capitalize">
                            {profile.quiz.dominant_trait}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {roleIcons[profile.quiz.role_preference]}
                          <span className="text-xs text-muted-foreground capitalize">
                            {profile.quiz.role_preference}
                          </span>
                        </div>
                      </div>

                      {/* Kinks */}
                      {profile.quiz.kinks && profile.quiz.kinks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {profile.quiz.kinks.slice(0, 3).map((kink: string, ki: number) => (
                            <Badge
                              key={kink}
                              variant="outline"
                              className={`text-[10px] py-0.5 px-2 border-0 ${
                                ki === 0 ? 'bg-red-500/10 text-red-300' :
                                ki === 1 ? 'bg-amber-500/10 text-amber-300' :
                                'bg-emerald-500/10 text-emerald-300'
                              }`}
                            >
                              {ki === 0 && <Flame className="w-2.5 h-2.5 mr-0.5" />}
                              {kinkLabels[kink] || kink}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Match Button */}
                  <div className="mt-4 pt-3 border-t border-border/30">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-primary/30 hover:bg-primary/10 text-primary text-xs group-hover:bg-primary/10 transition-colors"
                      onClick={() => {
                        // Store selected user for matching
                        ;(window as any).__selectedMatchUser = profile.user_id
                        ;(window as any).__selectedMatchName = profile.display_name
                        useAuthStore.getState().setView('matches')
                      }}
                    >
                      <Heart className="w-3.5 h-3.5 mr-1.5" />
                      Check Compatibility
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground/50">
        {filteredProfiles.length} profile{filteredProfiles.length !== 1 ? 's' : ''} found
      </p>
    </div>
  )
}
