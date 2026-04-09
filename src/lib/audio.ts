// ============================================================
// PulseTrack — Audio Engine (Web Audio API)
// No external files needed — generates all sounds procedurally
// ============================================================

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

type PhaseSound = 'active-start' | 'active-tick' | 'rest-start' | 'rest-tick' | 'complete' | 'warning' | 'achievement' | 'streak-break'

// Generate tones procedurally — no audio files needed
export function playSound(sound: PhaseSound) {
  try {
    const ctx = getCtx()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    switch (sound) {
      case 'active-start': {
        // Rising two-tone: energetic start
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(330, now)
        osc.frequency.linearRampToValueAtTime(523, now + 0.15)
        gain.gain.setValueAtTime(0.15, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.3)
        osc.connect(gain)
        osc.start(now)
        osc.stop(now + 0.3)
        break
      }
      case 'rest-start': {
        // Descending gentle tone
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.linearRampToValueAtTime(220, now + 0.3)
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.5)
        osc.connect(gain)
        osc.start(now)
        osc.stop(now + 0.5)
        break
      }
      case 'active-tick': {
        // Soft subtle tick
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.03, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.05)
        osc.connect(gain)
        osc.start(now)
        osc.stop(now + 0.05)
        break
      }
      case 'rest-tick': {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 660
        gain.gain.setValueAtTime(0.02, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.05)
        osc.connect(gain)
        osc.start(now)
        osc.stop(now + 0.05)
        break
      }
      case 'complete': {
        // Triumphant three-tone
        [523, 659, 784].forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          g.gain.setValueAtTime(0, now + i * 0.15)
          g.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.05)
          g.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.4)
          osc.connect(g)
          g.connect(ctx.destination)
          osc.start(now + i * 0.15)
          osc.stop(now + i * 0.15 + 0.4)
        })
        break
      }
      case 'warning': {
        // Urgent two-beat pulse
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = 'square'
          osc.frequency.value = 440
          g.gain.setValueAtTime(0.08, now + i * 0.2)
          g.gain.linearRampToValueAtTime(0, now + i * 0.2 + 0.1)
          osc.connect(g)
          g.connect(ctx.destination)
          osc.start(now + i * 0.2)
          osc.stop(now + i * 0.2 + 0.1)
        }
        break
      }
      case 'achievement': {
        // Sparkle ascending arpeggio
        [523, 659, 784, 1047].forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.value = freq
          g.gain.setValueAtTime(0.1, now + i * 0.1)
          g.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.3)
          osc.connect(g)
          g.connect(ctx.destination)
          osc.start(now + i * 0.1)
          osc.stop(now + i * 0.1 + 0.3)
        })
        break
      }
      case 'streak-break': {
        // Descending sad tone
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.linearRampToValueAtTime(220, now + 0.5)
        gain.gain.setValueAtTime(0.08, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.6)
        osc.connect(gain)
        osc.start(now)
        osc.stop(now + 0.6)
        break
      }
    }
  } catch {
    // Audio not available
  }
}

// Heartbeat ambient for intensity mode
let heartbeatInterval: ReturnType<typeof setInterval> | null = null

export function startHeartbeat(bpm: number = 60) {
  stopHeartbeat()
  const interval = 60000 / bpm
  heartbeatInterval = setInterval(() => {
    try {
      const ctx = getCtx()
      const now = ctx.currentTime
      // Double-beat heartbeat
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = i === 0 ? 50 : 55
        g.gain.setValueAtTime(0, now + i * 0.12)
        g.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.03)
        g.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.15)
        osc.connect(g)
        g.connect(ctx.destination)
        osc.start(now + i * 0.12)
        osc.stop(now + i * 0.12 + 0.15)
      }
    } catch {}
  }, interval)
}

export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}
