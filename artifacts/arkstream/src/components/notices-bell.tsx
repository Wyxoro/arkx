import { useState, useEffect, useRef } from 'react';
import { siteConfig } from '@/lib/site-config';
import type { Notice } from '@/lib/site-config';

const STORAGE_KEY = 'ark_read_notices_v1';

function BellIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

const TYPE_STYLES: Record<Notice['type'], { bg: string; border: string; dot: string; label: string }> = {
  info:        { bg: 'rgba(229,41,42,0.07)',  border: 'rgba(229,41,42,0.20)',  dot: '#E5292A', label: '#fc8080' },
  warning:     { bg: 'rgba(229,41,42,0.05)',  border: 'rgba(229,41,42,0.15)',  dot: '#ff6b6b', label: '#fca5a5' },
  maintenance: { bg: 'rgba(229,41,42,0.10)',  border: 'rgba(229,41,42,0.28)',  dot: '#E5292A', label: '#ff4444' },
};

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function saveReadIds(ids: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])); } catch {}
}

export function NoticesBell() {
  const notices = siteConfig.notices as readonly Notice[];
  const [open, setOpen]       = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notices.filter(n => !readIds.has(n.id)).length;

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onMouse); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      const all = new Set(notices.map(n => n.id));
      setReadIds(all);
      saveReadIds(all);
    }
  }

  if (notices.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Bell button */}
      <button
        onClick={toggle}
        aria-label={`Notices${unread > 0 ? ` — ${unread} unread` : ''}`}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 8,
          background: open ? 'rgba(229,41,42,0.10)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(229,41,42,0.26)' : 'rgba(255,255,255,0.08)'}`,
          color: open ? '#E5292A' : '#888',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
        onMouseEnter={e => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLElement).style.color = '#F0F0F0';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.13)';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
            (e.currentTarget as HTMLElement).style.color = '#888';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
          }
        }}
      >
        <BellIcon size={15} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 14, height: 14, borderRadius: 7,
            background: '#E5292A', color: '#fff',
            fontSize: 9, fontWeight: 700, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', border: '1.5px solid #111111',
            pointerEvents: 'none',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 308,
          background: '#181818',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '11px 14px 9px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#666', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              Notices
            </span>
            <span style={{ fontSize: 10, color: '#333' }}>
              {notices.length} {notices.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {(notices as readonly Notice[]).map((n, idx) => {
              const s = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
              return (
                <div key={n.id} style={{
                  padding: '11px 14px',
                  borderBottom: idx < notices.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    {/* Type dot */}
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: s.dot, flexShrink: 0, marginTop: 4,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title + type badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#E0E0E0', lineHeight: 1.3 }}>
                          {n.title}
                        </span>
                        <span style={{
                          fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 3, flexShrink: 0,
                          background: s.bg, border: `1px solid ${s.border}`, color: s.label,
                          textTransform: 'uppercase', letterSpacing: '0.07em',
                        }}>
                          {n.type}
                        </span>
                      </div>
                      {/* Message */}
                      <p style={{ fontSize: 11, color: '#5a5a5a', margin: 0, lineHeight: 1.6 }}>
                        {n.message}
                      </p>
                      {/* Date */}
                      <span style={{ fontSize: 10, color: '#2e2e2e', marginTop: 5, display: 'block' }}>
                        {n.date}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
