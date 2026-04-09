import { randomUUID } from 'crypto'

interface SessionData {
  userId: string
  expiresAt: number
}

// In-memory session store
const sessions = new Map<string, SessionData>()

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = randomUUID()
  const expiresAt = Date.now() + SESSION_DURATION
  sessions.set(token, { userId, expiresAt })
  return { token, expiresAt }
}

export function validateSession(token: string): SessionData | null {
  const data = sessions.get(token)
  if (!data) return null
  if (Date.now() > data.expiresAt) {
    sessions.delete(token)
    return null
  }
  return data
}

export function destroySession(token: string): void {
  sessions.delete(token)
}

// Get userId from request (cookie or Authorization header)
export async function getUserId(req: Request): Promise<string | null> {
  // Try Authorization header first
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const session = validateSession(token)
    if (session) return session.userId
  }

  // Try cookie
  const cookieHeader = req.headers.get('Cookie') || ''
  const tokenMatch = cookieHeader.match(/pulsetrack-token=([^;]+)/)
  if (tokenMatch) {
    const session = validateSession(tokenMatch[1])
    if (session) return session.userId
  }

  return null
}

// Password hashing using scrypt
export async function hashPassword(password: string): Promise<string> {
  const { scrypt, randomBytes } = await import('crypto')
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex')
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(`${salt}:${derivedKey.toString('hex')}`)
    })
  })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const { scrypt } = await import('crypto')
  const [salt, key] = hash.split(':')
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(derivedKey.toString('hex') === key)
    })
  })
}
