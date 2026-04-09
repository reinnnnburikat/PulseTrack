import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const roleFilter = url.searchParams.get('role')
    const traitFilter = url.searchParams.get('trait')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const search = url.searchParams.get('search')

    // Find users with quiz results (excluding current user)
    const quizResults = await db.quizResult.findMany({
      where: {
        userId: { not: userId },
        ...(roleFilter ? { rolePreference: roleFilter } : {}),
        ...(traitFilter ? { dominantTrait: traitFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      distinct: ['userId'],
    })

    const data = await Promise.all(quizResults.map(async (qr) => {
      const user = await db.user.findUnique({
        where: { id: qr.userId },
        select: { id: true, displayName: true, avatarUrl: true, createdAt: true },
      })
      if (!user) return null

      // Get gamification for level info
      const gam = await db.gamification.findUnique({ where: { userId: qr.userId } })

      return {
        user_id: user.id,
        display_name: user.displayName || 'Anonymous',
        avatar_url: user.avatarUrl,
        member_since: user.createdAt.toISOString(),
        level: gam?.level || 1,
        total_sessions: gam?.totalSessions || 0,
        quiz: {
          dominant_trait: qr.dominantTrait,
          role_preference: qr.rolePreference,
          kinks: JSON.parse(qr.kinks),
          completed_at: qr.createdAt.toISOString(),
        },
      }
    }))

    return NextResponse.json({ data: data.filter(Boolean) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
