import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let gam = await db.gamification.findUnique({ where: { userId } })
    if (!gam) {
      gam = await db.gamification.create({ data: { userId } })
    }

    return NextResponse.json({
      data: {
        user_id: gam.userId,
        streak: gam.streak,
        longest_streak: gam.longestStreak,
        total_sessions: gam.totalSessions,
        total_time: gam.totalTime,
        level: gam.level,
        xp: gam.xp,
        last_session_date: gam.lastSessionDate,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const gam = await db.gamification.upsert({
      where: { userId },
      update: {
        streak: body.streak,
        longestStreak: body.longest_streak,
        totalSessions: body.total_sessions,
        totalTime: body.total_time,
        level: body.level,
        xp: body.xp,
        lastSessionDate: body.last_session_date,
      },
      create: {
        userId,
        streak: body.streak ?? 0,
        longestStreak: body.longest_streak ?? 0,
        totalSessions: body.total_sessions ?? 0,
        totalTime: body.total_time ?? 0,
        level: body.level ?? 1,
        xp: body.xp ?? 0,
        lastSessionDate: body.last_session_date ?? null,
      },
    })

    return NextResponse.json({ data: gam })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
