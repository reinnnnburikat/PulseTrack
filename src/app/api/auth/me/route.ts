import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, avatarUrl: true, createdAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
