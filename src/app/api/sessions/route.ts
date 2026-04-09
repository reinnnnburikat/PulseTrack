import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const where: Record<string, any> = { userId }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59')
    }

    const sessions = await db.session.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    })

    // Transform to match expected shape
    const data = sessions.map(s => ({
      id: s.id,
      user_id: s.userId,
      created_at: s.createdAt.toISOString(),
      duration: s.duration,
      intensity: s.intensity,
      profile: s.profileId,
      mood: s.mood,
      notes: s.notes,
      updated_at: s.updatedAt.toISOString(),
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
    const session = await db.session.create({
      data: {
        userId,
        duration: body.duration || 0,
        intensity: body.intensity || 3,
        profileId: body.profile || null,
        mood: body.mood || null,
        notes: body.notes || null,
      },
    })

    return NextResponse.json({
      data: {
        id: session.id,
        user_id: session.userId,
        created_at: session.createdAt.toISOString(),
        duration: session.duration,
        intensity: session.intensity,
        profile: session.profileId,
        mood: session.mood,
        notes: session.notes,
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
    const session = await db.session.updateMany({
      where: { id: body.id, userId },
      data: {
        duration: body.duration,
        intensity: body.intensity,
        profileId: body.profile,
        notes: body.notes,
      },
    })

    return NextResponse.json({ data: { updated: session.count } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await db.session.deleteMany({ where: { id, userId } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
