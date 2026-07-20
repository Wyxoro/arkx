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

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: RED, marginBottom: 14, margin: '0 0 14px',
      }}>{title}</h2>
      {children}
    </div>
  );
}

export default function DMCA() {
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
            <ShieldIcon />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              DMCA Policy
            </h1>
            <p style={{ fontSize: 12, color: TEXT_SEC, margin: 0 }}>
              Digital Millennium Copyright Act — Takedown Procedure
            </p>
          </div>
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.8, color: TEXT_SEC }}>
          <p style={{ marginBottom: 32, color: '#bbb' }}>
            ArkStream respects intellectual property rights and complies with the Digital Millennium Copyright Act. If you believe that any content on our platform infringes upon your copyright, please submit a takedown request including the information listed below.
          </p>

          <Section title="Required Information">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Identification of the copyrighted work claimed to be infringed',
                'Identification of the material that is claimed to be infringing',
                'Your contact information (name, address, phone number, email)',
                'A statement of good faith belief that the material is not authorized',
                'A statement that the information in the notification is accurate',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 2,
                    background: 'rgba(229,41,42,0.08)', border: '1px solid rgba(229,41,42,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: RED }}>{i + 1}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#bbb', lineHeight: 1.7 }}>{item}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Submit a Notice">
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '20px 22px',
            }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#bbb' }}>
                Please send all DMCA notices to our designated agent at:
              </p>
              <a href="mailto:dmca@arkstream.org" style={{
                fontSize: 15, fontWeight: 700, color: RED, textDecoration: 'none',
                letterSpacing: '0.01em',
              }}>
                dmca@arkstream.org
              </a>
            </div>
          </Section>

          <Section title="Our Response">
            <p style={{ margin: 0, fontSize: 13, color: '#bbb', lineHeight: 1.8 }}>
              We respond promptly to all valid takedown requests and will remove or disable access to the infringing material upon verification. Repeat infringers will have their access terminated in accordance with applicable law.
            </p>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
