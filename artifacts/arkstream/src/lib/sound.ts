/**
 * Minimal Web Audio click sounds — no files, no dependencies.
 * All synthesis is done with a single OscillatorNode burst.
 * Fails silently if the browser blocks audio (autoplay policy, etc.).
 */

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    if (!_ctx || _ctx.state === 'closed') {
      _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    // Resume if suspended (required after user interaction in some browsers)
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

export type ClickVariant = 'tab' | 'navigate' | 'episode';

/**
 * Play a very short, subtle click tone.
 * - 'tab'      → server button switch (crisp, 60 ms)
 * - 'navigate' → prev/next episode (slightly deeper, 80 ms)
 * - 'episode'  → episode list row click (soft tap, 45 ms)
 */
export function playClick(variant: ClickVariant = 'tab'): void {
  const ac = ctx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    const t = ac.currentTime;

    switch (variant) {
      case 'tab':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.exponentialRampToValueAtTime(450, t + 0.05);
        gain.gain.setValueAtTime(0.07, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        osc.start(t);
        osc.stop(t + 0.07);
        break;

      case 'navigate':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.exponentialRampToValueAtTime(330, t + 0.07);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        osc.start(t);
        osc.stop(t + 0.1);
        break;

      case 'episode':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, t);
        osc.frequency.exponentialRampToValueAtTime(700, t + 0.03);
        gain.gain.setValueAtTime(0.045, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
    }

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  } catch {
    // Audio unavailable — fail silently
  }
}
