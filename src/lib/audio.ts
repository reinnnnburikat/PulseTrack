// ============================================================
// PulseTrack — Enhanced Audio Engine (Web Audio API)
// No external files needed — generates all sounds procedurally
// Supports: phase sounds, ambient soundscapes, breathing guide,
//           level-up fanfare, volume control, intensity modulation
// ============================================================

// ---- Core State ----

let audioCtx: AudioContext | null = null
let masterGainNode: GainNode | null = null
let ambientGainNode: GainNode | null = null
let noiseBufferCache: AudioBuffer | null = null

let masterVolume = 0.8
let ambientVolume = 0.3

// ---- Audio Context & Gain Management ----

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
    masterGainNode = audioCtx.createGain()
    masterGainNode.gain.value = masterVolume
    masterGainNode.connect(audioCtx.destination)

    ambientGainNode = audioCtx.createGain()
    ambientGainNode.gain.value = ambientVolume
    ambientGainNode.connect(masterGainNode)
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

function getMasterGain(): GainNode {
  getCtx()
  return masterGainNode!
}

function getAmbientGain(): GainNode {
  getCtx()
  return ambientGainNode!
}

// ---- Noise Buffer Utility ----

function createNoiseBuffer(ctx: AudioContext, duration: number = 2): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBufferCache || noiseBufferCache.sampleRate !== ctx.sampleRate) {
    noiseBufferCache = createNoiseBuffer(ctx)
  }
  return noiseBufferCache
}

// ============================================================
// VOLUME CONTROL
// ============================================================

/** Set master volume for all audio (0.0 – 1.0) */
export function setMasterVolume(v: number) {
  masterVolume = Math.max(0, Math.min(1, v))
  if (masterGainNode) {
    masterGainNode.gain.setValueAtTime(masterVolume, getCtx().currentTime)
  }
}

/** Set ambient/continuous sound volume separately (0.0 – 1.0) */
export function setAmbientVolume(v: number) {
  ambientVolume = Math.max(0, Math.min(1, v))
  if (ambientGainNode) {
    ambientGainNode.gain.setValueAtTime(ambientVolume, getCtx().currentTime)
  }
}

// ============================================================
// PHASE SOUNDS (existing + new types)
// ============================================================

type PhaseSound =
  | 'active-start' | 'active-tick' | 'rest-start' | 'rest-tick'
  | 'complete' | 'warning' | 'achievement' | 'streak-break'
  | 'level-up' | 'breathing-inhale' | 'breathing-exhale'

/** Play a one-shot phase sound. Routes through master volume. */
export function playSound(sound: PhaseSound) {
  try {
    const ctx = getCtx()
    const dest = getMasterGain()
    const now = ctx.currentTime

    switch (sound) {
      case 'active-start': {
        // Rising two-tone: energetic start
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(330, now)
        osc.frequency.linearRampToValueAtTime(523, now + 0.15)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.15, now)
        g.gain.linearRampToValueAtTime(0, now + 0.3)
        osc.connect(g)
        g.connect(dest)
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
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.12, now)
        g.gain.linearRampToValueAtTime(0, now + 0.5)
        osc.connect(g)
        g.connect(dest)
        osc.start(now)
        osc.stop(now + 0.5)
        break
      }
      case 'active-tick': {
        // Soft subtle tick
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 880
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.03, now)
        g.gain.linearRampToValueAtTime(0, now + 0.05)
        osc.connect(g)
        g.connect(dest)
        osc.start(now)
        osc.stop(now + 0.05)
        break
      }
      case 'rest-tick': {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 660
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.02, now)
        g.gain.linearRampToValueAtTime(0, now + 0.05)
        osc.connect(g)
        g.connect(dest)
        osc.start(now)
        osc.stop(now + 0.05)
        break
      }
      case 'complete': {
        // Triumphant three-tone
        const freqs = [523, 659, 784]
        for (let i = 0; i < freqs.length; i++) {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freqs[i]
          g.gain.setValueAtTime(0, now + i * 0.15)
          g.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.05)
          g.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.4)
          osc.connect(g)
          g.connect(dest)
          osc.start(now + i * 0.15)
          osc.stop(now + i * 0.15 + 0.4)
        }
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
          g.connect(dest)
          osc.start(now + i * 0.2)
          osc.stop(now + i * 0.2 + 0.1)
        }
        break
      }
      case 'achievement': {
        // Sparkle ascending arpeggio
        const freqs = [523, 659, 784, 1047]
        for (let i = 0; i < freqs.length; i++) {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.value = freqs[i]
          g.gain.setValueAtTime(0.1, now + i * 0.1)
          g.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.3)
          osc.connect(g)
          g.connect(dest)
          osc.start(now + i * 0.1)
          osc.stop(now + i * 0.1 + 0.3)
        }
        break
      }
      case 'streak-break': {
        // Descending sad tone
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.linearRampToValueAtTime(220, now + 0.5)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.08, now)
        g.gain.linearRampToValueAtTime(0, now + 0.6)
        osc.connect(g)
        g.connect(dest)
        osc.start(now)
        osc.stop(now + 0.6)
        break
      }
      case 'level-up': {
        // Default level-up calls playLevelUp(1)
        playLevelUp(1)
        break
      }
      case 'breathing-inhale': {
        // Gentle rising tone — soft sine sweep upward
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(200, now)
        osc.frequency.linearRampToValueAtTime(350, now + 1.5)
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(0.08, now + 0.3)
        g.gain.setValueAtTime(0.08, now + 1.2)
        g.gain.linearRampToValueAtTime(0, now + 1.5)
        osc.connect(g)
        g.connect(dest)
        osc.start(now)
        osc.stop(now + 1.6)
        break
      }
      case 'breathing-exhale': {
        // Gentle falling tone — soft sine sweep downward
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(350, now)
        osc.frequency.linearRampToValueAtTime(200, now + 2.0)
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(0.08, now + 0.3)
        g.gain.setValueAtTime(0.08, now + 1.5)
        g.gain.linearRampToValueAtTime(0, now + 2.0)
        osc.connect(g)
        g.connect(dest)
        osc.start(now)
        osc.stop(now + 2.1)
        break
      }
    }
  } catch {
    // Audio not available
  }
}

// ============================================================
// LEVEL-UP FANFARE
// ============================================================

/**
 * Play a triumphant ascending arpeggio that gets higher with each level.
 * Level 1: C5 arpeggio, each additional level shifts up by a whole step.
 * Higher levels add more notes and a shimmer effect.
 */
export function playLevelUp(level: number) {
  try {
    const ctx = getCtx()
    const dest = getMasterGain()
    const now = ctx.currentTime

    // Base frequency — each level shifts up a whole step (2 semitones)
    const base = 523 * Math.pow(2, ((level - 1) * 2) / 12)
    // Major arpeggio intervals: root, major third, perfect fifth, octave
    const ratios = [1, 5 / 4, 3 / 2, 2]

    // Higher levels can add extra notes (up to 7 total)
    const extendedRatios = [1, 5 / 4, 3 / 2, 15 / 8, 2, 5 / 2, 3]
    const noteCount = Math.min(4 + Math.floor(level / 3), extendedRatios.length)
    const noteGap = 0.09 // ms between notes — tighter at higher levels

    for (let i = 0; i < noteCount; i++) {
      const freq = base * extendedRatios[i]
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = i === noteCount - 1 ? 'sine' : 'triangle'
      osc.frequency.value = freq

      const startT = now + i * noteGap
      const sustain = 0.15 + (level > 3 ? 0.1 : 0)

      g.gain.setValueAtTime(0, startT)
      g.gain.linearRampToValueAtTime(0.12, startT + 0.03)
      g.gain.setValueAtTime(0.12, startT + sustain)
      g.gain.linearRampToValueAtTime(0, startT + sustain + 0.35)

      osc.connect(g)
      g.connect(dest)
      osc.start(startT)
      osc.stop(startT + sustain + 0.36)
    }

    // At level 5+, add a high shimmer note
    if (level >= 5) {
      const shimmer = ctx.createOscillator()
      const sg = ctx.createGain()
      shimmer.type = 'sine'
      shimmer.frequency.value = base * 4 // Two octaves above root
      const shimmerStart = now + noteCount * noteGap
      sg.gain.setValueAtTime(0, shimmerStart)
      sg.gain.linearRampToValueAtTime(0.05, shimmerStart + 0.1)
      sg.gain.linearRampToValueAtTime(0, shimmerStart + 0.7)
      shimmer.connect(sg)
      sg.connect(dest)
      shimmer.start(shimmerStart)
      shimmer.stop(shimmerStart + 0.71)
    }
  } catch {
    // Audio not available
  }
}

// ============================================================
// HEARTBEAT (existing — updated to route through masterGain)
// ============================================================

let heartbeatInterval: ReturnType<typeof setInterval> | null = null

/** Start a continuous heartbeat ambient for intensity mode */
export function startHeartbeat(bpm: number = 60) {
  stopHeartbeat()
  const interval = 60000 / bpm
  heartbeatInterval = setInterval(() => {
    try {
      const ctx = getCtx()
      const dest = getMasterGain()
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
        g.connect(dest)
        osc.start(now + i * 0.12)
        osc.stop(now + i * 0.12 + 0.16)
      }
    } catch {
      // Audio not available
    }
  }, interval)
}

/** Stop the heartbeat ambient */
export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}

// ============================================================
// AMBIENT SOUNDSCAPE SYSTEM
// ============================================================

type AmbientTone = 'dominant' | 'hypnotic' | 'teasing'

interface AmbientState {
  active: boolean
  tone: AmbientTone | null
  intensity: number
  // Node tracking for cleanup
  oscillators: OscillatorNode[]
  gains: GainNode[]
  sources: AudioBufferSourceNode[]
  filters: BiquadFilterNode[]
  intervals: ReturnType<typeof setInterval>[]
  timeouts: ReturnType<typeof setTimeout>[]
  // Modulatable references
  lfoOsc: OscillatorNode | null
  lfoDepth: GainNode | null
  bassGain: GainNode | null
  rumbleGain: GainNode | null
  rumbleFilter: BiquadFilterNode | null
  binauralGain: GainNode | null
  padOsc: OscillatorNode | null
  padFilter: BiquadFilterNode | null
  padGain: GainNode | null
  pulseLfo: OscillatorNode | null
  pulseDepth: GainNode | null
  baseGain: GainNode | null
}

const ambientState: AmbientState = {
  active: false,
  tone: null,
  intensity: 3,
  oscillators: [],
  gains: [],
  sources: [],
  filters: [],
  intervals: [],
  timeouts: [],
  lfoOsc: null,
  lfoDepth: null,
  bassGain: null,
  rumbleGain: null,
  rumbleFilter: null,
  binauralGain: null,
  padOsc: null,
  padFilter: null,
  padGain: null,
  pulseLfo: null,
  pulseDepth: null,
  baseGain: null,
}

function resetAmbientState() {
  ambientState.oscillators = []
  ambientState.gains = []
  ambientState.sources = []
  ambientState.filters = []
  ambientState.intervals = []
  ambientState.timeouts = []
  ambientState.lfoOsc = null
  ambientState.lfoDepth = null
  ambientState.bassGain = null
  ambientState.rumbleGain = null
  ambientState.rumbleFilter = null
  ambientState.binauralGain = null
  ambientState.padOsc = null
  ambientState.padFilter = null
  ambientState.padGain = null
  ambientState.pulseLfo = null
  ambientState.pulseDepth = null
  ambientState.baseGain = null
}

/** Stop all ambient sounds and clean up resources */
export function stopAmbient() {
  ambientState.active = false
  const ctx = audioCtx // may be null, that's fine

  // Stop oscillators
  for (const osc of ambientState.oscillators) {
    try { osc.stop() } catch { /* already stopped */ }
    try { osc.disconnect() } catch { /* already disconnected */ }
  }

  // Stop buffer sources
  for (const src of ambientState.sources) {
    try { src.stop() } catch { /* already stopped */ }
    try { src.disconnect() } catch { /* already disconnected */ }
  }

  // Disconnect gains and filters
  for (const g of ambientState.gains) {
    try { g.disconnect() } catch { /* */ }
  }
  for (const f of ambientState.filters) {
    try { f.disconnect() } catch { /* */ }
  }

  // Clear intervals and timeouts
  for (const id of ambientState.intervals) clearInterval(id)
  for (const id of ambientState.timeouts) clearTimeout(id)

  resetAmbientState()
}

/**
 * Start a continuous ambient soundscape.
 *
 * - `dominant`: Deep bass drones with low rumble (~40Hz + slow LFO)
 * - `hypnotic`: Binaural beats (~10Hz difference) with soft pad
 * - `teasing`: Soft rhythmic pulses with gentle chime overlay
 */
export function startAmbient(tone: AmbientTone) {
  // Clean up any running ambient first
  stopAmbient()

  const ctx = getCtx()
  const dest = getAmbientGain()
  const noise = getNoiseBuffer(ctx)
  const intensity = ambientState.intensity

  ambientState.active = true
  ambientState.tone = tone

  switch (tone) {
    case 'dominant':
      buildDominantAmbient(ctx, dest, noise, intensity)
      break
    case 'hypnotic':
      buildHypnoticAmbient(ctx, dest, noise, intensity)
      break
    case 'teasing':
      buildTeasingAmbient(ctx, dest, noise, intensity)
      break
  }
}

// ---- Dominant: Deep bass drones with low rumble ----

function buildDominantAmbient(
  ctx: AudioContext,
  dest: GainNode,
  noise: AudioBuffer,
  intensity: number,
) {
  const now = ctx.currentTime

  // --- Bass drone (sine ~40Hz with LFO modulation) ---
  const bassOsc = ctx.createOscillator()
  bassOsc.type = 'sine'
  bassOsc.frequency.value = 40
  ambientState.oscillators.push(bassOsc)

  const bassGain = ctx.createGain()
  bassGain.gain.value = 0.15
  ambientState.gains.push(bassGain)
  ambientState.bassGain = bassGain

  // LFO modulates bass volume — slow cycle
  const lfoFreq = 0.1 + intensity * 0.08 // 0.18 – 0.50 Hz
  const lfoOsc = ctx.createOscillator()
  lfoOsc.type = 'sine'
  lfoOsc.frequency.value = lfoFreq
  ambientState.oscillators.push(lfoOsc)
  ambientState.lfoOsc = lfoOsc

  const lfoDepth = ctx.createGain()
  lfoDepth.gain.value = 0.08 + intensity * 0.02 // modulation depth
  ambientState.gains.push(lfoDepth)
  ambientState.lfoDepth = lfoDepth

  lfoOsc.connect(lfoDepth)
  lfoDepth.connect(bassGain.gain)

  bassOsc.connect(bassGain)
  bassGain.connect(dest)

  // --- Sub-harmonic layer (even lower, adds weight) ---
  if (intensity >= 3) {
    const subOsc = ctx.createOscillator()
    subOsc.type = 'sine'
    subOsc.frequency.value = 28
    const subGain = ctx.createGain()
    subGain.gain.value = 0.06 + (intensity - 3) * 0.02
    subOsc.connect(subGain)
    subGain.connect(dest)
    ambientState.oscillators.push(subOsc)
    ambientState.gains.push(subGain)
  }

  // --- Low rumble via filtered noise ---
  const rumbleSrc = ctx.createBufferSource()
  rumbleSrc.buffer = noise
  rumbleSrc.loop = true
  ambientState.sources.push(rumbleSrc)

  const rumbleFilter = ctx.createBiquadFilter()
  rumbleFilter.type = 'lowpass'
  rumbleFilter.frequency.value = 80 + intensity * 15
  rumbleFilter.Q.value = 1.0
  ambientState.filters.push(rumbleFilter)
  ambientState.rumbleFilter = rumbleFilter

  const rumbleGain = ctx.createGain()
  rumbleGain.gain.value = 0.04 + intensity * 0.015
  // Fade in
  rumbleGain.gain.setValueAtTime(0, now)
  rumbleGain.gain.linearRampToValueAtTime(rumbleGain.gain.value, now + 2)
  ambientState.gains.push(rumbleGain)
  ambientState.rumbleGain = rumbleGain

  rumbleSrc.connect(rumbleFilter)
  rumbleFilter.connect(rumbleGain)
  rumbleGain.connect(dest)

  // Start everything
  bassOsc.start(now)
  lfoOsc.start(now)
  rumbleSrc.start(now)
}

// ---- Hypnotic: Binaural beats with soft pad ----

function buildHypnoticAmbient(
  ctx: AudioContext,
  dest: GainNode,
  _noise: AudioBuffer,
  intensity: number,
) {
  const now = ctx.currentTime

  // --- Binaural beats ---
  // Two oscillators separated by ~10Hz produce alpha wave effect
  const baseFreq = 180
  const diff = 8 + intensity * 1.0 // 9 – 13 Hz (alpha / low-beta range)

  const oscL = ctx.createOscillator()
  oscL.type = 'sine'
  oscL.frequency.value = baseFreq
  ambientState.oscillators.push(oscL)

  const oscR = ctx.createOscillator()
  oscR.type = 'sine'
  oscR.frequency.value = baseFreq + diff
  ambientState.oscillators.push(oscR)

  const binauralGain = ctx.createGain()
  binauralGain.gain.setValueAtTime(0, now)
  binauralGain.gain.linearRampToValueAtTime(0.07 + intensity * 0.01, now + 3)
  ambientState.gains.push(binauralGain)
  ambientState.binauralGain = binauralGain

  oscL.connect(binauralGain)
  oscR.connect(binauralGain)
  binauralGain.connect(dest)

  // --- Soft pad (triangle wave, low-passed) ---
  const padOsc = ctx.createOscillator()
  padOsc.type = 'triangle'
  padOsc.frequency.value = baseFreq / 2 // Sub-octave pad
  ambientState.oscillators.push(padOsc)
  ambientState.padOsc = padOsc

  const padFilter = ctx.createBiquadFilter()
  padFilter.type = 'lowpass'
  padFilter.frequency.value = 300 + intensity * 50
  padFilter.Q.value = 0.7
  ambientState.filters.push(padFilter)
  ambientState.padFilter = padFilter

  const padGain = ctx.createGain()
  padGain.gain.setValueAtTime(0, now)
  padGain.gain.linearRampToValueAtTime(0.04 + intensity * 0.01, now + 3)
  ambientState.gains.push(padGain)
  ambientState.padGain = padGain

  // Slow LFO on pad filter cutoff for movement
  const padLfo = ctx.createOscillator()
  padLfo.type = 'sine'
  padLfo.frequency.value = 0.05 + intensity * 0.03
  const padLfoGain = ctx.createGain()
  padLfoGain.gain.value = 80 + intensity * 20
  padLfo.connect(padLfoGain)
  padLfoGain.connect(padFilter.frequency)
  ambientState.oscillators.push(padLfo)
  ambientState.gains.push(padLfoGain)

  padOsc.connect(padFilter)
  padFilter.connect(padGain)
  padGain.connect(dest)

  // Start everything
  oscL.start(now)
  oscR.start(now)
  padOsc.start(now)
  padLfo.start(now)
}

// ---- Teasing: Soft rhythmic pulses with chime overlay ----

function buildTeasingAmbient(
  ctx: AudioContext,
  dest: GainNode,
  _noise: AudioBuffer,
  intensity: number,
) {
  const now = ctx.currentTime

  // --- Base tone with rhythmic pulse ---
  const baseOsc = ctx.createOscillator()
  baseOsc.type = 'sine'
  baseOsc.frequency.value = 220
  ambientState.oscillators.push(baseOsc)

  const baseGain = ctx.createGain()
  baseGain.gain.setValueAtTime(0, now)
  baseGain.gain.linearRampToValueAtTime(0.07, now + 1)
  ambientState.gains.push(baseGain)
  ambientState.baseGain = baseGain

  // Pulse LFO creates rhythmic swell
  const pulseLfo = ctx.createOscillator()
  pulseLfo.type = 'sine'
  pulseLfo.frequency.value = 0.4 + intensity * 0.15 // 0.55 – 1.15 Hz
  ambientState.oscillators.push(pulseLfo)
  ambientState.pulseLfo = pulseLfo

  const pulseDepth = ctx.createGain()
  pulseDepth.gain.value = 0.04 + intensity * 0.015
  ambientState.gains.push(pulseDepth)
  ambientState.pulseDepth = pulseDepth

  pulseLfo.connect(pulseDepth)
  pulseDepth.connect(baseGain.gain)

  baseOsc.connect(baseGain)
  baseGain.connect(dest)

  // --- Gentle chime overlay (periodic high-pitched tones) ---
  const chimeIntervalMs = Math.max(2000, 6000 - intensity * 800)
  const chimeFreqs = [523, 659, 784, 880, 1047, 1175, 1319]
  let chimeIndex = 0

  const chimeInterval = setInterval(() => {
    if (!ambientState.active) return
    try {
      const c = getCtx()
      const d = getAmbientGain()
      const t = c.currentTime

      const osc = c.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = chimeFreqs[chimeIndex % chimeFreqs.length]
      chimeIndex++

      const g = c.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.04 + intensity * 0.01, t + 0.05)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8)

      osc.connect(g)
      g.connect(d)
      osc.start(t)
      osc.stop(t + 0.81)
    } catch {
      // Audio not available
    }
  }, chimeIntervalMs)
  ambientState.intervals.push(chimeInterval)

  // Start base oscillators
  baseOsc.start(now)
  pulseLfo.start(now)
}

// ============================================================
// INTENSITY MODULATION
// ============================================================

/**
 * Modulate the currently running ambient's character based on intensity (1–5).
 * Higher intensity → faster modulation, more layers, more dramatic.
 * Safe to call while ambient is running; silently no-ops if no ambient active.
 */
export function modulateAmbient(intensity: number) {
  const i = Math.max(1, Math.min(5, intensity))
  ambientState.intensity = i

  if (!ambientState.active || !ambientState.tone) return

  const ctx = getCtx()
  const now = ctx.currentTime

  switch (ambientState.tone) {
    case 'dominant':
      // Faster LFO, more rumble
      if (ambientState.lfoOsc) {
        ambientState.lfoOsc.frequency.linearRampToValueAtTime(
          0.1 + i * 0.08,
          now + 1,
        )
      }
      if (ambientState.lfoDepth) {
        ambientState.lfoDepth.gain.linearRampToValueAtTime(
          0.08 + i * 0.02,
          now + 1,
        )
      }
      if (ambientState.rumbleFilter) {
        ambientState.rumbleFilter.frequency.linearRampToValueAtTime(
          80 + i * 15,
          now + 1,
        )
      }
      if (ambientState.rumbleGain) {
        ambientState.rumbleGain.gain.linearRampToValueAtTime(
          0.04 + i * 0.015,
          now + 1,
        )
      }
      if (ambientState.bassGain) {
        ambientState.bassGain.gain.linearRampToValueAtTime(
          0.12 + i * 0.02,
          now + 1,
        )
      }
      break

    case 'hypnotic':
      // Stronger binaural difference, louder pad
      if (ambientState.binauralGain) {
        ambientState.binauralGain.gain.linearRampToValueAtTime(
          0.07 + i * 0.01,
          now + 1,
        )
      }
      if (ambientState.padGain) {
        ambientState.padGain.gain.linearRampToValueAtTime(
          0.04 + i * 0.01,
          now + 1,
        )
      }
      if (ambientState.padFilter) {
        ambientState.padFilter.frequency.linearRampToValueAtTime(
          300 + i * 50,
          now + 1,
        )
      }
      break

    case 'teasing':
      // Faster pulse, louder base
      if (ambientState.pulseLfo) {
        ambientState.pulseLfo.frequency.linearRampToValueAtTime(
          0.4 + i * 0.15,
          now + 1,
        )
      }
      if (ambientState.pulseDepth) {
        ambientState.pulseDepth.gain.linearRampToValueAtTime(
          0.04 + i * 0.015,
          now + 1,
        )
      }
      if (ambientState.baseGain) {
        ambientState.baseGain.gain.linearRampToValueAtTime(
          0.06 + i * 0.015,
          now + 1,
        )
      }
      break
  }
}

// ============================================================
// BREATHING GUIDE (4-7-8 pattern)
// ============================================================

interface BreathingState {
  active: boolean
  source: AudioBufferSourceNode | null
  filter: BiquadFilterNode | null
  gain: GainNode | null
  cycleTimeout: ReturnType<typeof setTimeout> | null
}

const breathingState: BreathingState = {
  active: false,
  source: null,
  filter: null,
  gain: null,
  cycleTimeout: null,
}

/** Cycle duration: 4s inhale + 7s hold + 8s exhale = 19s */
const BREATHING_CYCLE_MS = 19000
const INHALE_DUR = 4
const HOLD_DUR = 7
const EXHALE_DUR = 8

/**
 * Start a 4-7-8 breathing guide using filtered noise.
 * The noise swells during inhale, holds steady, then fades during exhale.
 */
export function startBreathingGuide(bpm?: number) {
  stopBreathingGuide()

  const ctx = getCtx()
  const dest = getAmbientGain()
  const now = ctx.currentTime
  const noise = getNoiseBuffer(ctx)

  breathingState.active = true

  // --- Create looping noise source ---
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  breathingState.source = src

  // Bandpass filter for a breathy, airy quality
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 500
  filter.Q.value = 0.8
  breathingState.filter = filter

  // Gain node for swell/fade modulation
  const gain = ctx.createGain()
  gain.gain.value = 0
  breathingState.gain = gain

  src.connect(filter)
  filter.connect(gain)
  gain.connect(dest)

  // --- Schedule first cycle ---
  scheduleBreathingCycle(gain, now)

  // Start source
  src.start(now)
}

function scheduleBreathingCycle(gain: GainNode, cycleStart: number) {
  if (!breathingState.active) return

  const now = cycleStart

  // Inhale: 4s — ramp up
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.12, now + INHALE_DUR)

  // Hold: 7s — steady
  gain.gain.setValueAtTime(0.12, now + INHALE_DUR + HOLD_DUR)

  // Exhale: 8s — ramp down
  gain.gain.linearRampToValueAtTime(0.001, now + INHALE_DUR + HOLD_DUR + EXHALE_DUR)

  // Schedule next cycle
  breathingState.cycleTimeout = setTimeout(() => {
    if (!breathingState.active) return
    try {
      const nextStart = getCtx().currentTime
      scheduleBreathingCycle(gain, nextStart)
    } catch {
      // Context may be closed
    }
  }, BREATHING_CYCLE_MS)
}

/** Stop the breathing guide and clean up resources */
export function stopBreathingGuide() {
  breathingState.active = false

  if (breathingState.cycleTimeout) {
    clearTimeout(breathingState.cycleTimeout)
    breathingState.cycleTimeout = null
  }

  if (breathingState.source) {
    try { breathingState.source.stop() } catch { /* already stopped */ }
    try { breathingState.source.disconnect() } catch { /* */ }
    breathingState.source = null
  }

  if (breathingState.filter) {
    try { breathingState.filter.disconnect() } catch { /* */ }
    breathingState.filter = null
  }

  if (breathingState.gain) {
    try { breathingState.gain.disconnect() } catch { /* */ }
    breathingState.gain = null
  }
}
