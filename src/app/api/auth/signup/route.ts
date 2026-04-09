import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: { email, passwordHash, displayName: displayName || null },
    })

    // Create default settings
    await db.userSettings.create({
      data: { userId: user.id },
    })

    // Create default gamification
    await db.gamification.create({
      data: { userId: user.id },
    })

    const { token, expiresAt } = createSession(user.id)

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      token,
    })

    res.cookies.set('pulsetrack-token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: Math.floor(expiresAt / 1000),
      path: '/',
    })

    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
