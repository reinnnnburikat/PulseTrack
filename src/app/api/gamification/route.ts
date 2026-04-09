import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createClient()
    const token = globalThis.__gamToken || null

    const { data, error } = await supabase
      .from('gamification')
      .select('*')
      .limit(1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data?.[0] || {} })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
