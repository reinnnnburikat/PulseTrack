'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore, useSettingsStore } from '@/store/auth-store'
import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2, Edit3, Play, Infinity, Timer, Zap } from 'lucide-react'
import type { SessionProfile, Tone } from '@/lib/types'

const toneColors: Record<Tone, string> = {
  dominant: 'bg-red-500/15 text-red-300 border-red-500/20',
  hypnotic: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  teasing: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
}

type ProfileForm = {
  name: string
  active_duration: string
  rest_duration: string
  cycles: string
  infinite_cycles: boolean
  tone: Tone
  intensity_mode: boolean
}

const defaultForm: ProfileForm = {
  name: '',
  active_duration: '25',
  rest_duration: '5',
  cycles: '4',
  infinite_cycles: false,
  tone: 'teasing',
  intensity_mode: false,
}

function ProfileFormFields({ form, setForm }: { form: ProfileForm; setForm: (f: ProfileForm) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Profile Name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g., Quick Burn" className="bg-background/50" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Active (min)</Label>
          <Input type="number" value={form.active_duration} onChange={(e) => setForm({ ...form, active_duration: e.target.value })}
            className="bg-background/50" />
        </div>
        <div>
          <Label className="text-xs">Rest (min)</Label>
          <Input type="number" value={form.rest_duration} onChange={(e) => setForm({ ...form, rest_duration: e.target.value })}
            className="bg-background/50" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Cycles</Label>
        <div className="flex items-center gap-3">
          <Input type="number" value={form.cycles} onChange={(e) => setForm({ ...form, cycles: e.target.value })}
            className="bg-background/50" disabled={form.infinite_cycles} />
          <div className="flex items-center gap-2">
            <Switch checked={form.infinite_cycles} onCheckedChange={(c) => setForm({ ...form, infinite_cycles: c })} />
            <Infinity className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
      <div>
        <Label className="text-xs">Tone</Label>
        <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v as Tone })}>
          <SelectTrigger className="bg-background/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dominant">Dominant</SelectItem>
            <SelectItem value="hypnotic">Hypnotic</SelectItem>
            <SelectItem value="teasing">Teasing</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={form.intensity_mode} onCheckedChange={(c) => setForm({ ...form, intensity_mode: c })} />
        <Label className="text-xs">Intensity Mode</Label>
      </div>
    </div>
  )
}

export function ProfilesView() {
  const { user, setView } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editProfile, setEditProfile] = useState<SessionProfile | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileForm>({ ...defaultForm })

  const { data: profiles = [], isLoading } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async (f: ProfileForm) => {
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      await fetch('/api/profiles', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name,
          active_duration: parseInt(f.active_duration),
          rest_duration: parseInt(f.rest_duration),
          cycles: parseInt(f.cycles),
          infinite_cycles: f.infinite_cycles,
          tone: f.tone,
          intensity_mode: f.intensity_mode,
        }),
      })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profiles'] }); setShowCreate(false); setForm({ ...defaultForm }) },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...f }: SessionProfile & { id: string }) => {
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      await fetch('/api/profiles', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...f }),
      })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profiles'] }); setEditProfile(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      await fetch('/api/profiles', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const openEdit = (p: SessionProfile) => {
    setEditProfile(p)
    setForm({
      name: p.name,
      active_duration: String(p.active_duration),
      rest_duration: String(p.rest_duration),
      cycles: String(p.cycles),
      infinite_cycles: p.infinite_cycles,
      tone: p.tone as Tone,
      intensity_mode: p.intensity_mode,
    })
  }

  const handleStartProfile = (p: SessionProfile) => {
    useSettingsStore.getState().updateSettings({
      activeDuration: p.active_duration,
      restDuration: p.rest_duration,
      cycles: p.cycles,
      infiniteCycles: p.infinite_cycles,
      tone: p.tone as Tone,
      intensityMode: p.intensity_mode,
    })
    useSettingsStore.getState().saveSettings()
    setView('session')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Session Profiles</h1>
        <Button size="sm" onClick={() => { setForm({ ...defaultForm }); setShowCreate(true) }} className="bg-primary text-xs">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Create
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card className="bg-card/60 border-border/50">
          <CardContent className="py-12 text-center">
            <Timer className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No profiles yet. Create one to quick-start your sessions.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(profiles as SessionProfile[]).map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="bg-card/60 border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm">{p.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className={`text-[10px] ${toneColors[p.tone as Tone] || ''}`}>{p.tone}</Badge>
                        {p.intensity_mode && (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-300 border-0">
                            <Zap className="w-2.5 h-2.5 mr-0.5" /> Intensity
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span>{p.active_duration}m active</span>
                    <span>•</span>
                    <span>{p.rest_duration}m rest</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      {p.infinite_cycles ? <Infinity className="w-3 h-3" /> : `${p.cycles} cycles`}
                    </span>
                  </div>
                  <Button size="sm" className="w-full bg-primary/10 text-primary hover:bg-primary/20 text-xs" onClick={() => handleStartProfile(p)}>
                    <Play className="w-3 h-3 mr-1.5" /> Start Session
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader><DialogTitle>Create Profile</DialogTitle></DialogHeader>
          <ProfileFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-border/50">Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} className="bg-primary" disabled={createMutation.isPending || !form.name}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProfile} onOpenChange={() => setEditProfile(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <ProfileFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfile(null)} className="border-border/50">Cancel</Button>
            <Button onClick={() => editProfile && updateMutation.mutate({
              ...editProfile, name: form.name, active_duration: parseInt(form.active_duration),
              rest_duration: parseInt(form.rest_duration), cycles: parseInt(form.cycles),
              infinite_cycles: form.infinite_cycles, tone: form.tone, intensity_mode: form.intensity_mode,
            })} className="bg-primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/50">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
