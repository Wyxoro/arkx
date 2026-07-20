import { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Maintenance from '@/pages/maintenance';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Preloader } from '@/components/preloader';
import { siteConfig } from '@/lib/site-config';

// ── Page transition overlay — fires on every route change ─────────────────────
function PageTransition() {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const prevRef = useRef(location);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (location === prevRef.current) return;
    prevRef.current = location;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    setFading(false);
    setVisible(true);

    const t1 = setTimeout(() => setFading(true), 600);
    const t2 = setTimeout(() => setVisible(false), 1100);
    timersRef.current = [t1, t2];
  }, [location]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: '#111111',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: fading ? 0 : 1,
      transition: fading ? 'opacity 0.5s ease' : 'none',
      pointerEvents: fading ? 'none' : 'all',
    }}>
      <div style={{ position: 'relative', width: 68, height: 68 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3.5px solid rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3.5px solid transparent',
          borderTopColor: '#E5292A',
          borderRightColor: 'rgba(229,41,42,0.3)',
          animation: 'ark-spin 0.72s linear infinite',
        }} />
      </div>
    </div>
  );
}

import Home from '@/pages/home';
import Search from '@/pages/search';
import AnimeDetail from '@/pages/anime-detail';
import Watch from '@/pages/watch';
import DMCA from '@/pages/dmca';
import Privacy from '@/pages/privacy';
import Status from '@/pages/status';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 60 * 1000,
      refetchOnMount: true,
    },
  },
});

// ── Maintenance gate — redirects all routes except /status when enabled ────────
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  if (siteConfig.maintenanceMode && location !== '/status') {
    return <Maintenance />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <>
      <Preloader />
      <PageTransition />
      <MaintenanceGate>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/search" component={Search} />
          <Route path="/anime/:id" component={AnimeDetail} />
          <Route path="/watch/:animeId/:episodeId" component={Watch} />
          <Route path="/dmca" component={DMCA} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/status" component={Status} />
          <Route path="/maintenance" component={Maintenance} />
          <Route component={NotFound} />
        </Switch>
      </MaintenanceGate>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
