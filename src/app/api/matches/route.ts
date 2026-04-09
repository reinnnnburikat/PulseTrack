import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/auth'

// Compatibility score algorithm
function calculateCompatibility(
  scoresA: Record<string, number>,
  scoresB: Record<string, number>
): { score: number; details: Record<string, any> } {
  const allKeys = new Set([...Object.keys(scoresA), ...Object.keys(scoresB)])
  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0
  const dimensionScores: Record<string, { a: number; b: number; match: number }> = {}

  const roleKeys = ['dominant', 'submissive', 'switch', 'top', 'bottom', 'versatile']
  const kinkKeys = Array.from(allKeys).filter(
    k => !roleKeys.includes(k) && !['teasing', 'sensible', 'explorer', 'observer', 'private', 'personality_first', 'intensity', 'exhibitionist'].includes(k)
  )

  // Role compatibility (complementary = higher score)
  let roleScore = 0
  const aTopRole = roleKeys.reduce((a, b) => (scoresA[a] || 0) >= (scoresA[b] || 0) ? a : b)
  const bTopRole = roleKeys.reduce((a, b) => (scoresB[a] || 0) >= (scoresB[b] || 0) ? a : b)

  const complementary = {
    dominant: 'submissive', submissive: 'dominant', top: 'bottom', bottom: 'top',
  }
  const sameRole = ['switch', 'versatile']

  if (complementary[aTopRole] === bTopRole || complementary[bTopRole] === aTopRole) {
    roleScore = 95
  } else if (sameRole.includes(aTopRole) && sameRole.includes(bTopRole)) {
    roleScore = 85
  } else if (aTopRole === bTopRole) {
    roleScore = 70
  } else {
    roleScore = 60
  }

  // Kink overlap (cosine similarity)
  for (const key of kinkKeys) {
    const a = scoresA[key] || 0
    const b = scoresB[key] || 0
    dimensionScores[key] = { a, b, match: Math.min(a, b) }
    dotProduct += a * b
    magnitudeA += a * a
    magnitudeB += b * b
  }

  const kinkScore = magnitudeA > 0 && magnitudeB > 0
    ? Math.round((dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))) * 100)
    : 0

  // Weighted final score
  const finalScore = Math.round(roleScore * 0.4 + kinkScore * 0.6)

  return {
    score: finalScore,
    details: {
      roleScore,
      kinkScore,
      aTopRole,
      bTopRole,
      dimensions: dimensionScores,
    },
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const matches = await db.userMatch.findMany({
      where: { userId },
      include: {
        matched: {
          select: { id: true, email: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { compatibilityScore: 'desc' },
    })

    // Get matched users' latest quiz results
    const data = await Promise.all(matches.map(async (match) => {
      const quizResult = await db.quizResult.findFirst({
        where: { userId: match.matchedUserId },
        orderBy: { createdAt: 'desc' },
      })

      return {
        id: match.id,
        matched_user: {
          id: match.matched.id,
          display_name: match.matched.displayName,
          avatar_url: match.matched.avatarUrl,
        },
        compatibility_score: match.compatibilityScore,
        match_details: JSON.parse(match.matchDetails),
        matched_quiz: quizResult ? {
          dominant_trait: quizResult.dominantTrait,
          role_preference: quizResult.rolePreference,
          kinks: JSON.parse(quizResult.kinks),
        } : null,
        created_at: match.createdAt.toISOString(),
      }
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

    const { targetUserId } = await req.json()
    if (!targetUserId || targetUserId === userId) {
      return NextResponse.json({ error: 'Invalid target user' }, { status: 400 })
    }

    // Get both users' latest quiz results
    const [myQuiz, theirQuiz] = await Promise.all([
      db.quizResult.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      db.quizResult.findFirst({ where: { userId: targetUserId }, orderBy: { createdAt: 'desc' } }),
    ])

    if (!myQuiz || !theirQuiz) {
      return NextResponse.json({ error: 'Both users need quiz results' }, { status: 400 })
    }

    const myScores = JSON.parse(myQuiz.scores)
    const theirScores = JSON.parse(theirQuiz.scores)

    const { score, details } = calculateCompatibility(myScores, theirScores)

    // Upsert match
    const match = await db.userMatch.upsert({
      where: {
        userId_matchedUserId: { userId, matchedUserId: targetUserId },
      },
      update: { compatibilityScore: score, matchDetails: JSON.stringify(details) },
      create: {
        userId,
        matchedUserId: targetUserId,
        compatibilityScore: score,
        matchDetails: JSON.stringify(details),
      },
    })

    return NextResponse.json({
      data: {
        id: match.id,
        compatibility_score: match.compatibilityScore,
        match_details: details,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
