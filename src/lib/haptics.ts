// src/lib/haptics.ts — Haptic feedback system using the Vibration API

/** Whether the Vibration API is available in the current browser */
const isVibrationSupported: boolean =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/** Internal toggle state for haptic feedback */
let hapticEnabled: boolean = true;

/**
 * Enable or disable haptic feedback globally.
 */
export function setHapticEnabled(enabled: boolean): void {
  hapticEnabled = enabled;
}

/**
 * Check whether haptic feedback is currently enabled.
 */
export function isHapticEnabled(): boolean {
  return hapticEnabled;
}

/**
 * Generic vibrate — accepts a single duration (ms) or a vibration pattern.
 * A pattern is an array where even indices are vibrate durations and odd
 * indices are pause durations.
 */
export function vibrate(pattern: number | number[]): void {
  if (!hapticEnabled || !isVibrationSupported) return;
  navigator.vibrate(pattern);
}

/**
 * Phase transition haptics.
 *
 * - `'active'` — short double-pulse signalling the start of an active phase
 * - `'rest'`   — single long pulse signalling the start of a rest phase
 */
export function vibratePhaseTransition(phase: "active" | "rest"): void {
  if (!hapticEnabled || !isVibrationSupported) return;

  const patterns: Record<"active" | "rest", number[]> = {
    active: [50, 30, 50],
    rest: [100],
  };

  navigator.vibrate(patterns[phase]);
}

/**
 * Edging warning — rapid triple pulse to alert the user they are approaching a boundary.
 */
export function vibrateWarning(): void {
  if (!hapticEnabled || !isVibrationSupported) return;
  navigator.vibrate([30, 20, 30, 20, 60]);
}

/**
 * Achievement unlocked — ascending triple pattern for a celebratory feel.
 */
export function vibrateAchievement(): void {
  if (!hapticEnabled || !isVibrationSupported) return;
  navigator.vibrate([40, 30, 60, 30, 80, 30, 120]);
}

/**
 * Session complete — triumphant rhythmic pattern with a sustained final pulse.
 */
export function vibrateComplete(): void {
  if (!hapticEnabled || !isVibrationSupported) return;
  navigator.vibrate([80, 50, 80, 50, 80, 50, 200]);
}

/**
 * Subtle single tick — minimal feedback pulse for UI micro-interactions.
 */
export function vibrateTick(): void {
  if (!hapticEnabled || !isVibrationSupported) return;
  navigator.vibrate([10]);
}

/**
 * Challenge complete — distinct dual pulse pattern.
 */
export function vibrateChallengeComplete(): void {
  if (!hapticEnabled || !isVibrationSupported) return;
  navigator.vibrate([60, 40, 100]);
}

/**
 * Immediately cancel any ongoing vibration.
 */
export function stopVibration(): void {
  if (!isVibrationSupported) return;
  navigator.vibrate(0);
}
