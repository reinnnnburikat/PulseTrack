import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

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
