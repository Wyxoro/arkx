import { markAppReady } from '@/lib/preload-state';
import { useEffect } from 'react';
import { Footer } from '@/components/footer';
import { ArkLogo } from '@/components/ark-logo';
import { Link } from 'wouter';

const BG = '#111111';
const RED = '#E5292A';
const BORDER = 'rgba(255,255,255,0.09)';
const SURFACE = 'rgba(255,255,255,0.04)';
const TEXT_PRIMARY = '#F0F0F0';
const TEXT_SEC = '#999';

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: RED, margin: '0 0 14px',
      }}>{title}</h2>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#bbb', lineHeight: 1.7 }}>
          <span style={{ color: RED, flexShrink: 0, marginTop: 5, fontSize: 8 }}>▸</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function Privacy() {
  useEffect(() => { markAppReady(); }, []);
  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT_PRIMARY, position: 'relative' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center',
        padding: '0 28px', height: 64,
        background: 'rgba(17,17,17,0.93)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <ArkLogo />
      </nav>

      {/* Floating back button — hovers below navbar over page content */}
      <div style={{ position: 'absolute', top: 72, left: 28, zIndex: 50 }}>
        <Link href="/">
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 7,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 11, fontWeight: 500, cursor: 'pointer',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            transition: 'all 0.15s ease',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.1)'; el.style.color = 'rgba(255,255,255,0.8)'; el.style.borderColor = 'rgba(255,255,255,0.16)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.06)'; el.style.color = 'rgba(255,255,255,0.5)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
        </Link>
      </div>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '60px 28px 40px' }}>
        {/* Page header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48,
          paddingBottom: 32, borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: 'rgba(229,41,42,0.08)', border: '1px solid rgba(229,41,42,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <LockIcon />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              Privacy Policy
            </h1>
            <p style={{ fontSize: 12, color: TEXT_SEC, margin: 0 }}>
              How we collect, use, and protect your information
            </p>
          </div>
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.8, color: TEXT_SEC }}>
          <p style={{ marginBottom: 36, fontSize: 13, color: '#bbb', lineHeight: 1.8 }}>
            ArkStream values your privacy. This policy outlines how we collect, use, and protect your information when you use our platform.
          </p>

          <Section title="Information We Collect">
            <BulletList items={[
              'Basic usage data (pages visited, features used)',
              'Device information (browser type, operating system)',
              'IP address for analytics and security purposes',
            ]} />
          </Section>

          <Section title="How We Use Your Information">
            <BulletList items={[
              'To improve and optimize our streaming service',
              'To analyze trends and user behavior',
              'To maintain platform security and prevent abuse',
              'To send important service announcements',
            ]} />
          </Section>

          <Section title="Cookies">
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '18px 20px',
            }}>
              <p style={{ margin: 0, fontSize: 13, color: '#bbb', lineHeight: 1.8 }}>
                We use minimal cookies for essential functionality only. <strong style={{ color: TEXT_PRIMARY }}>No third-party tracking cookies are used.</strong>
              </p>
            </div>
          </Section>

          <Section title="Data Protection">
            <p style={{ margin: 0, fontSize: 13, color: '#bbb', lineHeight: 1.8 }}>
              Your information is never sold, shared, or distributed to third parties. We implement industry-standard security measures to protect your data.
            </p>
          </Section>

          <Section title="Your Rights">
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '20px 22px',
            }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#bbb' }}>
                You may request access to, correction of, or deletion of your data at any time by contacting us at:
              </p>
              <a href="mailto:help@arkstream.org" style={{
                fontSize: 15, fontWeight: 700, color: RED, textDecoration: 'none',
              }}>
                help@arkstream.org
              </a>
            </div>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
