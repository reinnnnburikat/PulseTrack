// PulseTrack — API client (replaces Supabase browser client)
// All requests go through Next.js API routes backed by Prisma/SQLite

export function createClient() {
  // No-op for import compatibility
  return null
}

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export async function authFetch(path: string, options?: RequestInit) {
  return apiFetch(path, {
    ...options,
    headers: {
      ...options?.headers,
    },
  })
}

// Server-side export (unused but kept for compatibility)
export function createServerClient() {
  return null
}
