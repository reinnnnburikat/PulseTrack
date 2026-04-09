'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth-store'
import { createClient } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, Trash2, Edit3, Download, CalendarDays, List, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns'
import type { Session } from '@/lib/types'

export function HistoryView() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [page, setPage] = useState(0)
  const [intensityFilter, setIntensityFilter] = useState<string>('all')
  const [calendarDate, setCalendarDate] = useState<Date>(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [editSession, setEditSession] = useState<Session | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [formState, setFormState] = useState({ duration: '', intensity: '3', notes: '', profile: '' })
  const pageSize = 10

  // Fetch sessions
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      if (!user) return []
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/sessions?limit=500', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      return json.data || []
    },
    enabled: !!user,
  })

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      await fetch(`/api/sessions?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const updateMutation = useMutation({
    mutationFn: async (s: Session) => {
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      await fetch('/api/sessions', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sessions'] }); setEditSession(null) },
  })

  const addMutation = useMutation({
    mutationFn: async (s: Partial<Session>) => {
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sessions'] }); setShowAddDialog(false); setFormState({ duration: '', intensity: '3', notes: '', profile: '' }) },
  })

  const filteredSessions = (sessions as Session[]).filter((s) => {
    if (intensityFilter !== 'all' && s.intensity !== parseInt(intensityFilter)) return false
    return true
  })

  const paginatedSessions = filteredSessions.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(filteredSessions.length / pageSize)

  // Calendar helpers
  const monthStart = startOfMonth(calendarDate)
  const monthEnd = endOfMonth(calendarDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getSessionsForDay = (day: Date) =>
    (sessions as Session[]).filter((s) => isSameDay(parseISO(s.created_at), day))

  const selectedDaySessions = selectedDay ? getSessionsForDay(selectedDay) : []

  // CSV Export
  const exportCSV = () => {
    const headers = ['Date', 'Duration (s)', 'Intensity', 'Profile', 'Notes']
    const rows = filteredSessions.map((s: Session) => [
      s.created_at, s.duration, s.intensity, s.profile || '', s.notes || ''
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pulsetrack-sessions-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Session History</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="border-border/50 text-xs">
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="bg-primary text-xs">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Session
          </Button>
        </div>
      </div>

      {/* View toggle + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-secondary/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <List className="w-3.5 h-3.5" /> Table
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> Calendar
          </button>
        </div>
        <Select value={intensityFilter} onValueChange={setIntensityFilter}>
          <SelectTrigger className="w-32 h-8 text-xs bg-card/60 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {[1, 2, 3, 4, 5].map((i) => (
              <SelectItem key={i} value={String(i)}>Intensity {i}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-[10px]">{filteredSessions.length} sessions</Badge>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'table' ? (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left text-xs font-medium text-muted-foreground p-3">Date</th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3">Duration</th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden sm:table-cell">Intensity</th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Profile</th>
                        <th className="text-right text-xs font-medium text-muted-foreground p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSessions.map((s: Session, i: number) => (
                        <motion.tr
                          key={s.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                        >
                          <td className="p-3 text-sm">{format(parseISO(s.created_at), 'MMM d, h:mm a')}</td>
                          <td className="p-3 text-sm font-medium">{formatDuration(s.duration)}</td>
                          <td className="p-3 hidden sm:table-cell">
                            <Badge variant="outline" className={`text-[10px] border-0 ${
                              s.intensity >= 4 ? 'bg-red-500/20 text-red-300' :
                              s.intensity >= 3 ? 'bg-amber-500/20 text-amber-300' :
                              'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              I{s.intensity}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                            {s.profile || '—'}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditSession(s)
                                  setFormState({ duration: String(s.duration), intensity: String(s.intensity), notes: s.notes || '', profile: s.profile || '' })
                                }}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteId(s.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {paginatedSessions.length === 0 && (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    No sessions found
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}
                        className="h-7 border-border/50">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
                        className="h-7 border-border/50">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="bg-card/60 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="sm" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                    className="border-border/50">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-medium">{format(calendarDate, 'MMMM yyyy')}</span>
                  <Button variant="ghost" size="sm" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                    className="border-border/50">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
                  ))}
                  {daysInMonth.map((day) => {
                    const daySessions = getSessionsForDay(day)
                    const isSelected = selectedDay && isSameDay(day, selectedDay)
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDay(isSelected ? null : day)}
                        className={`relative p-2 rounded-lg text-sm transition-all ${
                          isSelected ? 'bg-primary/20 text-primary' : 'hover:bg-accent/30'
                        } ${!isSameMonth(day, calendarDate) && 'text-muted-foreground/30'}`}
                      >
                        {format(day, 'd')}
                        {daySessions.length > 0 && (
                          <div className="flex justify-center gap-0.5 mt-0.5">
                            {daySessions.slice(0, 3).map((_, i) => (
                              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
                            ))}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {selectedDay && selectedDaySessions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 space-y-2 border-t border-border/50 pt-4"
                  >
                    <h3 className="text-sm font-medium">{format(selectedDay, 'MMMM d, yyyy')}</h3>
                    {selectedDaySessions.map((s: Session) => (
                      <div key={s.id} className="flex justify-between items-center py-2 px-3 bg-background/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{format(parseISO(s.created_at), 'h:mm a')}</span>
                          <Badge variant="outline" className="text-[10px] border-0 bg-primary/10 text-primary">I{s.intensity}</Badge>
                        </div>
                        <span className="text-sm font-medium">{formatDuration(s.duration)}</span>
                      </div>
                    ))}
                  </motion.div>
                )}

                {selectedDay && selectedDaySessions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    No sessions on {format(selectedDay, 'MMMM d')}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Session Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Add Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Duration (seconds)</Label>
              <Input type="number" value={formState.duration} onChange={(e) => setFormState({ ...formState, duration: e.target.value })}
                placeholder="1500" className="bg-background/50" />
            </div>
            <div>
              <Label className="text-xs">Intensity (1-5)</Label>
              <Select value={formState.intensity} onValueChange={(v) => setFormState({ ...formState, intensity: v })}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((i) => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={formState.notes} onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                placeholder="Optional notes..." className="bg-background/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-border/50">Cancel</Button>
            <Button onClick={() => addMutation.mutate({
              duration: parseInt(formState.duration) || 0,
              intensity: parseInt(formState.intensity) || 3,
              notes: formState.notes || null,
              profile: formState.profile || null,
            })} className="bg-primary" disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Saving...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog open={!!editSession} onOpenChange={() => setEditSession(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Duration (seconds)</Label>
              <Input type="number" value={formState.duration} onChange={(e) => setFormState({ ...formState, duration: e.target.value })}
                className="bg-background/50" />
            </div>
            <div>
              <Label className="text-xs">Intensity</Label>
              <Select value={formState.intensity} onValueChange={(v) => setFormState({ ...formState, intensity: v })}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((i) => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={formState.notes} onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                className="bg-background/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSession(null)} className="border-border/50">Cancel</Button>
            <Button onClick={() => editSession && updateMutation.mutate({
              ...editSession,
              duration: parseInt(formState.duration),
              intensity: parseInt(formState.intensity),
              notes: formState.notes || null,
              profile: formState.profile || null,
            })} className="bg-primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/50">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
