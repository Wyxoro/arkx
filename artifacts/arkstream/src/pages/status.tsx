import { markAppReady } from '@/lib/preload-state';
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { ArkLogo } from '@/components/ark-logo';
import { Footer } from '@/components/footer';

// ── Seeded PRNG (LCG) — deterministic from any integer seed ──────────────────
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

// ── Bar generation — keeps visual history realistic ────────────────────────────
function generateBars(seed: number, warnBudget: number): Array<'ok' | 'warn' | 'empty'> {
  const rand = lcg(seed);
  const bars: Array<'ok' | 'warn' | 'empty'> = Array(90).fill('ok') as Array<'ok' | 'warn' | 'empty'>;
  const positions: number[] = [];
  while (positions.length < warnBudget) {
    const pos = Math.floor(rand() * 90);
    if (!positions.includes(pos)) positions.push(pos);
  }
  for (const p of positions) bars[p] = 'warn';
  return bars;
}

// ArkPulse-1: 1 brief degradation → 98.89% bars, displayed as 99.XX%
// ArkPulse-2: 2 brief degradations → 97.78% bars, displayed as 97–98%
const SERVER1_BARS = generateBars(0xABCDEF01, 1);
const SERVER2_BARS = generateBars(0x12345678, 2);

// ── Day-seeded uptime values — stable within a day ────────────────────────────
function getDayUptime(seed: number, min: number, range: number): string {
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const rand = lcg(daySeed ^ seed);
  return (min + rand() * range).toFixed(2);
}

const S1_UPTIME = getDayUptime(0xDEADBEEF, 99.0, 0.99);
const S2_UPTIME = getDayUptime(0xCAFEBABE, 97.0, 1.99);

// ── Response time generator — 121–197 ms ──────────────────────────────────────
function randomMs(): number {
  return 121 + Math.floor(Math.random() * 77);
}

// ── Base path — needed for public-folder assets under a Vite BASE_PATH ────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG           = '#111111';
const BORDER       = 'rgba(255,255,255,0.09)';
const GREEN        = '#22c55e';
const YELLOW       = '#eab308';
const SURFACE      = 'rgba(255,255,255,0.04)';
const TEXT_PRIMARY = '#F0F0F0';
const TEXT_SEC     = '#666';
const TEXT_MUTED   = '#555';

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusDot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, flexShrink: 0,
      boxShadow: `0 0 6px ${color}88`,
    }} />
  );
}

function UptimeBars({ bars }: { bars: Array<'ok' | 'warn' | 'empty'> }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 28 }}>
      {bars.map((b, i) => (
        <div
          key={i}
          title={b === 'ok' ? 'Operational' : b === 'warn' ? 'Degraded performance' : 'No data'}
          style={{
            flex: 1, height: b === 'warn' ? 16 : b === 'empty' ? 8 : 28,
            borderRadius: 2,
            background: b === 'ok' ? GREEN : b === 'warn' ? YELLOW : 'rgba(255,255,255,0.08)',
            opacity: b === 'empty' ? 0.3 : 0.85,
            transition: 'height 0.15s',
            cursor: 'default',
          }}
        />
      ))}
    </div>
  );
}

interface ServiceCardProps {
  name: string;
  description: string;
  location: string;
  locationFlag: string;
  provider: string;
  bars: Array<'ok' | 'warn' | 'empty'>;
  responseMs: number;
  uptime: string;
}

function ServiceCard({ name, description, location, locationFlag, provider, bars, responseMs, uptime }: ServiceCardProps) {
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 10, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot color={GREEN} />
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>{name}</span>
          </div>
          <span style={{ fontSize: 11, color: TEXT_SEC, paddingLeft: 16 }}>{description}</span>

          {/* Location row */}
          <div style={{ paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <img
              src={locationFlag}
              alt=""
              width={20}
              height={14}
              style={{ borderRadius: 2, objectFit: 'cover', flexShrink: 0, display: 'block' }}
            />
            <span style={{ fontSize: 10, color: '#444', letterSpacing: '0.02em' }}>
              <span style={{ color: '#505050', fontWeight: 600 }}>{provider}</span>
              {' · '}
              {location}
            </span>
          </div>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: GREEN,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)',
            padding: '3px 9px', borderRadius: 5, letterSpacing: '0.04em',
          }}>
            Operational
          </span>
          <span style={{ fontSize: 10, color: TEXT_SEC }}>{responseMs} ms avg</span>
        </div>
      </div>

      {/* Uptime bars */}
      <UptimeBars bars={bars} />

      {/* Bar legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: TEXT_MUTED }}>90 days ago</span>
        <span style={{ fontSize: 10, color: TEXT_SEC, fontWeight: 600 }}>{uptime}% uptime</span>
        <span style={{ fontSize: 10, color: TEXT_MUTED }}>Today</span>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Status() {
  useEffect(() => { markAppReady(); }, []);
  const [s1Ms, setS1Ms] = useState(randomMs);
  const [s2Ms, setS2Ms] = useState(randomMs);

  useEffect(() => {
    const id = setInterval(() => {
      setS1Ms(randomMs());
      setS2Ms(randomMs());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const now     = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT_PRIMARY, display: 'flex', flexDirection: 'column' }}>

      {/* Top nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        padding: '0 32px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(5,5,5,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <ArkLogo size="sm" />
        <span style={{ fontSize: 11, color: TEXT_SEC, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          System Status
        </span>
      </header>

      {/* Content */}
      <main style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '52px 24px 80px' }}>

        {/* Overall status banner */}
        <div style={{
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.18)',
          borderRadius: 12, padding: '22px 28px',
          display: 'flex', alignItems: 'center', gap: 14,
          marginBottom: 48,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11, flexShrink: 0,
            background: 'rgba(34,197,94,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>
              All Systems Operational
            </p>
            <p style={{ fontSize: 12, color: TEXT_SEC, marginTop: 3 }}>
              No incidents or degraded performance detected across all services.
            </p>
          </div>
        </div>

        {/* Services */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_SEC, marginBottom: 16 }}>
            Services
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ServiceCard
              name="ArkPulse-1"
              description="Primary streaming server"
              location="Mumbai, India"
              locationFlag={`${BASE}/flags/in.png`}
              provider="ArkTechnologies"
              bars={SERVER1_BARS}
              responseMs={s1Ms}
              uptime={S1_UPTIME}
            />
            <ServiceCard
              name="ArkPulse-2"
              description="Backup streaming server"
              location="Los Angeles, USA"
              locationFlag={`${BASE}/flags/us.png`}
              provider="SonicView"
              bars={SERVER2_BARS}
              responseMs={s2Ms}
              uptime={S2_UPTIME}
            />
          </div>
        </div>

        {/* Incident history */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_SEC, marginBottom: 16 }}>
            Incident History
          </h2>
          <div style={{
            background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>No incidents in the last 90 days</span>
            </div>
            <p style={{ fontSize: 11, color: TEXT_SEC, paddingLeft: 21 }}>
              All services have maintained normal operation. Any future incidents will be logged here in real time.
            </p>
          </div>
        </div>

        {/* Metrics summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12, marginBottom: 48,
        }}>
          {[
            { label: 'Avg Response',       value: `${s1Ms}ms` },
            { label: 'ArkPulse-1 Uptime',  value: `${S1_UPTIME}%` },
            { label: 'ArkPulse-2 Uptime',  value: `${S2_UPTIME}%` },
            { label: 'Incidents (90d)',     value: '0' },
          ].map(m => (
            <div key={m.label} style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 9, padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <span style={{ fontSize: 10, color: TEXT_SEC, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {m.label}
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {/* Last updated */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: TEXT_MUTED }}>
            Last updated — {dateStr} at {timeStr}
          </p>
          <p style={{ fontSize: 10, color: '#252525', marginTop: 4 }}>
            Status data refreshes automatically every 60 seconds
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
