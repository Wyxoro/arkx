import { markAppReady } from '@/lib/preload-state';
import { useState, useCallback, useEffect } from 'react';
import { useSearchAnime } from '@workspace/api-client-react';
import { AnimeCard } from '@/components/anime-card';
import { ArkLogo } from '@/components/ark-logo';
import { NoticesBell } from '@/components/notices-bell';
import { Footer } from '@/components/footer';
import { Spinner } from '@/components/preloader';
import { Link } from 'wouter';

const BG           = '#111111';
const RED          = '#E5292A';
const BORDER       = 'rgba(255,255,255,0.07)';
const SURFACE      = 'rgba(255,255,255,0.03)';
const TEXT_PRIMARY = '#F0F0F0';
const TEXT_SEC     = '#888';
const TEXT_MUTED   = '#444';

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function SearchIcon({ size = 14, color = TEXT_MUTED }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6"/>
    </svg>
  );
}

// ── Popular genres ─────────────────────────────────────────────────────────────

const GENRES = [
  'Action', 'Romance', 'Comedy', 'Drama', 'Fantasy',
  'Sci-Fi', 'Horror', 'Slice of Life', 'Sports', 'Mecha',
  'Mystery', 'Supernatural',
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function Search() {
  useEffect(() => { markAppReady(); }, []);
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSet = useCallback(debounce((v: string) => setDebouncedQ(v), 380), []);

  // Effective search term: typed query overrides genre chip
  const effectiveQ = query.trim().length >= 2
    ? debouncedQ
    : activeGenre ?? '';

  const { data, isLoading, isFetching } = useSearchAnime(
    { q: effectiveQ, perPage: 32 },
    { query: { enabled: effectiveQ.length >= 2 } }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    debouncedSet(e.target.value);
    if (e.target.value.trim()) {
      setActiveGenre(null); // clear genre chip when typing
    }
  };

  const handleGenre = (genre: string) => {
    if (activeGenre === genre) {
      setActiveGenre(null);
    } else {
      setActiveGenre(genre);
      setQuery('');
      setDebouncedQ('');
    }
  };

  const isEmpty = effectiveQ.length < 2;
  const showResults = !isEmpty && data?.data && data.data.length > 0;
  const showNoResults = !isEmpty && !isLoading && data?.data?.length === 0;

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT_PRIMARY, display: 'flex', flexDirection: 'column' }}>

      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(17,17,17,0.94)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {/* Top bar */}
        <div style={{
          maxWidth: 1080, width: '100%', margin: '0 auto',
          padding: '0 28px', height: 60,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {/* Back */}
          <Link href="/">
            <button style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, color: TEXT_SEC, cursor: 'pointer',
              background: 'none', border: 'none', padding: 0,
              transition: 'color 0.15s', flexShrink: 0,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = TEXT_PRIMARY; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = TEXT_SEC; }}
            >
              <BackIcon />
            </button>
          </Link>

          <ArkLogo />

          <div style={{ width: 1, height: 20, background: BORDER, flexShrink: 0 }} />

          {/* Search input */}
          <div style={{ position: 'relative', flex: 1 }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <SearchIcon size={13} />
            </div>
            <input
              type="search"
              autoFocus
              value={query}
              onChange={handleChange}
              placeholder="Search anime titles…"
              style={{
                width: '100%', padding: '8px 38px 8px 36px',
                fontSize: 13, color: TEXT_PRIMARY,
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 7, outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                fontFamily: 'inherit',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'rgba(229,41,42,0.35)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(229,41,42,0.06)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = BORDER;
                e.currentTarget.style.boxShadow = '';
              }}
            />
            {(isLoading || isFetching) && (
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                <Spinner size={14} />
              </div>
            )}
          </div>

          <NoticesBell />
        </div>

        {/* Genre chips row */}
        <div style={{
          maxWidth: 1080, width: '100%', margin: '0 auto',
          padding: '10px 28px',
          display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto',
        }}
          className="no-scrollbar"
        >
          <span style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0, marginRight: 4 }}>
            Genre
          </span>
          {GENRES.map(genre => {
            const isActive = activeGenre === genre;
            return (
              <button
                key={genre}
                onClick={() => handleGenre(genre)}
                style={{
                  padding: '4px 11px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s ease', flexShrink: 0,
                  border: `1px solid ${isActive ? RED : BORDER}`,
                  background: isActive ? 'rgba(229,41,42,0.12)' : SURFACE,
                  color: isActive ? '#FF8888' : TEXT_SEC,
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(229,41,42,0.28)';
                    (e.currentTarget as HTMLElement).style.color = TEXT_PRIMARY;
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.borderColor = BORDER;
                    (e.currentTarget as HTMLElement).style.color = TEXT_SEC;
                  }
                }}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '36px 32px' }}>

        {/* Empty state */}
        {isEmpty && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', paddingTop: 80, gap: 16,
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: 14,
              background: SURFACE, border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SearchIcon size={24} color="#2a2a2a" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: TEXT_SEC, marginBottom: 5 }}>
                Find your next anime
              </p>
              <p style={{ fontSize: 12, color: TEXT_MUTED }}>
                Search by title or browse genres above
              </p>
            </div>
          </div>
        )}

        {/* No results */}
        {showNoResults && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, gap: 8 }}>
            <p style={{ fontSize: 14, color: TEXT_SEC }}>
              No results for{' '}
              <span style={{ color: TEXT_PRIMARY, fontWeight: 700 }}>"{effectiveQ}"</span>
            </p>
            <p style={{ fontSize: 12, color: TEXT_MUTED }}>Try a different title or genre</p>
          </div>
        )}

        {/* Results grid */}
        {showResults && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <p style={{ fontSize: 12, color: TEXT_MUTED, flexShrink: 0 }}>
                {data!.pageInfo.total > 0
                  ? <>{data!.pageInfo.total} results for </>
                  : 'Results for '}
                <span style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>"{effectiveQ}"</span>
              </p>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
            </div>
            <div className="ark-section-grid">
              {data!.data.map(anime => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
