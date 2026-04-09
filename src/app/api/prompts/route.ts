import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const tone = url.searchParams.get('tone')
    const phase = url.searchParams.get('phase')
    const intensity = url.searchParams.get('intensity')

    const where: Record<string, any> = {}
    if (tone) where.tone = tone
    if (phase) where.phase = phase
    if (intensity) where.intensity = parseInt(intensity)

    const prompts = await db.prompt.findMany({
      where,
      take: 20,
    })

    // Return random 5
    const shuffled = [...prompts].sort(() => Math.random() - 0.5)
    const data = shuffled.slice(0, 5).map(p => ({
      id: p.id,
      tone: p.tone,
      phase: p.phase,
      intensity: p.intensity,
      content: p.content,
    }))

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
