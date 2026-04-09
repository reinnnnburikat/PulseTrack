import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || 'pulsetrack-fallback-secret-change-me'

// Get the secret as Uint8Array for jose
function getSecret() {
  return new TextEncoder().encode(JWT_SECRET)
}

const SESSION_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds

// Create a JWT token for the user
export async function createSession(userId: string): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + SESSION_DURATION * 1000

  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret())

  return { token, expiresAt }
}

// Verify a JWT token and return the userId
export function validateSession(token: string): { userId: string; expiresAt: number } | null {
  // We do async verification in getUserId, this is a convenience wrapper
  return null // Not used for JWT — getUserId handles verification directly
}

// Destroy session — no-op for JWT (stateless), client just clears cookie
export function destroySession(_token: string): void {
  // JWT is stateless, nothing to destroy server-side
}

// Get userId from request (cookie or Authorization header)
export async function getUserId(req: Request): Promise<string | null> {
  let token: string | null = null

  // Try Authorization header first
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }

  // Try cookie
  if (!token) {
    const cookieHeader = req.headers.get('Cookie') || ''
    const tokenMatch = cookieHeader.match(/pulsetrack-token=([^;]+)/)
    if (tokenMatch) {
      token = tokenMatch[1]
    }
  }

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.sub as string
  } catch {
    return null
  }
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
