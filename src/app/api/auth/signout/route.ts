import { NextRequest, NextResponse } from 'next/server'
import { getUserId, destroySession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    // Get token from cookie or header
    let token: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }
    if (!token) {
      const cookieHeader = req.headers.get('Cookie') || ''
      const match = cookieHeader.match(/pulsetrack-token=([^;]+)/)
      if (match) token = match[1]
    }

    if (token) destroySession(token)

    const res = NextResponse.json({ success: true })
    res.cookies.set('pulsetrack-token', '', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
