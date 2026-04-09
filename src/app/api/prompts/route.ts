import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const url = new URL(req.url)
    const tone = url.searchParams.get('tone')
    const phase = url.searchParams.get('phase')
    const intensity = url.searchParams.get('intensity')

    let query = supabase.from('prompts').select('*')
    if (tone) query = query.eq('tone', tone)
    if (phase) query = query.eq('phase', phase)
    if (intensity) query = query.eq('intensity', parseInt(intensity))

    const { data, error } = await query.limit(20)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Return random 5
    const shuffled = [...(data || [])].sort(() => Math.random() - 0.5)
    return NextResponse.json({ data: shuffled.slice(0, 5) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
