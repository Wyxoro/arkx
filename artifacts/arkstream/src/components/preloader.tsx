import { useEffect, useRef, useState } from 'react';
import { subscribeReady } from '@/lib/preload-state';

const MIN_SHOW_MS = 2000; // always show at least this long

/**
 * Data-driven circular preloader.
 * Stays visible until real data is ready (via markAppReady()) AND at least
 * MIN_SHOW_MS has elapsed — then fades out smoothly.
 */
export function Preloader() {
  const [phase, setPhase] = useState<'active' | 'exiting' | 'gone'>('active');
  const startRef = useRef(Date.now());

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout>;
    let goneTimer: ReturnType<typeof setTimeout>;

    const unsub = subscribeReady(() => {
      const elapsed = Date.now() - startRef.current;
      const delay = Math.max(0, MIN_SHOW_MS - elapsed);
      fadeTimer = setTimeout(() => setPhase('exiting'), delay);
      goneTimer = setTimeout(() => setPhase('gone'), delay + 500);
    });

    // Safety net: always dismiss after 8 seconds even if data never loads
    const safeguard = setTimeout(() => setPhase('exiting'), 8000);
    const safeguardGone = setTimeout(() => setPhase('gone'), 8500);

    return () => {
      unsub();
      clearTimeout(fadeTimer);
      clearTimeout(goneTimer);
      clearTimeout(safeguard);
      clearTimeout(safeguardGone);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
        background: '#111111',
        opacity: phase === 'exiting' ? 0 : 1,
        transition: 'opacity 0.5s ease',
        pointerEvents: phase !== 'active' ? 'none' : 'all',
      }}
    >
      {/* Spinner — no wordmark, just the ring */}
      <div style={{ position: 'relative', width: 68, height: 68 }}>
        {/* Outer ring — static dark */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3.5px solid rgba(255,255,255,0.06)',
        }} />
        {/* Inner spinning red arc */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3.5px solid transparent',
          borderTopColor: '#E5292A',
          borderRightColor: 'rgba(229,41,42,0.3)',
          animation: 'ark-spin 0.72s linear infinite',
        }} />
      </div>
    </div>
  );
}

/**
 * Inline mini spinner for use inside buttons / search bars.
 */
export function Spinner({ size = 16, color = '#E5292A' }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(255,255,255,0.08)`,
      borderTopColor: color,
      animation: 'ark-spin 0.72s linear infinite',
      flexShrink: 0,
    }} />
  );
}
