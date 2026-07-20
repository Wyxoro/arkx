import { markAppReady } from '@/lib/preload-state';
import { useEffect } from 'react';
import { Link } from 'wouter';

const BG = '#111111';
const RED = '#E5292A';
const BORDER = 'rgba(255,255,255,0.07)';
const SURFACE = 'rgba(255,255,255,0.03)';

export default function NotFound() {
  useEffect(() => { markAppReady(); }, []);
  return (
    <div style={{
      minHeight: '100vh', background: BG,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 28, padding: 24,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: 'rgba(229,41,42,0.08)', border: '1px solid rgba(229,41,42,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 42 42" fill="none">
            <path d="M21 7L34 35H8L21 7Z" stroke={RED} strokeWidth="2.5" strokeLinejoin="round" fill="none"/>
            <path d="M13 27H29" stroke={RED} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.07em', color: '#F0F0F0' }}>ArkStream</span>
      </div>

      {/* Error card */}
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`,
        borderRadius: 12, padding: '32px 40px', textAlign: 'center',
        maxWidth: 340, width: '100%',
      }}>
        <p style={{ fontSize: 48, fontWeight: 900, color: 'rgba(229,41,42,0.15)', lineHeight: 1, marginBottom: 12, letterSpacing: '-0.04em' }}>
          404
        </p>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#E0E0E0', marginBottom: 8 }}>Page Not Found</h1>
        <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>

      <Link href="/">
        <button style={{
          display: 'flex', alignItems: 'center', gap: 7,
          fontSize: 13, fontWeight: 600, padding: '10px 22px', borderRadius: 7,
          background: RED, color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(229,41,42,0.3)',
          transition: 'all 0.15s ease',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(229,41,42,0.45)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(229,41,42,0.3)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back to Home
        </button>
      </Link>
    </div>
  );
}
