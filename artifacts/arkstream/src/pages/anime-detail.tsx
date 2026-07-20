import { markAppReady } from '@/lib/preload-state';
import { useEffect } from 'react';
import { Link, useParams } from 'wouter';
import { useGetAnimeById, useGetAnimeEpisodes } from '@workspace/api-client-react';
import { Footer } from '@/components/footer';
import { ArkLogo } from '@/components/ark-logo';
import { NoticesBell } from '@/components/notices-bell';
import type { Episode } from '@workspace/api-client-react';
import { encodeEpId } from '@/lib/ep-url';

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG = '#111111';
const RED = '#E5292A';
const BORDER = 'rgba(255,255,255,0.09)';
const BORDER_RED = 'rgba(229,41,42,0.18)';
const SURFACE = 'rgba(255,255,255,0.04)';
const SURFACE_HOVER = 'rgba(255,255,255,0.07)';
const TEXT_PRIMARY = '#F0F0F0';
const TEXT_SEC = '#888';
const TEXT_MUTED = '#555';

// ── Icons ──────────────────────────────────────────────────────────────────────

function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#FDE68A">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

// ── Date formatter ─────────────────────────────────────────────────────────────

function formatAirDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return raw;
  }
}

// ── Back button — shared translucent style ──────────────────────────────────────
function BackBtn({ href, label = 'Back' }: { href: string; label?: string }) {
  return (
    <Link href={href}>
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 6,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        color: 'rgba(255,255,255,0.45)',
        fontSize: 11, fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
      }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(255,255,255,0.09)';
          el.style.color = 'rgba(255,255,255,0.75)';
          el.style.borderColor = 'rgba(255,255,255,0.15)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(255,255,255,0.05)';
          el.style.color = 'rgba(255,255,255,0.45)';
          el.style.borderColor = 'rgba(255,255,255,0.09)';
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        {label}
      </button>
    </Link>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────────

function NavBar() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px', height: 60,
      background: 'rgba(17,17,17,0.93)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <ArkLogo />
      <NoticesBell />
    </nav>
  );
}

// ── Loading state ──────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: `2px solid rgba(229,41,42,0.12)`,
        borderTopColor: RED,
        animation: 'ark-spin 0.75s linear infinite',
      }} />
    </div>
  );
}

// ── Episode grid item ──────────────────────────────────────────────────────────

function EpisodeItem({ ep, animeId }: { ep: Episode; animeId: number }) {
  return (
    <Link href={`/watch/${animeId}/${encodeEpId(ep.id)}`}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
          background: SURFACE, border: `1px solid ${BORDER}`,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = SURFACE_HOVER;
          el.style.borderColor = BORDER_RED;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = SURFACE;
          el.style.borderColor = BORDER;
        }}
      >
        {ep.image ? (
          <img src={ep.image} alt={ep.title ?? `Ep ${ep.number}`}
            style={{ width: 80, height: 46, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }}
            loading="lazy"
          />
        ) : (
          <div style={{
            width: 80, height: 46, borderRadius: 5, flexShrink: 0,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED }}>{ep.number}</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 3 }}>
            <span style={{ color: TEXT_MUTED }}>Ep {ep.number}</span>
            {ep.title ? <span style={{ color: TEXT_SEC }}>{' · '}{ep.title}</span> : ''}
          </p>
          {ep.airDate && (
            <p style={{ fontSize: 10, color: TEXT_MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CalendarIcon /> {formatAirDate(ep.airDate)}
            </p>
          )}
        </div>
        <div style={{ flexShrink: 0, color: TEXT_MUTED }}>
          <PlayIcon size={12} />
        </div>
      </div>
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AnimeDetail() {
  useEffect(() => { markAppReady(); }, []);
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? '0', 10);

  const { data: anime, isLoading: animeLoading, isError } = useGetAnimeById(id, {
    query: { enabled: id > 0 }
  });

  const { data: episodeData, isLoading: epLoading } = useGetAnimeEpisodes(id, {
    query: { enabled: id > 0, refetchInterval: 30 * 60 * 1000, staleTime: 25 * 60 * 1000 }
  });

  if (animeLoading) return <LoadingState />;

  if (isError || !anime) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ color: TEXT_SEC, fontSize: 14 }}>Anime not found</p>
        <Link href="/">
          <button style={{ fontSize: 12, color: RED, background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Go Home
          </button>
        </Link>
      </div>
    );
  }

  const title = anime.title.english ?? anime.title.romaji ?? anime.title.native ?? 'Unknown';
  const episodes: Episode[] = episodeData?.data ?? [];

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT_PRIMARY, position: 'relative' }}>
      <NavBar />

      {/* Floating back button — hovers below navbar over page content */}
      <div style={{ position: 'absolute', top: 68, left: 28, zIndex: 50 }}>
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

      {/* Banner */}
      <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
        {anime.bannerImage ? (
          <img src={anime.bannerImage} alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.4) saturate(0.7)' }}
          />
        ) : anime.coverImage ? (
          <img src={anime.coverImage} alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.1)', filter: 'brightness(0.25) blur(14px) saturate(0.6)' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, rgba(229,41,42,0.08), ${BG})` }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${BG} 0%, rgba(5,5,5,0.45) 60%, transparent 100%)` }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, rgba(5,5,5,0.7), transparent)` }} />
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px', marginTop: -72, position: 'relative', zIndex: 10 }}>

        {/* Cover + meta */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', marginBottom: 28 }}>
          {anime.coverImage && (
            <div style={{
              flexShrink: 0, borderRadius: 10, overflow: 'hidden',
              width: 108, height: 152,
              border: '1.5px solid rgba(229,41,42,0.28)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            }}>
              <img src={anime.coverImage} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
            <h1 style={{ fontSize: 'clamp(17px,2.4vw,26px)', fontWeight: 800, color: '#FFF', margin: '0 0 4px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              {title}
            </h1>
            {anime.title.romaji && anime.title.english && (
              <p style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 10 }}>{anime.title.romaji}</p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {anime.averageScore && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#FDE68A' }}>
                  <StarIcon /> {(anime.averageScore / 10).toFixed(1)}
                </span>
              )}
              {anime.seasonYear && <span style={{ fontSize: 12, color: TEXT_SEC }}>{anime.seasonYear}</span>}
              {anime.format && (
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                  background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT_SEC,
                }}>
                  {anime.format.replace(/_/g, ' ')}
                </span>
              )}
              {anime.status && (
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                  background: anime.status === 'RELEASING' ? 'rgba(34,197,94,0.1)' : SURFACE,
                  color: anime.status === 'RELEASING' ? '#4ADE80' : TEXT_SEC,
                  border: `1px solid ${anime.status === 'RELEASING' ? 'rgba(34,197,94,0.2)' : BORDER}`,
                  textTransform: 'capitalize',
                }}>
                  {anime.status.replace(/_/g, ' ').toLowerCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Genres */}
        {anime.genres.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
            {anime.genres.map(g => (
              <Link key={g} href={`/search?genre=${encodeURIComponent(g)}`}>
                <span style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 4,
                  background: 'rgba(229,41,42,0.06)', border: `1px solid ${BORDER_RED}`,
                  color: 'rgba(229,100,100,0.9)', fontWeight: 500,
                  cursor: 'pointer', transition: 'background 0.15s',
                  display: 'inline-block',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(229,41,42,0.12)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(229,41,42,0.06)'}
                >{g}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Watch CTA */}
        {episodes.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <Link href={`/watch/${id}/${encodeEpId(episodes[0].id)}`}>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 7,
                background: RED, color: '#fff', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(229,41,42,0.28)',
                transition: 'all 0.15s ease',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 26px rgba(229,41,42,0.42)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(229,41,42,0.28)'; (e.currentTarget as HTMLElement).style.transform = ''; }}
              >
                <PlayIcon size={13} /> Start Watching
              </button>
            </Link>
          </div>
        )}

        {/* Synopsis */}
        {anime.description && (
          <div style={{
            background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: '16px 18px', marginBottom: 28,
          }}>
            <h2 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: RED, marginBottom: 10 }}>
              Synopsis
            </h2>
            <p style={{ fontSize: 13, lineHeight: 1.75, color: TEXT_SEC, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {anime.description.replace(/<[^>]+>/g, '')}
            </p>
          </div>
        )}

        {/* Studios */}
        {anime.studios?.length > 0 && (
          <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 28 }}>
            <span style={{ color: TEXT_SEC, fontWeight: 600 }}>Studio:</span>{' '}
            {anime.studios.join(', ')}
          </p>
        )}

        {/* Episodes */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_PRIMARY, margin: 0 }}>
              Episodes
            </h2>
            {episodeData?.totalEpisodes && (
              <span style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 3,
                background: 'rgba(229,41,42,0.1)', color: 'rgba(229,100,100,0.9)',
                border: `1px solid ${BORDER_RED}`, fontWeight: 600,
              }}>
                {episodeData.totalEpisodes}
              </span>
            )}
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>

          {epLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 66, borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}` }} />
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
              No episode data available yet.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 8,
              maxHeight: 540,
              overflowY: 'auto',
              paddingRight: 0,
            }}>
              {episodes.map(ep => (
                <EpisodeItem key={ep.id} ep={ep} animeId={id} />
              ))}
            </div>
          )}
        </div>

      </div>

      <Footer />
    </div>
  );
}
