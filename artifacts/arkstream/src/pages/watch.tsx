import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import Hls from 'hls.js';
import { useGetStreamSources, useGetAnimeById, useGetAnimeEpisodes } from '@workspace/api-client-react';
import type { Episode } from '@workspace/api-client-react';
import { ArkLogo } from '@/components/ark-logo';
import { NoticesBell } from '@/components/notices-bell';
import { Footer } from '@/components/footer';
import { encodeEpId, decodeEpId } from '@/lib/ep-url';
import { playClick } from '@/lib/sound';
import { markAppReady } from '@/lib/preload-state';

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG            = '#111111';
const RED           = '#E5292A';
const BORDER        = 'rgba(255,255,255,0.09)';
const BORDER_RED    = 'rgba(229,41,42,0.25)';
const SURFACE       = 'rgba(255,255,255,0.04)';
const SURFACE_HOVER = 'rgba(255,255,255,0.07)';
const TEXT_PRIMARY  = '#F0F0F0';
const TEXT_SEC      = '#777';
const TEXT_MUTED    = '#555';

// ── Proxy helper ───────────────────────────────────────────────────────────────
function buildProxyUrl(targetUrl: string, referer?: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set('referer', referer);
  return `${base}/api/stream/proxy?${params.toString()}`;
}

// ── Server icons ───────────────────────────────────────────────────────────────
function SrvIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 14 13" fill={color} style={{ display: 'block', flexShrink: 0 }}>
      <rect x="0"   y="8"  width="3.2" height="5"  rx="1" opacity="0.55"/>
      <rect x="4.6" y="4"  width="3.2" height="9"  rx="1" opacity="0.75"/>
      <rect x="9.2" y="0"  width="3.2" height="13" rx="1"/>
    </svg>
  );
}

// ── Server definitions ─────────────────────────────────────────────────────────
type ServerDef =
  | { kind: 'hls' }
  | { kind: 'iframe'; buildUrl: (malId: number | null, anilistId: number, epNum: number) => string | null };

const SERVERS: { id: string; label: string; def: ServerDef }[] = [
  { id: 'ark',  label: 'ArkPulse-1', def: { kind: 'hls' } },
  {
    id: 'srv2',
    label: 'ArkPulse-2',
    def: { kind: 'iframe', buildUrl: (_mal, al, ep) => `https://megaplay.buzz/embed/${al}/${ep}` },
  },
];

// ── 16:9 Player box ────────────────────────────────────────────────────────────
const CHROME_H = 200;

function PlayerBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      maxWidth: `min(100%, calc((100vh - ${CHROME_H}px) * 16 / 9))`,
      width: '100%', margin: '0 auto', background: '#000',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── HLS Player ─────────────────────────────────────────────────────────────────
interface HLSPlayerProps {
  m3u8Url: string;
  referer?: string;
  subtitles?: { url: string; lang?: string | null; label?: string | null }[];
  onEnded?: () => void;
  onFatalError?: () => void;
}

function HLSPlayer({ m3u8Url, referer, subtitles = [], onEnded, onFatalError }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef   = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !m3u8Url) return;

    // Full reset — clears stale buffer/decoder state from any previous episode
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    video.pause();
    video.removeAttribute('src');
    video.load();

    const proxyManifestUrl = buildProxyUrl(m3u8Url, referer);

    // Native HLS (Safari / iOS) — hand off directly
    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = proxyManifestUrl;
        video.play().catch(() => {});
      } else {
        onFatalError?.();
      }
      return;
    }

    let recoveryAttempts = 0;

    const hls = new Hls({
      enableWorker: true,
      startLevel: -1,

      // ABR — open with a generous bandwidth estimate so quality selection
      // doesn't thrash down to 360p on the first few segments
      abrEwmaDefaultEstimate: 2_000_000,
      abrEwmaFastLive: 3.0,
      abrEwmaSlowLive: 9.0,

      // Buffer — 30 s ahead, 30 s behind, 30 MB cap
      maxBufferLength: 30,
      maxMaxBufferLength: 120,
      maxBufferSize: 30 * 1024 * 1024,
      backBufferLength: 30,
      maxBufferHole: 0.5,

      // Stall / nudge — check every 2 s, nudge 0.2 s up to 5 times before giving up
      highBufferWatchdogPeriod: 2,
      nudgeOffset: 0.2,
      nudgeMaxRetry: 5,

      // Loading retries — generous budget to absorb occasional proxy 429s
      // without surfacing them as fatal errors to the user
      manifestLoadingMaxRetry: 8,
      manifestLoadingRetryDelay: 250,
      manifestLoadingMaxRetryTimeout: 5_000,
      levelLoadingMaxRetry: 8,
      levelLoadingRetryDelay: 250,
      levelLoadingMaxRetryTimeout: 5_000,
      fragLoadingMaxRetry: 8,
      fragLoadingRetryDelay: 250,
      fragLoadingMaxRetryTimeout: 5_000,

      // Streaming — progressive lets playback start before the whole first
      // segment arrives, cutting time-to-first-frame by ~40 %
      progressive: true,
      lowLatencyMode: false,
      appendErrorMaxRetry: 3,
    });

    hls.loadSource(proxyManifestUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });

    // ── Stall recovery ─────────────────────────────────────────────────────────
    // 1. Immediate: whenever the video element signals it's waiting for data,
    //    poke HLS.js to resume segment loading right away.
    const onWaiting  = () => { try { hlsRef.current?.startLoad(); } catch { /* ignore */ } };
    const onStalled  = () => { try { hlsRef.current?.startLoad(); } catch { /* ignore */ } };
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('stalled', onStalled);

    // 2. Background watchdog: if playback position hasn't advanced in 4 s while
    //    the video is supposed to be playing, force HLS to reload from current pos.
    let lastTime  = -1;
    let stuckTicks = 0;
    const watchdog = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || v.ended || v.seeking || v.readyState < 2) {
        lastTime = v?.currentTime ?? -1;
        stuckTicks = 0;
        return;
      }
      if (Math.abs(v.currentTime - lastTime) < 0.05) {
        stuckTicks++;
        if (stuckTicks >= 2) {
          try { hlsRef.current?.startLoad(-1); } catch { /* ignore */ }
          stuckTicks = 0;
        }
      } else {
        lastTime   = v.currentTime;
        stuckTicks = 0;
      }
    }, 2_000);

    // ── Error handler ──────────────────────────────────────────────────────────
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        if (recoveryAttempts < 5) { recoveryAttempts++; hls.startLoad(); }
        else { onFatalError?.(); }
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        if (recoveryAttempts === 0) { recoveryAttempts++; hls.recoverMediaError(); }
        else if (recoveryAttempts === 1) { recoveryAttempts++; hls.swapAudioCodec(); hls.recoverMediaError(); }
        else { onFatalError?.(); }
      } else {
        onFatalError?.();
      }
    });

    hlsRef.current = hls;

    return () => {
      clearInterval(watchdog);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('stalled', onStalled);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  // key prop on parent forces full remount when episode/server changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m3u8Url, referer]);

  return (
    <PlayerBox>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
        controls onEnded={onEnded} crossOrigin="anonymous" playsInline
      >
        {subtitles.map(sub => {
          const lang  = sub.lang  ?? '';
          const label = sub.label ?? lang ?? 'Subtitle';
          return (
            <track key={sub.url} kind="subtitles"
              src={buildProxyUrl(sub.url, referer)}
              srcLang={lang} label={label}
              default={lang.toLowerCase().startsWith('en')}
            />
          );
        })}
      </video>
    </PlayerBox>
  );
}

// ── Iframe Player ──────────────────────────────────────────────────────────────
function IframePlayer({ src }: { src: string }) {
  return (
    <PlayerBox>
      <iframe
        src={src}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    </PlayerBox>
  );
}

// ── Loading screen — animated 3-second steps ───────────────────────────────────
const LOADING_STEPS = [
  { label: 'Connecting to ArkPulse-1',  sub: 'Establishing Secure Stream...' },
  { label: 'Establishing Secure Stream', sub: 'Negotiating protocol handshake…' },
];

function PlayerLoading() {
  const [step, setStep] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (step >= LOADING_STEPS.length - 1) return;
    // Fade out at 4.6 s, advance step at 5 s
    const t1 = setTimeout(() => setFade(false), 4_600);
    const t2 = setTimeout(() => { setStep(s => s + 1); setFade(true); }, 5_000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [step]);

  const current = LOADING_STEPS[step];

  return (
    <PlayerBox>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, width: '100%', height: '100%' }}>

        {/* Spinner with step ring */}
        <div style={{ position: 'relative', width: 52, height: 52 }}>
          {/* Track ring */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid rgba(229,41,42,0.1)',
          }} />
          {/* Spinning arc */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: RED,
            borderRightColor: 'rgba(229,41,42,0.28)',
            animation: 'ark-spin 0.72s linear infinite',
          }} />
          {/* Step number badge */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 800, color: 'rgba(229,41,42,0.7)',
              opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease',
            }}>
              {step + 1}/{LOADING_STEPS.length}
            </span>
          </div>
        </div>

        {/* Step text */}
        <div style={{
          textAlign: 'center',
          opacity: fade ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#d0d0d0', margin: '0 0 5px', letterSpacing: '0.01em' }}>
            {current.label}
          </p>
          <p style={{ fontSize: 11, color: '#555', margin: 0 }}>
            {current.sub}
          </p>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {LOADING_STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 18 : 6,
              height: 4, borderRadius: 2,
              background: i === step ? RED : 'rgba(255,255,255,0.12)',
              transition: 'all 0.35s ease',
            }} />
          ))}
        </div>
      </div>
    </PlayerBox>
  );
}

// ── Error screen ───────────────────────────────────────────────────────────────
function PlayerError({ onFallback, hasFallback }: { onFallback: () => void; hasFallback: boolean }) {
  return (
    <PlayerBox>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, width: '100%', height: '100%', padding: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(229,41,42,0.07)', border: '1px solid rgba(229,41,42,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E5292A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="#E5292A"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#E0E0E0', marginBottom: 6 }}>ArkPulse-1 Unavailable</p>
          <p style={{ fontSize: 12, color: '#555' }}>
            {hasFallback ? 'Switching to ArkPulse-2 shortly…' : 'This episode is temporarily unavailable.'}
          </p>
        </div>
        {hasFallback && (
          <button onClick={onFallback} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 7,
            background: RED, color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(229,41,42,0.3)', transition: 'box-shadow 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(229,41,42,0.45)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(229,41,42,0.3)'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            Switch Now
          </button>
        )}
      </div>
    </PlayerBox>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Watch page ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export default function Watch() {
  const params = useParams<{ animeId: string; episodeId: string }>();
  const [, navigate] = useLocation();

  const animeId   = parseInt(params.animeId ?? '0', 10);
  const episodeId = decodeEpId(decodeURIComponent(params.episodeId ?? ''));

  const [activeServer,   setActiveServer]   = useState('ark');
  const [hlsFailed,      setHlsFailed]      = useState(false);
  const [epSearch,       setEpSearch]       = useState('');
  // playerKey forces complete remount of player when server is clicked or episode changes
  const [playerKey,      setPlayerKey]      = useState(0);
  // 5-second gate — blocks HLS player from mounting until the loading screen has run
  const [playerUnlocked, setPlayerUnlocked] = useState(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const epListRef   = useRef<HTMLDivElement>(null);
  const activeEpRef = useRef<HTMLButtonElement>(null);

  // Dismiss preloader immediately when watch page mounts (covers direct-link navigation)
  useEffect(() => { markAppReady(); }, []);

  // Reset server + player state on every episode change
  useEffect(() => {
    setActiveServer('ark');
    setHlsFailed(false);
    setPlayerKey(k => k + 1);
  }, [episodeId]);

  // 5-second loading gate: resets on every playerKey change (episode switch OR server switch)
  // Blocks <HLSPlayer> from mounting until the full loading screen has been shown
  useEffect(() => {
    setPlayerUnlocked(false);
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = setTimeout(() => {
      setPlayerUnlocked(true);
      unlockTimerRef.current = null;
    }, 5_000);
    return () => {
      if (unlockTimerRef.current) {
        clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
    };
  }, [playerKey]);

  // Auto-scroll active episode into view
  useEffect(() => {
    if (!activeEpRef.current) return;
    const t = setTimeout(() => {
      activeEpRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }, 150);
    return () => clearTimeout(t);
  }, [episodeId]);

  const { data: anime } = useGetAnimeById(animeId, { query: { enabled: animeId > 0 } });
  const { data: episodeData } = useGetAnimeEpisodes(animeId, {
    query: { enabled: animeId > 0, refetchInterval: 30 * 60 * 1000, staleTime: 25 * 60 * 1000 },
  });
  const { data: stream, isLoading: streamLoading, isError: streamError } = useGetStreamSources(
    animeId, episodeId,
    { query: { enabled: animeId > 0 && !!episodeId, retry: 0, staleTime: 14 * 60 * 1000 } }
  );

  const episodes: Episode[] = episodeData?.data ?? [];
  const currentEpIndex = episodes.findIndex(e => e.id === episodeId);
  const currentEpisode = episodes[currentEpIndex] ?? null;
  const nextEpisode    = currentEpIndex >= 0 ? episodes[currentEpIndex + 1] : null;
  const prevEpisode    = currentEpIndex > 0  ? episodes[currentEpIndex - 1] : null;

  const animeTitle  = anime?.title.english ?? anime?.title.romaji ?? '';
  const malId       = anime?.idMal ?? null;
  const epNumber    = currentEpisode?.number ?? (currentEpIndex >= 0 ? currentEpIndex + 1 : 1);
  const epTitle     = currentEpisode?.title ?? null;

  const bestSource    = stream?.sources.find(s => s.isM3U8) ?? stream?.sources[0];
  const refererHeader = stream?.headers?.['Referer'] ?? stream?.headers?.['referer'];
  const arkFailed     = streamError || (!!stream && !bestSource) || hlsFailed;

  // Auto-switch to ArkPulse-2 after 5 s of failure
  useEffect(() => {
    if (arkFailed && activeServer === 'ark') {
      const timer = setTimeout(() => setActiveServer('srv2'), 5_000);
      return () => clearTimeout(timer);
    }
  }, [arkFailed, activeServer]);

  const handleHlsFatal = useCallback(() => setHlsFailed(true), []);

  function goToEpisode(ep: Episode) {
    playClick('navigate');
    navigate(`/watch/${animeId}/${encodeEpId(ep.id)}`);
  }

  // Switch server AND reload from position 0
  function switchServer(srvId: string) {
    playClick('tab');
    setHlsFailed(false);
    setPlayerKey(k => k + 1);
    setActiveServer(srvId);
  }

  const activeServerDef = SERVERS.find(s => s.id === activeServer);
  const iframeSrc = activeServerDef?.def.kind === 'iframe'
    ? activeServerDef.def.buildUrl(malId, animeId, epNumber) : null;

  // Filtered episodes for search
  const filteredEps = epSearch.trim()
    ? episodes.filter(ep => {
        const q = epSearch.toLowerCase();
        return String(ep.number).includes(q) || (ep.title?.toLowerCase().includes(q) ?? false);
      })
    : episodes;

  // ── Button style helpers ─────────────────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.14s ease', border: '1px solid',
    whiteSpace: 'nowrap', userSelect: 'none',
  };

  // ── Servers panel ─────────────────────────────────────────────────────────────
  const ServersPanel = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      background: 'linear-gradient(135deg, rgba(229,41,42,0.06) 0%, rgba(229,41,42,0.02) 100%)',
      border: `1px solid ${BORDER_RED}`,
      borderRadius: 10, padding: '9px 13px 11px',
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'rgba(229,110,110,0.55)', userSelect: 'none',
      }}>
        ArkStream Servers
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SERVERS.map(srv => {
          const isActive = activeServer === srv.id;
          const isFailed = srv.id === 'ark' && arkFailed;
          return (
            <button
              key={srv.id}
              onClick={() => switchServer(srv.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s ease', border: '1px solid',
                whiteSpace: 'nowrap', userSelect: 'none', letterSpacing: '0.01em',
                ...(isActive
                  ? {
                      background: RED, color: '#fff', borderColor: RED,
                      boxShadow: '0 3px 14px rgba(229,41,42,0.4)',
                    }
                  : isFailed
                  ? {
                      background: 'rgba(229,41,42,0.04)', color: 'rgba(229,80,80,0.45)',
                      borderColor: 'rgba(229,41,42,0.13)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.05)', color: '#aaa',
                      borderColor: 'rgba(229,41,42,0.15)',
                    }),
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = BORDER_RED;
                  el.style.color = TEXT_PRIMARY;
                  el.style.background = 'rgba(255,255,255,0.08)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = isFailed ? 'rgba(229,41,42,0.13)' : 'rgba(229,41,42,0.15)';
                  el.style.color = isFailed ? 'rgba(229,80,80,0.45)' : '#aaa';
                  el.style.background = isFailed ? 'rgba(229,41,42,0.04)' : 'rgba(255,255,255,0.05)';
                }
              }}
            >
              <SrvIcon color={isActive ? '#fff' : isFailed ? 'rgba(229,80,80,0.45)' : '#777'} />
              {srv.label}
              {isFailed && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.5 }}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Unique key for each player instance — forces full remount on episode/server/playerKey change
  const instanceKey = `${episodeId}-${activeServer}-${playerKey}`;

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT_PRIMARY, display: 'flex', flexDirection: 'column' }}>

      {/* ── Global CSS ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes ark-spin { to { transform: rotate(360deg); } }

        /* ── Mobile defaults ─────────────────────────────── */
        .watch-outer {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: clamp(8px, 4vw, 24px);
        }
        .watch-layout {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          gap: 10px;
        }
        .watch-player-col {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }
        /* Player frame: inset on all 4 sides to create the 30% reduction */
        .player-frame {
          padding: 0 5%;
        }
        .watch-sidebar {
          order: 2;
          max-height: 50vh;
        }

        /* Desktop nav strip — hidden mobile */
        .watch-desktop-nav { display: none; }

        /* Servers + mobile nav row */
        .watch-bottom-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: nowrap;
          padding: 0 5%;
        }

        /* Mobile nav — stacked prev/next */
        .watch-mobile-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-left: auto;
          flex-shrink: 0;
        }

        /* "You're watching" — mobile */
        .watch-you-watching-mobile {
          display: block;
          padding: 4px 5% 2px;
          font-size: 11px;
          color: ${TEXT_SEC};
          line-height: 1.4;
        }

        /* Back button */
        .watch-back-wrap { padding: 0 5% 2px; }

        /* Episode search */
        .ep-search {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid ${BORDER};
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 11px;
          color: ${TEXT_PRIMARY};
          outline: none;
          transition: border-color 0.14s;
          box-sizing: border-box;
        }
        .ep-search::placeholder { color: ${TEXT_MUTED}; }
        .ep-search:focus { border-color: rgba(229,41,42,0.32); }

        /* Episode scroll */
        .ep-scroll {
          overflow-y: auto;
          padding: 5px;
          flex: 1;
          min-height: 0;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.08) transparent;
        }
        .ep-scroll::-webkit-scrollbar { width: 4px; }
        .ep-scroll::-webkit-scrollbar-track { background: transparent; }
        .ep-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        /* ── Tablet (≥ 640px) ────────────────────────────── */
        @media (min-width: 640px) {
          .watch-outer { padding: clamp(10px, 4vw, 28px); }
          .player-frame { padding: 0 7%; }
        }

        /* ── Desktop (≥ 1024px) ──────────────────────────── */
        @media (min-width: 1024px) {
          .watch-outer {
            padding: clamp(12px, 5vh, 32px) clamp(16px, 5vw, 48px);
          }
          .watch-layout {
            flex-direction: row;
            align-items: flex-start;
            gap: 14px;
          }
          .watch-player-col {
            flex: 1;
            min-width: 0;
          }
          /* Player inset: 8% each side = total 16% narrower + 5vw page padding = ~30% total reduction */
          .player-frame { padding: 0 8%; }

          .watch-sidebar {
            order: 0;
            width: clamp(280px, 22vw, 340px);
            flex-shrink: 0;
            max-height: none;
            height: calc(100vh - clamp(12px, 5vh, 32px) * 2 - 54px);
          }

          .watch-back-wrap { padding: 0 8% 4px; }

          /* Desktop nav strip */
          .watch-desktop-nav {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 8% 6px;
            border-bottom: 1px solid ${BORDER};
          }

          .watch-bottom-row { padding: 8px 8% 0; }
          .watch-mobile-nav { display: none !important; }
          .watch-you-watching-mobile { display: none; }
        }

        /* ── Large desktop (≥ 1400px) ────────────────────── */
        @media (min-width: 1400px) {
          .watch-outer { padding: clamp(16px, 5vh, 40px) clamp(24px, 6vw, 72px); }
          .player-frame { padding: 0 10%; }
          .watch-desktop-nav { padding: 8px 10% 6px; }
          .watch-bottom-row { padding: 8px 10% 0; }
          .watch-back-wrap { padding: 0 10% 4px; }
        }
      `}</style>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', height: 54, flexShrink: 0,
        background: 'rgba(17,17,17,0.97)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <ArkLogo size="sm" />
        <NoticesBell />
      </header>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="watch-outer">
        <div className="watch-layout">

          {/* ── Player column ─────────────────────────────────────────────── */}
          <div className="watch-player-col">

            {/* Back button */}
            <div className="watch-back-wrap">
              <Link href={`/anime/${animeId}`}>
                <button
                  onClick={() => playClick('tab')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px', borderRadius: 7,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                    color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 500,
                    cursor: 'pointer', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                    transition: 'all 0.14s ease',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.09)'; el.style.color = 'rgba(255,255,255,0.75)'; el.style.borderColor = 'rgba(255,255,255,0.14)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.05)'; el.style.color = 'rgba(255,255,255,0.45)'; el.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
              </Link>
            </div>

            {/* Video container — inset on all 4 sides */}
            <div className="player-frame">
              <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
                {activeServer === 'ark' && (
                  <>
                    {/* Show loading screen until the 5-second gate opens, regardless of API speed */}
                    {!playerUnlocked && !arkFailed && <PlayerLoading />}
                    {arkFailed && <PlayerError onFallback={() => switchServer('srv2')} hasFallback />}
                    {playerUnlocked && bestSource && !streamLoading && !arkFailed && (
                      <HLSPlayer
                        key={instanceKey}
                        m3u8Url={bestSource.url}
                        referer={refererHeader}
                        subtitles={stream?.subtitles ?? []}
                        onEnded={() => nextEpisode && goToEpisode(nextEpisode)}
                        onFatalError={handleHlsFatal}
                      />
                    )}
                    {/* Data still loading after gate opened — keep spinner */}
                    {playerUnlocked && (streamLoading || (!bestSource && !arkFailed)) && <PlayerLoading />}
                  </>
                )}
                {activeServer === 'srv2' && (
                  iframeSrc
                    ? <IframePlayer key={instanceKey} src={iframeSrc} />
                    : (
                      <PlayerBox>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, width: '100%', height: '100%' }}>
                          <p style={{ fontSize: 13, color: TEXT_SEC }}>Server unavailable for this title.</p>
                          <button
                            onClick={() => switchServer('ark')}
                            style={{ fontSize: 12, padding: '8px 16px', borderRadius: 6, background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT_SEC, cursor: 'pointer', transition: 'border-color 0.14s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER_RED; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
                          >
                            Back to ArkPulse-1
                          </button>
                        </div>
                      </PlayerBox>
                    )
                )}
              </div>
            </div>

            {/* ── Controls below video ─────────────────────────────────────── */}

            {/* Desktop nav strip: ← Ep N · You're watching · Ep N → */}
            <div className="watch-desktop-nav">
              <div style={{ width: 100, flexShrink: 0 }}>
                {prevEpisode && (
                  <button
                    onClick={() => goToEpisode(prevEpisode)}
                    style={{ ...btnBase, background: SURFACE, color: TEXT_SEC, borderColor: BORDER }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = BORDER_RED; el.style.color = TEXT_PRIMARY; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = BORDER; el.style.color = TEXT_SEC; }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Ep {prevEpisode.number}
                  </button>
                )}
              </div>

              <div style={{ flex: 1, textAlign: 'center', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: 12, color: TEXT_SEC, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                  You're watching{' '}
                  <strong style={{ color: TEXT_PRIMARY }}>Episode {epNumber}</strong>
                  {epTitle && <span style={{ color: TEXT_SEC }}>{' · '}{epTitle}</span>}
                </span>
              </div>

              <div style={{ width: 100, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                {nextEpisode && (
                  <button
                    onClick={() => goToEpisode(nextEpisode)}
                    style={{ ...btnBase, background: RED, color: '#fff', borderColor: RED, boxShadow: '0 2px 10px rgba(229,41,42,0.25)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(229,41,42,0.42)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(229,41,42,0.25)'; }}
                  >
                    Ep {nextEpisode.number}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Servers + mobile nav */}
            <div className="watch-bottom-row">
              <ServersPanel />
              <div className="watch-mobile-nav">
                {prevEpisode && (
                  <button
                    onClick={() => goToEpisode(prevEpisode)}
                    style={{ ...btnBase, background: SURFACE, color: TEXT_SEC, borderColor: BORDER }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = BORDER_RED; el.style.color = TEXT_PRIMARY; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = BORDER; el.style.color = TEXT_SEC; }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Ep {prevEpisode.number}
                  </button>
                )}
                {nextEpisode && (
                  <button
                    onClick={() => goToEpisode(nextEpisode)}
                    style={{ ...btnBase, background: RED, color: '#fff', borderColor: RED, boxShadow: '0 2px 8px rgba(229,41,42,0.25)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(229,41,42,0.4)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(229,41,42,0.25)'; }}
                  >
                    Ep {nextEpisode.number}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Mobile "You're watching" */}
            <div className="watch-you-watching-mobile">
              You're watching{' '}
              <strong style={{ color: TEXT_PRIMARY }}>Episode {epNumber}</strong>
              {epTitle && <span>{' · '}{epTitle}</span>}
            </div>

          </div>{/* end watch-player-col */}

          {/* ── Episode sidebar ───────────────────────────────────────────── */}
          <div className="watch-sidebar">
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 9,
              overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
            }}>

              {/* Sidebar header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 13px 9px', borderBottom: `1px solid ${BORDER}`,
                background: '#141414', flexShrink: 0,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_PRIMARY }}>
                  Episodes
                </span>
                {episodeData?.totalEpisodes != null && (
                  <span style={{
                    fontSize: 9, padding: '2px 5px', borderRadius: 3,
                    background: 'rgba(229,41,42,0.1)', color: 'rgba(229,100,100,0.9)',
                    border: `1px solid ${BORDER_RED}`, fontWeight: 600,
                  }}>
                    {episodeData.totalEpisodes}
                  </span>
                )}
              </div>

              {/* Search — shown when ≥10 episodes */}
              {episodes.length >= 10 && (
                <div style={{ padding: '7px 9px 5px', borderBottom: `1px solid rgba(255,255,255,0.05)`, flexShrink: 0 }}>
                  <input
                    className="ep-search"
                    type="text"
                    placeholder="Search episode…"
                    value={epSearch}
                    onChange={e => setEpSearch(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Episode list */}
              <div className="ep-scroll" ref={epListRef}>
                {filteredEps.length === 0 && epSearch && (
                  <p style={{ fontSize: 12, color: TEXT_MUTED, textAlign: 'center', padding: '16px 0' }}>
                    No episodes match "{epSearch}"
                  </p>
                )}
                {filteredEps.map(ep => {
                  const isActive = ep.id === episodeId;
                  const rawTitle = ep.title && ep.title.trim() !== '' ? ep.title : null;
                  return (
                    <button
                      key={ep.id}
                      ref={isActive ? activeEpRef : undefined}
                      onClick={() => { playClick('episode'); goToEpisode(ep); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        height: 48, padding: '0 8px',
                        borderRadius: 6, textAlign: 'left',
                        border: '1px solid', flexShrink: 0, cursor: 'pointer',
                        transition: 'all 0.14s ease', marginBottom: 2,
                        ...(isActive
                          ? { background: 'rgba(229,41,42,0.07)', borderColor: 'rgba(229,41,42,0.22)' }
                          : { background: 'transparent', borderColor: 'transparent' }),
                      }}
                      onMouseEnter={e => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.background = SURFACE_HOVER; el.style.borderColor = BORDER; } }}
                      onMouseLeave={e => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderColor = 'transparent'; } }}
                    >
                      {ep.image ? (
                        <img src={ep.image} alt={`Ep ${ep.number}`}
                          style={{ width: 54, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{
                          width: 54, height: 32, borderRadius: 4, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isActive ? 'rgba(229,41,42,0.1)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${BORDER}`,
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? 'rgba(229,100,100,0.9)' : TEXT_MUTED }}>
                            {ep.number}
                          </span>
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <p style={{
                          fontSize: 11, fontWeight: 600, margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: isActive ? 'rgba(229,130,130,0.95)' : TEXT_PRIMARY,
                        }}>
                          <span style={{ color: isActive ? 'rgba(229,130,130,0.7)' : TEXT_MUTED }}>Ep {ep.number}</span>
                          {rawTitle && <span style={{ color: isActive ? 'rgba(229,130,130,0.95)' : TEXT_SEC }}>{' · '}{rawTitle}</span>}
                        </p>
                      </div>

                      {isActive && (
                        <div style={{ width: 3, height: 18, borderRadius: 2, background: RED, flexShrink: 0 }} />
                      )}
                    </button>
                  );
                })}

                {episodes.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '28px 0' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid rgba(229,41,42,0.15)`, borderTopColor: RED, animation: 'ark-spin 0.9s linear infinite' }} />
                    <p style={{ fontSize: 12, color: TEXT_MUTED }}>Loading episodes…</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>{/* end watch-outer */}

      <Footer />
    </div>
  );
}
