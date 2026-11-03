import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../cli/src/command.js';
import { Graph, GraphSchema } from '../packages/core/src/index.js';
import { scanRepository, detectLanguages } from '../packages/scanner/src/index.js';
import { dependencyCategory } from '../packages/parsers/src/index.js';
import { analyze } from '../cli/src/analyze.js';

const roots: string[] = [];
async function fixture(files: Record<string, string | Buffer>) {
  const root = await mkdtemp(path.join(tmpdir(), 'devlens-test-')); roots.push(root);
  for (const [name, content] of Object.entries(files)) { await mkdir(path.dirname(path.join(root, name)), { recursive: true }); await writeFile(path.join(root, name), content); }
  return root;
}
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });

describe('graph validation', () => {
  it('deduplicates relationships, counts types, and returns neighbors', () => {
    const g = new Graph(); g.addNode({ id: 'p', label: 'project', type: 'project' }); g.addNode({ id: 'f', label: 'file', type: 'file' });
    g.addEdge('p', 'f', 'contains'); g.addEdge('p', 'f', 'contains');
    expect(g.countByType().contains).toBe(1); expect(g.getNeighbors('f', 'in')[0]?.id).toBe('p');
    expect(() => g.addEdge('f', 'missing', 'imports')).toThrow();
    expect(() => g.addEdge('p', 'f', 'imports')).toThrow();
    expect(GraphSchema.safeParse(g.toJSON()).success).toBe(true);
  });
  it('rejects duplicate node IDs and dangling edges in serialized graphs', () => {
    const node = { id: 'x', type: 'file', label: 'x' };
    expect(GraphSchema.safeParse({ nodes: [node, node], edges: [] }).success).toBe(false);
    expect(GraphSchema.safeParse({ nodes: [node], edges: [{ id: 'e', source: 'x', target: 'y', type: 'imports' }] }).success).toBe(false);
  });
});

describe('scanner', () => {
  it('respects nested gitignore and negation, skips secrets, binaries, symlinks and large files', async () => {
    const root = await fixture({
      '.gitignore': '*.log\nignored/\n*.tmp\n', 'a.ts': 'export const a = 1', 'b.css': 'body {}',
      'error.log': 'hidden', 'ignored/x.ts': 'hidden', 'node_modules/pkg/a.js': 'hidden', '.next/a.ts': 'hidden',
      '.env': 'SECRET_TOKEN=value', '.env.local': 'SECRET_TOKEN=value', '.env.example': 'SECRET_TOKEN=value',
      'binary.dat': Buffer.from([0, 1, 2]), 'large.txt': 'x'.repeat(1024 * 1024 + 1),
      'src/.gitignore': '!keep.tmp\nlocal.ts\n', 'src/keep.tmp': 'keep', 'src/no.tmp': 'skip', 'src/local.ts': 'skip',
    });
    await symlink(path.join(root, '.env'), path.join(root, 'secret.txt'));
    await symlink(root, path.join(root, 'loop'));
    const result = await scanRepository(root);
    expect(result.files.map(f => f.path).sort()).toEqual(['.gitignore', 'a.ts', 'b.css', 'src/.gitignore', 'src/keep.tmp']);
    expect(JSON.stringify([...result.contents])).not.toContain('SECRET_TOKEN');
    expect(result.files.find(f => f.path === 'a.ts')).toMatchObject({ name: 'a.ts', extension: '.ts', directory: '.', size: 18 });
    const languages = detectLanguages(result.files); expect(languages[0]?.name).toBe('Other'); expect(languages.reduce((n, l) => n + l.percentage, 0)).toBe(100);
  });
});

describe('analysis', () => {
  it('analyzes a Next.js project with all import forms, aliases and dependency declarations', async () => {
    const root = await fixture({
      'package.json': JSON.stringify({ dependencies: { next: '15', react: '19', tailwindcss: '4', '@prisma/client': '6' }, devDependencies: { vitest: '3' }, peerDependencies: { react: '>=18' } }),
      'tsconfig.json': '{ // jsonc\n "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }',
      'src/app.tsx': `import Button from '@/components/Button'; import React from 'react'; export { x } from './util'; const c = require('./common'); const l = import('./lazy'); import './style.css'; import fs from 'node:fs'; import {x as y} from 'unknown/subpath';`,
      'src/components/Button.tsx': 'export default function Button() { return <button/> }',
      'src/util.ts': 'export const x = 1;', 'src/common.js': 'module.exports = 1;', 'src/lazy/index.ts': 'export default 1;', 'src/style.css': 'body {}',
      'Dockerfile': 'FROM node:20', 'prisma/schema.prisma': 'generator client {}',
    });
    const result = await analyze(root);
    expect(result.summary.frameworks).toEqual(['Docker', 'Next.js', 'Prisma', 'React', 'Tailwind CSS']);
    expect(result.summary.dependencies).toBe(6); expect(result.summary.uniqueDependencies).toBe(6);
    expect(result.summary.imports).toBe(5);
    expect(result.graph.edges.filter(e => e.type === 'imports').map(e => e.target).sort()).toEqual(['file:src/common.js', 'file:src/components/Button.tsx', 'file:src/lazy/index.ts', 'file:src/style.css', 'file:src/util.ts']);
    expect(result.graph.nodes.some(n => n.id === 'dependency:unknown')).toBe(true);
    expect(result.graph.nodes.some(n => n.id === 'dependency:node:fs')).toBe(false);
    expect(result.warnings).toEqual([]); expect(GraphSchema.safeParse(result.graph).success).toBe(true);
  });
  it('supports inherited config, nearest nested config, and .js imports resolving to TypeScript', async () => {
    const root = await fixture({
      'base.json': '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}',
      'tsconfig.json': '{"extends":"./base.json"}',
      'src/a.ts': "import x from '@/b'; export { default } from './b.js';", 'src/b.ts': 'export default 1;',
      'apps/web/tsconfig.json': '{"compilerOptions":{"paths":{"~/*":["./lib/*"]}}}',
      'apps/web/a.ts': "import x from '~/b';", 'apps/web/lib/b.ts': 'export default 2;',
    });
    const result = await analyze(root); expect(result.summary.imports).toBe(2); expect(result.warnings).toEqual([]);
  });
  it('continues after malformed manifests, configuration and source files', async () => {
    const root = await fixture({ 'package.json': '{broken', 'tsconfig.json': '{broken', 'broken.ts': 'const = ;', 'good.ts': "import './other';", 'other.ts': 'export {};' });
    const result = await analyze(root); expect(result.summary.imports).toBe(1);
    expect(new Set(result.warnings.map(w => w.parser))).toEqual(new Set(['manifest', 'config', 'imports']));
  });
  it('never follows excluded imports or leaks source content into JSON', async () => {
    const root = await fixture({ 'index.ts': "import './.env'; import './hidden'; const token = 'DO_NOT_EXPORT';", '.env': 'DO_NOT_READ', '.gitignore': 'hidden.ts', 'hidden.ts': 'DO_NOT_READ' });
    const result = await analyze(root); expect(result.summary.imports).toBe(0); expect(result.warnings).toHaveLength(2);
    expect(JSON.stringify(result)).not.toMatch(/DO_NOT_EXPORT|DO_NOT_READ/);
  });
  it('reports missing directories and empty projects', async () => {
    const root = await fixture({}); await expect(analyze(root)).rejects.toThrow('No eligible'); await expect(analyze(path.join(root, 'missing'))).rejects.toThrow();
  });
});

describe('CLI', () => {
  async function invoke(args: string[]) {
    const lines: string[] = [];
    await runCli(args, line => lines.push(line));
    return lines.join('\n');
  }
  it('prints help and version, rejects invalid arguments', async () => {
    expect(await invoke(['--help'])).toContain('Usage: devlens');
    expect((await invoke(['--version'])).trim()).toBe('0.1.0');
    for (const args of [['--port', '0'], ['--port', 'abc'], ['--unknown'], ['/missing-devlens-project'], ['one', 'two']]) await expect(invoke(args)).rejects.toThrow();
  });
  it('exports a validated graph, preserves sources and refuses overwrite', async () => {
    const root = await fixture({ 'app.ts': 'export default 1' }); const output = path.join(root, 'graph.json');
    const printed = await invoke([root, '--output', output, '--port', '3001', '--no-browser']);
    expect(printed).toContain('1 files scanned'); expect(printed).toContain('Saved:');
    const result = JSON.parse(await readFile(output, 'utf8')); expect(GraphSchema.safeParse(result.graph).success).toBe(true);
    expect(await readFile(path.join(root, 'app.ts'), 'utf8')).toBe('export default 1');
    const before = await readFile(output, 'utf8'); await expect(invoke([root, '-o', output])).rejects.toThrow(); expect(await readFile(output, 'utf8')).toBe(before);
  });
});

 it('categorizes auth packages without matching authority in UI packages', () => {
   expect(dependencyCategory('class-variance-authority')).toBe('frontend');
   for (const name of ['better-auth', 'next-auth', '@auth/core', 'keycloak-js', 'isomorphic-dompurify']) {
     expect(dependencyCategory(name)).toBe('security');
   }
 });
