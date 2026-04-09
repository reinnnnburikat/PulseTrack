'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

// Declare global types for Google Identity Services
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: (callback?: (notification: any) => void) => void
          renderButton: (parent: HTMLElement, options: any) => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

// Custom event types for GIS callback → React communication
const GOOGLE_AUTH_LOADING = 'pulsetrack:google-loading'
const GOOGLE_AUTH_ERROR = 'pulsetrack:google-error'
const GOOGLE_AUTH_SUCCESS = 'pulsetrack:google-success'

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  // Listen for Google auth events from the GIS callback
  useEffect(() => {
    const onLoading = () => setGoogleLoading(true)
    const onError = ((e: CustomEvent) => setError(e.detail)) as EventListener
    const onSuccess = () => useAuthStore.getState().initialize()

    window.addEventListener(GOOGLE_AUTH_LOADING, onLoading)
    window.addEventListener(GOOGLE_AUTH_ERROR, onError)
    window.addEventListener(GOOGLE_AUTH_SUCCESS, onSuccess)

    return () => {
      window.removeEventListener(GOOGLE_AUTH_LOADING, onLoading)
      window.removeEventListener(GOOGLE_AUTH_ERROR, onError)
      window.removeEventListener(GOOGLE_AUTH_SUCCESS, onSuccess)
    }
  }, [])

  // Initialize Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    const handleGoogleCredential = async (response: { credential: string }) => {
      window.dispatchEvent(new Event(GOOGLE_AUTH_LOADING))

      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ credential: response.credential }),
        })

        const data = await res.json()
        if (!res.ok) {
          window.dispatchEvent(new CustomEvent(GOOGLE_AUTH_ERROR, { detail: data.error || 'Google sign-in failed' }))
        } else {
          window.dispatchEvent(new Event(GOOGLE_AUTH_SUCCESS))
        }
      } catch (err: any) {
        window.dispatchEvent(new CustomEvent(GOOGLE_AUTH_ERROR, { detail: err.message || 'Google sign-in failed' }))
      }

      setGoogleLoading(false)
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        })
      }
    }
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [GOOGLE_CLIENT_ID])

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in environment variables.')
      return
    }
    if (!window.google?.accounts?.id) {
      setError('Google Sign-In is still loading. Please try again in a moment.')
      return
    }
    window.google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setError('Google sign-in popup was blocked. Please allow popups for this site.')
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const endpoint = mode === 'login' ? '/api/auth/signin' : '/api/auth/signup'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        await useAuthStore.getState().initialize()
      }
    } catch (err: any) {
      setError(err.message || 'Connection error')
    }

    setLoading(false)
  }

  const isAnyLoading = loading || googleLoading

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-5xl mb-3"
          >
            💓
          </motion.div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-rose-300 bg-clip-text text-transparent">
            PulseTrack
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Immersive session-based habit tracking
          </p>
        </div>

        <Card className="bg-card/80 backdrop-blur-xl border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Sign in to continue your journey'
                : 'Start your tracking journey today'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={isAnyLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-border/60 bg-background/50 hover:bg-background/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {googleLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full"
                />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              <span className="text-sm font-medium text-foreground">
                Continue with Google
              </span>
            </button>

            <div className="relative my-4">
              <Separator />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50 border-border/50 focus:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-background/50 border-border/50 focus:border-primary/50"
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isAnyLoading}
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full"
                  />
                ) : mode === 'login' ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
                className="text-primary hover:underline font-medium"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Private & Secure — Your data is yours alone
        </p>
      </motion.div>
    </div>
  )
}
