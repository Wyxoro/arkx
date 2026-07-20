import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// PORT is only needed when running the dev/preview server — not during `vite build`.
// Default to 3000 so the config doesn't throw in Railway's build phase.
const port    = Number(process.env.PORT     ?? '3000');
const basePath =       process.env.BASE_PATH ?? '/';

const isReplitEnv = process.env.REPL_ID !== undefined;
const isProd      = process.env.NODE_ENV === 'production';

export default defineConfig(async () => {
  // Replit-specific dev tooling — only loaded inside a Repl, never in production builds.
  const replitPlugins = (!isProd && isReplitEnv)
    ? await Promise.all([
        import('@replit/vite-plugin-runtime-error-modal').then(m => m.default()),
        import('@replit/vite-plugin-cartographer').then(m =>
          m.cartographer({ root: path.resolve(import.meta.dirname, '..') }),
        ),
        import('@replit/vite-plugin-dev-banner').then(m => m.devBanner()),
      ])
    : [];

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      ...replitPlugins,
    ],
    resolve: {
      alias: {
        '@':      path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir:     path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort:   true,
      host:         '0.0.0.0',
      allowedHosts: true,
      fs: { strict: true },
    },
    preview: {
      port,
      host:         '0.0.0.0',
      allowedHosts: true,
    },
  };
});
