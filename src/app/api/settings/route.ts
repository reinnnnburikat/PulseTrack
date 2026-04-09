import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let settings = await db.userSettings.findUnique({ where: { userId } })

    if (!settings) {
      settings = await db.userSettings.create({ data: { userId } })
    }

    return NextResponse.json({
      data: {
        user_id: settings.userId,
        active_duration: settings.activeDuration,
        rest_duration: settings.restDuration,
        intensity_mode: settings.intensityMode,
        tone: settings.tone,
        lock_in_mode: settings.lockInMode,
        cycles: settings.cycles,
        infinite_cycles: settings.infiniteCycles,
        sound_enabled: settings.soundEnabled,
        notifications_enabled: settings.notificationsEnabled,
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
    const settings = await db.userSettings.upsert({
      where: { userId },
      update: {
        activeDuration: body.active_duration ?? 25,
        restDuration: body.rest_duration ?? 5,
        intensityMode: body.intensity_mode ?? false,
        tone: body.tone ?? 'teasing',
        lockInMode: body.lock_in_mode ?? false,
        cycles: body.cycles ?? 4,
        infiniteCycles: body.infinite_cycles ?? false,
        soundEnabled: body.sound_enabled ?? true,
        notificationsEnabled: body.notifications_enabled ?? true,
      },
      create: {
        userId,
        activeDuration: body.active_duration ?? 25,
        restDuration: body.rest_duration ?? 5,
        intensityMode: body.intensity_mode ?? false,
        tone: body.tone ?? 'teasing',
        lockInMode: body.lock_in_mode ?? false,
        cycles: body.cycles ?? 4,
        infiniteCycles: body.infinite_cycles ?? false,
        soundEnabled: body.sound_enabled ?? true,
        notificationsEnabled: body.notifications_enabled ?? true,
      },
    })

    return NextResponse.json({
      data: {
        user_id: settings.userId,
        active_duration: settings.activeDuration,
        rest_duration: settings.restDuration,
        intensity_mode: settings.intensityMode,
        tone: settings.tone,
        lock_in_mode: settings.lockInMode,
        cycles: settings.cycles,
        infinite_cycles: settings.infiniteCycles,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
