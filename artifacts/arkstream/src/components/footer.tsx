import { useState } from 'react';
import { Link } from 'wouter';
import { ArkLogo } from '@/components/ark-logo';
import { siteConfig } from '@/lib/site-config';
import type { Notice, NoticeType } from '@/lib/site-config';

// ── Icons ──────────────────────────────────────────────────────────────────────

function DiscordIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.043.036.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}

/** Bell icon for Notices */
function BellIcon() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── Notice type colours ────────────────────────────────────────────────────────
const NOTICE_COLORS: Record<NoticeType, { bg: string; border: string; dot: string; label: string }> = {
  info:        { bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.2)',  dot: '#3b82f6', label: 'Info' },
  warning:     { bg: 'rgba(234,179,8,0.07)',   border: 'rgba(234,179,8,0.22)', dot: '#eab308', label: 'Notice' },
  maintenance: { bg: 'rgba(229,41,42,0.07)',   border: 'rgba(229,41,42,0.22)', dot: '#E5292A', label: 'Maintenance' },
};

// ── Notice modal ───────────────────────────────────────────────────────────────
function NoticeModal({ notices, onClose }: { notices: Notice[]; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'notice-fadein 0.18s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 9991,
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 480,
        maxHeight: '80vh',
        background: '#161616',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        animation: 'notice-slidein 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(229,41,42,0.08)',
              border: '1px solid rgba(229,41,42,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#E5292A',
            }}>
              <BellIcon />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F0', margin: 0 }}>
                Notices
              </p>
              <p style={{ fontSize: 10, color: '#555', margin: 0 }}>
                {notices.length} announcement{notices.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#666', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.14s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.09)'; el.style.color = '#ccc'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.05)'; el.style.color = '#666'; }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Notice list */}
        <div style={{
          overflowY: 'auto', padding: '12px 16px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.08) transparent',
        }}>
          {notices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ fontSize: 13, color: '#555' }}>No announcements at this time.</p>
            </div>
          ) : (
            notices.map(n => {
              const c = NOTICE_COLORS[n.type];
              return (
                <div key={n.id} style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 7,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#E8E8E8' }}>{n.title}</span>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                      background: c.border, color: c.dot,
                      textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
                    }}>
                      {c.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#888', margin: 0, lineHeight: 1.65 }}>
                    {n.message}
                  </p>
                  <span style={{ fontSize: 10, color: '#444' }}>
                    {new Date(n.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: '#3a3a3a' }}>
            Stay updated on{' '}
            <a
              href={siteConfig.discordInvite}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#5865F2', textDecoration: 'none', fontWeight: 600 }}
            >
              Discord
            </a>
          </span>
          <button
            onClick={onClose}
            style={{
              fontSize: 12, fontWeight: 600,
              padding: '7px 16px', borderRadius: 7,
              background: 'rgba(229,41,42,0.1)',
              border: '1px solid rgba(229,41,42,0.2)',
              color: 'rgba(229,100,100,0.9)', cursor: 'pointer',
              transition: 'all 0.14s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(229,41,42,0.18)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(229,41,42,0.1)'; }}
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes notice-fadein  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes notice-slidein { from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
      `}</style>
    </>
  );
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const BORDER_COLOR = 'rgba(255,255,255,0.06)';
const MUTED        = '#505050';
const MUTED_HOVER  = '#aaa';

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}>
      <span
        style={{
          fontSize: 12, color: MUTED, cursor: 'pointer',
          transition: 'color 0.15s',
          display: 'inline-flex', alignItems: 'center', gap: 5,
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = MUTED_HOVER}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = MUTED}
      >
        {children}
      </span>
    </Link>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────
export function Footer() {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const notices = siteConfig.notices as Notice[];
  const hasNotices = notices.length > 0;

  return (
    <>
      <footer style={{
        borderTop: `1px solid ${BORDER_COLOR}`,
        marginTop: 20,
        background: 'rgba(0,0,0,0.4)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px 28px' }}>

          {/* Top row */}
          <div style={{
            display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', justifyContent: 'space-between',
            gap: 24, marginBottom: 28,
          }}>
            {/* Brand */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ArkLogo linkTo="/" />
              <p style={{ fontSize: 11, color: '#3a3a3a', margin: 0 }}>
                Premium anime streaming, always free.
              </p>
            </div>

            {/* Nav links */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <FooterLink href="/status"><StatusIcon /> Status</FooterLink>
              <FooterLink href="/dmca"><ShieldIcon /> DMCA</FooterLink>
              <FooterLink href="/privacy"><LockIcon /> Privacy</FooterLink>

              {/* Notice button */}
              <button
                onClick={() => setNoticeOpen(true)}
                style={{
                  fontSize: 12, color: hasNotices ? 'rgba(229,100,100,0.7)' : MUTED,
                  cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  transition: 'color 0.15s', whiteSpace: 'nowrap', position: 'relative',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = MUTED_HOVER}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = hasNotices ? 'rgba(229,100,100,0.7)' : MUTED}
              >
                <BellIcon />
                Notices
                {hasNotices && (
                  <span style={{
                    position: 'absolute', top: -4, right: -6,
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#E5292A',
                    boxShadow: '0 0 5px rgba(229,41,42,0.7)',
                    animation: 'notice-dot-pulse 2.2s ease-in-out infinite',
                  }} />
                )}
              </button>

              {/* Discord */}
              <a
                href={siteConfig.discordInvite}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12, color: MUTED, textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  transition: 'color 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = MUTED_HOVER}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = MUTED}
              >
                <DiscordIcon /> Discord
              </a>
            </nav>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: BORDER_COLOR, marginBottom: 20 }} />

          {/* Bottom row */}
          <div style={{
            display: 'flex', flexWrap: 'wrap',
            justifyContent: 'space-between', alignItems: 'center', gap: 10,
          }}>
            <p style={{ fontSize: 11, color: '#2e2e2e', margin: 0, letterSpacing: '0.03em' }}>
              © {new Date().getFullYear()} ArkStream — All Rights Reserved
            </p>
            <p style={{ fontSize: 11, color: '#2e2e2e', margin: 0 }}>
              by{' '}
              <span style={{ color: '#444', fontWeight: 600 }}>@Arkuior</span>
            </p>
          </div>
        </div>
      </footer>

      {noticeOpen && (
        <NoticeModal notices={notices} onClose={() => setNoticeOpen(false)} />
      )}

      <style>{`
        @keyframes notice-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
    </>
  );
}
