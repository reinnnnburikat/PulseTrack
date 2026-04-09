import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding quiz questions...')

  const quizQuestions = [
    {
      category: 'orientation',
      question: 'When someone challenges your authority, how do you naturally react?',
      options: JSON.stringify([
        { label: 'Push back firmly — I know what I want', scores: { dominant: 3, top: 1 } },
        { label: 'Feel a spark of excitement — I enjoy the tension', scores: { switch: 3, versatile: 1 } },
        { label: 'Step back and observe — I prefer to follow', scores: { submissive: 3, bottom: 1 } },
        { label: 'Depends on who\'s challenging me', scores: { switch: 2, versatile: 2 } },
      ]),
    },
    {
      category: 'orientation',
      question: 'In a group setting, what role do you naturally fall into?',
      options: JSON.stringify([
        { label: 'The leader — I set the direction', scores: { dominant: 3, top: 1 } },
        { label: 'The mediator — I keep the peace', scores: { switch: 2, versatile: 2 } },
        { label: 'The follower — I\'m happy to go along', scores: { submissive: 3, bottom: 1 } },
        { label: 'The wildcard — I switch between roles', scores: { switch: 3, versatile: 1 } },
      ]),
    },
    {
      category: 'orientation',
      question: 'How do you feel about vulnerability?',
      options: JSON.stringify([
        { label: 'I protect my vulnerability fiercely', scores: { dominant: 2, top: 2 } },
        { label: 'I find strength in being vulnerable', scores: { submissive: 2, bottom: 2 } },
        { label: 'I embrace it fully with the right person', scores: { switch: 2, versatile: 2 } },
        { label: 'Vulnerability is intimacy to me', scores: { submissive: 1, bottom: 1, switch: 2 } },
      ]),
    },
    {
      category: 'role',
      question: 'What excites you most about physical connection?',
      options: JSON.stringify([
        { label: 'Taking charge and setting the pace', scores: { dominant: 2, top: 3 } },
        { label: 'Being guided and surrendering control', scores: { submissive: 2, bottom: 3 } },
        { label: 'Trading roles — keeping it dynamic', scores: { switch: 2, versatile: 3 } },
        { label: 'Exploring whatever feels right in the moment', scores: { switch: 1, versatile: 2, top: 1, bottom: 1 } },
      ]),
    },
    {
      category: 'role',
      question: 'If you had to choose one dynamic for the rest of your life?',
      options: JSON.stringify([
        { label: 'I lead, they follow', scores: { dominant: 3, top: 2 } },
        { label: 'They lead, I follow', scores: { submissive: 3, bottom: 2 } },
        { label: 'We take turns leading', scores: { switch: 3, versatile: 2 } },
        { label: 'No fixed roles — pure flow', scores: { versatile: 3, switch: 2 } },
      ]),
    },
    {
      category: 'role',
      question: 'How do you prefer to initiate intimacy?',
      options: JSON.stringify([
        { label: 'I make the first move — always', scores: { dominant: 2, top: 3 } },
        { label: 'I prefer subtle signals, letting them lead', scores: { submissive: 2, bottom: 3 } },
        { label: 'Depends entirely on my mood', scores: { switch: 2, versatile: 3 } },
        { label: 'I like a playful back-and-forth first', scores: { switch: 3, versatile: 1 } },
      ]),
    },
    {
      category: 'kinks',
      question: 'Which scenario sounds most appealing to you?',
      options: JSON.stringify([
        { label: 'Being restrained and at someone\'s mercy', scores: { bondage: 3, bottom: 2, submissive: 1 } },
        { label: 'Restraints on them while I\'m in control', scores: { bondage: 3, top: 2, dominant: 1 } },
        { label: 'Switching who\'s restrained throughout', scores: { bondage: 2, switch: 3, versatile: 1 } },
        { label: 'Light restraint with lots of teasing', scores: { bondage: 2, sensory: 2, switch: 1 } },
      ]),
    },
    {
      category: 'kinks',
      question: 'How do you feel about power exchange in scenes?',
      options: JSON.stringify([
        { label: 'Total control — I run the scene', scores: { power_exchange: 3, dominant: 2, top: 1 } },
        { label: 'Total surrender — they run the scene', scores: { power_exchange: 3, submissive: 2, bottom: 1 } },
        { label: 'Negotiated power exchange with clear boundaries', scores: { power_exchange: 2, switch: 2, versatile: 1 } },
        { label: 'Light D/s with aftercare emphasis', scores: { power_exchange: 2, private: 1 } },
      ]),
    },
    {
      category: 'kinks',
      question: 'Impact play — what\'s your stance?',
      options: JSON.stringify([
        { label: 'I love delivering — it\'s my art', scores: { impact: 3, dominant: 2, top: 1 } },
        { label: 'I love receiving — the sensation is everything', scores: { impact: 3, submissive: 2, bottom: 1 } },
        { label: 'Both sides excite me equally', scores: { impact: 2, switch: 3, versatile: 1 } },
        { label: 'Curious but haven\'t explored much', scores: { impact: 1, explorer: 3 } },
      ]),
    },
    {
      category: 'kinks',
      question: 'Sensory play — what draws you in?',
      options: JSON.stringify([
        { label: 'Blindfolds, temperature play, anticipation', scores: { sensory: 3, teasing: 2 } },
        { label: 'Overstimulation until they can\'t take more', scores: { overstim: 3, dominant: 1, top: 2 } },
        { label: 'Being overwhelmed with sensation', scores: { sensory: 2, overstim: 2, bottom: 1 } },
        { label: 'Feathers, ice, wax — building sensation slowly', scores: { sensory: 3, private: 1 } },
      ]),
    },
    {
      category: 'compatibility',
      question: 'What matters most in a compatible partner?',
      options: JSON.stringify([
        { label: 'Trust and emotional safety above all', scores: { private: 2, sensible: 2, personality_first: 2 } },
        { label: 'Sexual chemistry and physical attraction', scores: { exhibitionist: 2, intensity: 2 } },
        { label: 'Open communication and shared curiosity', scores: { explorer: 2, personality_first: 2, switch: 1 } },
        { label: 'A balance of all — mind, body, and soul', scores: { personality_first: 2, explorer: 1, private: 1 } },
      ]),
    },
    {
      category: 'compatibility',
      question: 'How private are you about your desires?',
      options: JSON.stringify([
        { label: 'Very private — only with someone I deeply trust', scores: { private: 3, sensible: 1 } },
        { label: 'Open with the right person — selective sharing', scores: { private: 2, sensible: 2 } },
        { label: 'I enjoy being somewhat open about exploration', scores: { exhibitionist: 2, explorer: 2 } },
        { label: 'I don\'t mind sharing — it\'s natural', scores: { exhibitionist: 2, personality_first: 1 } },
      ]),
    },
    {
      category: 'compatibility',
      question: 'What\'s your ideal scene length?',
      options: JSON.stringify([
        { label: 'Quick and intense — 15-30 minutes', scores: { intensity: 3, top: 1 } },
        { label: 'Extended sessions — 1-2 hours of buildup', scores: { sensory: 2, teasing: 2, overstim: 1 } },
        { label: 'Marathon sessions — hours of exploration', scores: { explorer: 2, overstim: 2 } },
        { label: 'No fixed time — we go until it feels complete', scores: { private: 1, personality_first: 2, sensible: 1 } },
      ]),
    },
  ]

  for (const q of quizQuestions) {
    await prisma.quizQuestion.upsert({
      where: { id: `qq_${q.category}_${q.question.slice(0, 20)}` },
      update: {},
      create: { id: `qq_${q.category}_${q.question.slice(0, 20)}`, ...q },
    })
  }
  console.log(`Seeded ${quizQuestions.length} quiz questions`)

  console.log('Seeding prompts...')

  const prompts = [
    // Dominant tone, active phase
    { tone: 'dominant', phase: 'active', intensity: 1, content: 'Focus on the task at hand. Your discipline defines you.' },
    { tone: 'dominant', phase: 'active', intensity: 1, content: 'Stay in position. You chose this. Now prove it.' },
    { tone: 'dominant', phase: 'active', intensity: 2, content: 'That\'s it. Don\'t you dare look away from what matters.' },
    { tone: 'dominant', phase: 'active', intensity: 2, content: 'Every second counts. Make each one count more.' },
    { tone: 'dominant', phase: 'active', intensity: 3, content: 'You\'re doing well. But "well" isn\'t enough for me.' },
    { tone: 'dominant', phase: 'active', intensity: 3, content: 'The intensity is rising. Can you handle what comes next?' },
    { tone: 'dominant', phase: 'active', intensity: 4, content: 'Good. Now push harder. I know you have more to give.' },
    { tone: 'dominant', phase: 'active', intensity: 4, content: 'You\'re trembling. That means you\'re right where I want you.' },
    { tone: 'dominant', phase: 'active', intensity: 5, content: 'Surrender to the process. There\'s no turning back now.' },
    { tone: 'dominant', phase: 'active', intensity: 5, content: 'Maximum intensity. This is where legends are forged.' },
    // Dominant tone, rest phase
    { tone: 'dominant', phase: 'rest', intensity: 1, content: 'You\'ve earned a moment. Don\'t waste it.' },
    { tone: 'dominant', phase: 'rest', intensity: 2, content: 'Rest now. The next round won\'t be as forgiving.' },
    { tone: 'dominant', phase: 'rest', intensity: 3, content: 'Breathe. Recover. The best is yet to come.' },
    { tone: 'dominant', phase: 'rest', intensity: 4, content: 'Take your breath while you can. It\'s about to get intense.' },
    { tone: 'dominant', phase: 'rest', intensity: 5, content: 'Rest is overrated. But you\'ve earned it — for now.' },
    // Teasing tone, active phase
    { tone: 'teasing', phase: 'active', intensity: 1, content: 'Starting slow... but we both know where this is going.' },
    { tone: 'teasing', phase: 'active', intensity: 1, content: 'One step at a time. No rush. Or is there?' },
    { tone: 'teasing', phase: 'active', intensity: 2, content: 'Getting warmer... I can see it in your focus.' },
    { tone: 'teasing', phase: 'active', intensity: 2, content: 'You think you can handle more? Let\'s find out.' },
    { tone: 'teasing', phase: 'active', intensity: 3, content: 'The real challenge hasn\'t even started yet...' },
    { tone: 'teasing', phase: 'active', intensity: 3, content: 'Oh, you\'re still going? Good. I was hoping you\'d say that.' },
    { tone: 'teasing', phase: 'active', intensity: 4, content: 'Getting close to the edge... are you paying attention?' },
    { tone: 'teasing', phase: 'active', intensity: 4, content: 'Don\'t get too comfortable. The intensity is about to shift.' },
    { tone: 'teasing', phase: 'active', intensity: 5, content: 'You asked for this. Now take every second of it.' },
    { tone: 'teasing', phase: 'active', intensity: 5, content: 'Peek intensity. Hold on tight — this is the ride.' },
    // Teasing tone, rest phase
    { tone: 'teasing', phase: 'rest', intensity: 1, content: 'A little break. Don\'t get too comfortable...' },
    { tone: 'teasing', phase: 'rest', intensity: 2, content: 'Catch your breath. The teasing is just getting started.' },
    { tone: 'teasing', phase: 'rest', intensity: 3, content: 'Rest? Sure. If that\'s what you want to call it...' },
    { tone: 'teasing', phase: 'rest', intensity: 4, content: 'You think rest is safe? The mind plays tricks here.' },
    { tone: 'teasing', phase: 'rest', intensity: 5, content: 'Enjoy this pause. It\'s the calm before the storm.' },
    // Hypnotic tone, active phase
    { tone: 'hypnotic', phase: 'active', intensity: 1, content: 'Breathe in... breathe out... let the rhythm take you.' },
    { tone: 'hypnotic', phase: 'active', intensity: 1, content: 'Feel the pulse. Let it guide your focus deeper.' },
    { tone: 'hypnotic', phase: 'active', intensity: 2, content: 'Deeper now. The world outside is fading away.' },
    { tone: 'hypnotic', phase: 'active', intensity: 2, content: 'Every breath draws you further into the zone.' },
    { tone: 'hypnotic', phase: 'active', intensity: 3, content: 'You\'re drifting now. Let go of everything else.' },
    { tone: 'hypnotic', phase: 'active', intensity: 3, content: 'The rhythm is everything. There is only the rhythm.' },
    { tone: 'hypnotic', phase: 'active', intensity: 4, content: 'Sinking deeper. Nothing else exists right now.' },
    { tone: 'hypnotic', phase: 'active', intensity: 4, content: 'You\'re almost there. Let the wave carry you.' },
    { tone: 'hypnotic', phase: 'active', intensity: 5, content: 'Total immersion. You are the pulse now.' },
    { tone: 'hypnotic', phase: 'active', intensity: 5, content: 'The edge of consciousness. Pure focus. Pure flow.' },
    // Hypnotic tone, rest phase
    { tone: 'hypnotic', phase: 'rest', intensity: 1, content: 'Let your mind settle... like ripples on still water.' },
    { tone: 'hypnotic', phase: 'rest', intensity: 2, content: 'Drift for a moment. The rhythm continues within.' },
    { tone: 'hypnotic', phase: 'rest', intensity: 3, content: 'Float between cycles. The depth awaits your return.' },
    { tone: 'hypnotic', phase: 'rest', intensity: 4, content: 'Brief surface... breathe... the deep calls you back.' },
    { tone: 'hypnotic', phase: 'rest', intensity: 5, content: 'The trance holds even in rest. You\'re never truly free.' },
  ]

  for (const p of prompts) {
    await prisma.prompt.create({ data: p })
  }
  console.log(`Seeded ${prompts.length} prompts`)

  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
