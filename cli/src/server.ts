import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, readFile } from 'node:fs/promises';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { AnalysisSchema, type Analysis } from '../../packages/core/src/index.js';

const defaultAssets = fileURLToPath(new URL('./web/', import.meta.url));
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

export function createDashboardApp(result: Analysis, assetsDir = defaultAssets) {
  const json = JSON.stringify(AnalysisSchema.parse(result));
  const app = new Hono();
  app.use('*', async (c, next) => {
    const host = new URL(c.req.url).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') return c.text('Local access only.', 403);
    const origin = c.req.header('Origin');
    if (origin && origin !== new URL(c.req.url).origin)
      return c.text('Cross-origin access denied.', 403);
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      c.header('Allow', 'GET, HEAD');
      return c.text('This dashboard is read-only.', 405);
    }
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; frame-ancestors 'none'",
    );
    await next();
  });
  app.get('/api/graph', (c) =>
    c.body(json, 200, { 'Content-Type': 'application/json; charset=utf-8' }),
  );
  app.get('*', async (c) => {
    // Serve only packaged assets, never the scanned repository or arbitrary files.
    let requested: string;
    try {
      requested = decodeURIComponent(c.req.path);
    } catch {
      return c.text('Invalid path.', 400);
    }
    if (requested === '/') requested = '/index.html';
    if (requested !== '/index.html' && !/^\/assets\/[a-zA-Z0-9_.-]+$/.test(requested))
      return c.text('Not found.', 404);
    try {
      const data = await readFile(path.join(assetsDir, requested.slice(1)));
      return c.body(data, 200, {
        'Content-Type': mime[path.extname(requested)] ?? 'application/octet-stream',
      });
    } catch {
      return c.text('Dashboard asset not found. Rebuild or reinstall DevLens.', 404);
    }
  });
  return app;
}

export async function startDashboard(result: Analysis, port = 4545, assetsDir = defaultAssets) {
  try {
    await access(path.join(assetsDir, 'index.html'));
  } catch {
    throw new Error('Dashboard assets are missing. Run pnpm build or reinstall DevLens.');
  }
  const app = createDashboardApp(result, assetsDir);
  return await new Promise<ReturnType<typeof serve>>((resolve, reject) => {
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, () => resolve(server));
    server.once('error', (error: NodeJS.ErrnoException) =>
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? `Port ${port} is already in use. Try --port ${port < 65535 ? port + 1 : 4545}.`
            : `Could not start dashboard: ${error.message}`,
        ),
      ),
    );
  });
}
