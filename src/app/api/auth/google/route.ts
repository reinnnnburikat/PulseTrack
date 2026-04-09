import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth'

interface GoogleTokenInfo {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  iss: string
  aud: string
  iat: number
  exp: number
}

async function verifyGoogleToken(idToken: string): Promise<GoogleTokenInfo> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  )

  if (!response.ok) {
    throw new Error('Invalid Google token')
  }

  const data = await response.json()

  if (data.exp && data.exp < Date.now() / 1000) {
    throw new Error('Google token expired')
  }

  if (!data.email_verified) {
    throw new Error('Email not verified by Google')
  }

  return data as GoogleTokenInfo
}

export async function POST(req: NextRequest) {
  try {
    const { credential, displayName } = await req.json()

    if (!credential) {
      return NextResponse.json(
        { error: 'Google credential required' },
        { status: 400 }
      )
    }

    const tokenInfo = await verifyGoogleToken(credential)

    let user = await db.user.findFirst({
      where: {
        OR: [
          { provider: 'google', providerId: tokenInfo.sub },
          { email: tokenInfo.email },
        ],
      },
    })

    if (!user) {
      user = await db.user.create({
        data: {
          email: tokenInfo.email,
          provider: 'google',
          providerId: tokenInfo.sub,
          displayName: displayName || tokenInfo.name || tokenInfo.given_name || null,
          avatarUrl: tokenInfo.picture || null,
          passwordHash: null,
        },
      })

      await db.userSettings.create({
        data: { userId: user.id },
      })

      await db.gamification.create({
        data: { userId: user.id },
      })
    } else if (user.provider !== 'google') {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          provider: 'google',
          providerId: tokenInfo.sub,
          avatarUrl: tokenInfo.picture || user.avatarUrl,
        },
      })
    } else {
      if (tokenInfo.picture && tokenInfo.picture !== user.avatarUrl) {
        user = await db.user.update({
          where: { id: user.id },
          data: { avatarUrl: tokenInfo.picture },
        })
      }
    }

    const { token, expiresAt } = await createSession(user.id)

    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      token,
    })

    res.cookies.set('pulsetrack-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })

    return res
  } catch (e: any) {
    console.error('Google auth error:', e.message)
    return NextResponse.json(
      { error: e.message || 'Google authentication failed' },
      { status: 401 }
    )
  }
}
