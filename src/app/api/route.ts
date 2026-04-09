import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    name: 'PulseTrack API',
    version: '2.0.0',
    status: 'healthy',
  })
}
