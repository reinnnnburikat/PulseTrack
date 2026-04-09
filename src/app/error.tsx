'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const details = error.message || String(error)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg bg-card/80 backdrop-blur-xl border-destructive/30">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-destructive">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            An unexpected error occurred. Please try again.
          </p>
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
            <p className="text-xs font-mono text-destructive break-all">{details}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1">
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                document.cookie = 'pulsetrack-token=; path=/; max-age=0'
                window.location.href = '/'
              }}
              className="flex-1"
            >
              Sign Out &amp; Reload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
