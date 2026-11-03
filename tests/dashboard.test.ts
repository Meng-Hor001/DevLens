import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { analyze } from '../cli/src/analyze.js';
import { runCli } from '../cli/src/command.js';
import { createDashboardApp, startDashboard } from '../cli/src/server.js';
import { visibleGraph, parentFolders } from '../apps/web/src/graph-model.js';

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'devlens-dashboard-'));
  roots.push(root);
  await writeFile(path.join(root, 'index.ts'), 'export default 1;');
  return root;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it('serves the exact scan snapshot and packaged assets, rejecting writes and foreign origins', async () => {
  const root = await fixture();
  const data = await analyze(root);
  await writeFile(path.join(root, 'index.html'), '<html>Dashboard</html>');
  const app = createDashboardApp(data, root);
  const response = await app.request('http://127.0.0.1/api/graph');
  expect(await response.json()).toEqual(data);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await (await app.request('http://localhost/')).text()).toContain('Dashboard');
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    expect((await app.request('http://localhost/api/graph', { method })).status).toBe(405);
  }
  expect((await app.request('http://evil.example/api/graph')).status).toBe(403);
  expect(
    (
      await app.request('http://localhost/api/graph', {
        headers: { Origin: 'https://evil.example' },
      })
    ).status,
  ).toBe(403);
  expect((await app.request('http://localhost/index.ts')).status).toBe(404);
  expect((await app.request('http://localhost/assets/%2e%2e%2findex.ts')).status).toBe(404);
});

it('passes the selected port, opens the browser only with --web, and honors no-browser', async () => {
  const root = await fixture();
  const services = {
    startTerminalDashboard: vi.fn().mockResolvedValue(undefined),
    startDashboard: vi.fn().mockResolvedValue({}),
    open: vi.fn().mockResolvedValue({}),
  };
  await runCli([root, '--web', '--port', '4567'], () => {}, services);
  expect(services.startDashboard).toHaveBeenCalledWith(expect.any(Object), 4567);
  expect(services.open).toHaveBeenCalledWith('http://127.0.0.1:4567');
  services.open.mockClear();
  await runCli([root, '--web', '--no-browser'], () => {}, services);
  expect(services.open).not.toHaveBeenCalled();
  services.open.mockRejectedValue(new Error('Unavailable'));
  const log = vi.fn();
  await runCli([root, '--web'], log, services);
  expect(log).toHaveBeenCalledWith(expect.stringContaining('Open http://127.0.0.1:4545 manually'));
});

it('reports missing packaged dashboard assets', async () => {
  const root = await fixture();
  await expect(startDashboard(await analyze(root), 4545, root)).rejects.toThrow(
    'Dashboard assets are missing',
  );
});

it('groups 1,200 files, aggregates edges, caps expansion, and reveals a search result beyond the cap', async () => {
  const data = await analyze(await fixture());
  data.graph.nodes = Array.from({ length: 1200 }, (_, i) => ({
    id: `file:src/f${i}.ts`,
    type: 'file' as const,
    label: `f${i}.ts`,
    metadata: { path: `src/f${i}.ts` },
  }));
  data.graph.nodes.push({
    id: 'file:lib/util.ts',
    type: 'file',
    label: 'util.ts',
    metadata: { path: 'lib/util.ts' },
  });
  data.graph.edges = data.graph.nodes.slice(0, 1200).map((node, i) => ({
    id: `e${i}`,
    source: node.id,
    target: 'file:lib/util.ts',
    type: 'imports' as const,
  }));
  const collapsed = visibleGraph(data, [], 300);
  expect(collapsed.nodes).toHaveLength(2);
  expect(collapsed.edges).toEqual([
    {
      id: JSON.stringify(['folder:src', 'folder:lib']),
      source: 'folder:src',
      target: 'folder:lib',
      count: 1200,
    },
  ]);
  expect(visibleGraph(data, ['src'], 300).nodes).toHaveLength(300);
  expect(visibleGraph(data, ['src'], 600).nodes).toHaveLength(600);
  const selected = 'file:src/f999.ts';
  expect(
    visibleGraph(data, parentFolders('src/f999.ts'), 300, selected).nodes.some(
      (n) => n.id === selected,
    ),
  ).toBe(true);
  expect(parentFolders('src/app/nested/page.tsx')).toEqual(['src', 'src/app', 'src/app/nested']);
});

it('opens the terminal dashboard by default without starting a server or browser', async () => {
  const root = await fixture();
  const services = {
    startTerminalDashboard: vi.fn().mockResolvedValue(undefined),
    startDashboard: vi.fn().mockResolvedValue({}),
    open: vi.fn().mockResolvedValue({}),
  };
  await runCli([root], () => {}, services);
  expect(services.startTerminalDashboard).toHaveBeenCalledWith(
    expect.objectContaining({ project: expect.any(Object) }),
  );
  expect(services.startDashboard).not.toHaveBeenCalled();
  expect(services.open).not.toHaveBeenCalled();
  await expect(runCli([root, '--port', '4546'], () => {}, services)).rejects.toThrow(
    '--port requires --web',
  );
});
