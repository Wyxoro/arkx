import { markAppReady } from '@/lib/preload-state';
import { useEffect } from 'react';
import { ArkLogo } from '@/components/ark-logo';
import { siteConfig } from '@/lib/site-config';

const BG     = '#111111';
const RED    = '#E5292A';
const BORDER = 'rgba(255,255,255,0.08)';

export default function Maintenance() {
  useEffect(() => { markAppReady(); }, []);
  return (
    <div style={{
      minHeight: '100vh', background: BG, color: '#F0F0F0',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 24px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(229,41,42,0.06) 0%, transparent 70%)',
      }} />

      <div style={{
        maxWidth: 520, width: '100%', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32,
        position: 'relative', zIndex: 1,
      }}>

        {/* Logo + Heading — grouped as a single unit */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <ArkLogo size="lg" linkTo={false} />
          <h1 style={{
            fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em',
            color: '#F0F0F0',
          }}>
            Maintenance
          </h1>
          <p style={{
            fontSize: 14, color: '#666', margin: 0, lineHeight: 1.7,
            maxWidth: 420,
          }}>
            {siteConfig.maintenanceMessage}
          </p>
        </div>

        {/* Status card */}
        <div style={{
          width: '100%',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Pulsing dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#eab308',
                boxShadow: '0 0 6px #eab30888',
              }} />
              <div style={{
                position: 'absolute', inset: -3, borderRadius: '50%',
                border: '1px solid rgba(234,179,8,0.3)',
                animation: 'maint-pulse 2s ease-in-out infinite',
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#eab308' }}>
              Maintenance in progress
            </span>
          </div>

          <div style={{ height: 1, background: BORDER }} />

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'ArkPulse-1', status: 'Maintenance', color: '#eab308' },
              { label: 'ArkPulse-2', status: 'Operational', color: '#22c55e' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Discord CTA */}
        <a
          href={siteConfig.discordInvite}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 24px', borderRadius: 9,
            background: 'rgba(88,101,242,0.12)',
            border: '1px solid rgba(88,101,242,0.22)',
            color: '#a5b4fc', fontSize: 13, fontWeight: 600,
            textDecoration: 'none', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(88,101,242,0.2)';
            el.style.borderColor = 'rgba(88,101,242,0.38)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'rgba(88,101,242,0.12)';
            el.style.borderColor = 'rgba(88,101,242,0.22)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.043.036.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Get updates on Discord
        </a>

        <p style={{ fontSize: 11, color: '#2e2e2e', margin: 0 }}>
          © {new Date().getFullYear()} ArkStream · We'll be back soon
        </p>
      </div>

      <style>{`
        @keyframes maint-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
