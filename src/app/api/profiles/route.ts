import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profiles = await db.sessionProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const data = profiles.map(p => ({
      id: p.id,
      user_id: p.userId,
      name: p.name,
      active_duration: p.activeDuration,
      rest_duration: p.restDuration,
      cycles: p.cycles,
      infinite_cycles: p.infiniteCycles,
      tone: p.tone,
      intensity_mode: p.intensityMode,
      created_at: p.createdAt.toISOString(),
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
    const profile = await db.sessionProfile.create({
      data: {
        userId,
        name: body.name,
        activeDuration: body.active_duration,
        restDuration: body.rest_duration,
        cycles: body.cycles,
        infiniteCycles: body.infinite_cycles,
        tone: body.tone,
        intensityMode: body.intensity_mode,
      },
    })

    return NextResponse.json({
      data: {
        id: profile.id,
        user_id: profile.userId,
        name: profile.name,
        active_duration: profile.activeDuration,
        rest_duration: profile.restDuration,
        cycles: profile.cycles,
        infinite_cycles: profile.infiniteCycles,
        tone: profile.tone,
        intensity_mode: profile.intensityMode,
        created_at: profile.createdAt.toISOString(),
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
    const profile = await db.sessionProfile.updateMany({
      where: { id: body.id, userId },
      data: {
        name: body.name,
        activeDuration: body.active_duration,
        restDuration: body.rest_duration,
        cycles: body.cycles,
        infiniteCycles: body.infinite_cycles,
        tone: body.tone,
        intensityMode: body.intensity_mode,
      },
    })

    return NextResponse.json({ data: { updated: profile.count } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    await db.sessionProfile.deleteMany({ where: { id: body.id, userId } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
