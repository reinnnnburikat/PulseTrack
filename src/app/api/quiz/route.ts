import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/auth'

export async function GET() {
  try {
    const questions = await db.quizQuestion.findMany({ orderBy: { category: 'asc' } })
    const data = questions.map(q => ({
      id: q.id,
      category: q.category,
      question: q.question,
      options: JSON.parse(q.options),
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
    const result = await db.quizResult.create({
      data: {
        userId,
        scores: JSON.stringify(body.scores),
        dominantTrait: body.dominant_trait,
        rolePreference: body.role_preference,
        kinks: JSON.stringify(body.kinks),
        compatibilityType: body.compatibility_type,
      },
    })

    return NextResponse.json({
      data: {
        id: result.id,
        user_id: result.userId,
        created_at: result.createdAt.toISOString(),
        scores: JSON.parse(result.scores),
        dominant_trait: result.dominantTrait,
        role_preference: result.rolePreference,
        kinks: JSON.parse(result.kinks),
        compatibility_type: result.compatibilityType,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
