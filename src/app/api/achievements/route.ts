import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const achievements = await db.achievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'desc' },
    })

    const data = achievements.map(a => ({
      id: a.id,
      user_id: a.userId,
      achievement_key: a.achievementKey,
      name: a.name,
      description: a.description,
      icon: a.icon,
      unlocked_at: a.unlockedAt,
    }))

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const achievement = await db.achievement.upsert({
      where: {
        userId_achievementKey: {
          userId,
          achievementKey: body.achievement_key,
        },
      },
      update: {},
      create: {
        userId,
        achievementKey: body.achievement_key,
        name: body.name,
        description: body.description,
        icon: body.icon,
        unlockedAt: body.unlocked_at || new Date().toISOString(),
      },
    })

    return NextResponse.json({ data: achievement })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
