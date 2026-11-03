import { it, expect } from 'vitest';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { analyze } from '../cli/src/analyze.js';
import { GraphSchema } from '../packages/core/src/index.js';
import { createDashboardApp } from '../cli/src/server.js';

// Opt-in local acceptance checks; never clone projects or write into them.
const projects: string[] = JSON.parse(process.env.DEVLENS_ACCEPTANCE_PROJECTS ?? '[]');
it.skipIf(!projects.length)(
  'validates 3–5 real Next.js repositories',
  async () => {
    expect(projects.length).toBeGreaterThanOrEqual(3);
    expect(projects.length).toBeLessThanOrEqual(5);
    for (const root of projects) {
      const result = await analyze(root);
      const dashboard = createDashboardApp(result, path.resolve('cli/dist/web'));
      expect(await (await dashboard.request('http://127.0.0.1/api/graph')).json()).toEqual(result);
      expect((await dashboard.request('http://127.0.0.1/')).status).toBe(200);
      expect(GraphSchema.safeParse(result.graph).success).toBe(true);
      const manifests = result.graph.nodes.filter(
        (n) => n.type === 'file' && n.label === 'package.json',
      );
      let declarations = 0;
      for (const node of manifests) {
        const json = JSON.parse(
          await readFile(path.join(root, String(node.metadata.path)), 'utf8'),
        );
        for (const section of ['dependencies', 'devDependencies', 'peerDependencies'])
          declarations += Object.keys(json[section] ?? {}).length;
      }
      expect(result.summary.dependencies).toBe(declarations);
      expect(result.summary.frameworks).toEqual(
        expect.arrayContaining(['Next.js', 'React', 'Tailwind CSS']),
      );
      expect(result.summary.languages.reduce((total, language) => total + language.count, 0)).toBe(
        result.summary.files,
      );
      const files = result.graph.nodes.filter((n) => n.type === 'file');
      const typescript = files.filter((n) => /\.[cm]?tsx?$/.test(String(n.metadata.path))).length;
      expect(result.summary.languages.find((l) => l.name === 'TypeScript')?.count).toBe(typescript);
      expect(
        files.some((n) =>
          String(n.metadata.path)
            .split('/')
            .some((part) => part === '.env' || part.startsWith('.env.')),
        ),
      ).toBe(false);
      // Independently checked layout imports common to these four App Router apps.
      const layout = files.find((n) =>
        ['app/layout.tsx', 'src/app/layout.tsx'].includes(String(n.metadata.path)),
      )!;
      expect(layout).toBeDefined();
      const source = String(layout.metadata.path);
      for (const name of ['globals.css', 'StoreProvider.tsx']) {
        const target = path.posix.join(path.posix.dirname(source), name);
        await access(path.join(root, target));
        expect(result.graph.edges).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              source: `file:${source}`,
              target: `file:${target}`,
              type: 'imports',
            }),
          ]),
        );
      }
      console.log(
        JSON.stringify({
          project: path.basename(root),
          files: result.summary.files,
          dependencies: declarations,
          imports: result.summary.imports,
          warnings: result.warnings.length,
        }),
      );
    }
  },
  60_000,
);
