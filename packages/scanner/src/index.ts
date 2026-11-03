import { constants } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import ignoreModule, { type Ignore } from 'ignore';
const ignore = ignoreModule as unknown as () => Ignore;
import type { Warning } from '../../core/src/index.js';

export interface ScannedFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  directory: string;
  language: string;
}
export interface ScanResult {
  root: string;
  files: ScannedFile[];
  contents: Map<string, string>;
  warnings: Warning[];
  skipped: number;
}
const excluded = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'target',
  'coverage',
  'vendor',
  '.idea',
  '.vscode',
]);
const languages: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.mts': 'TypeScript',
  '.cts': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.java': 'Java',
  '.py': 'Python',
  '.sql': 'SQL',
  '.json': 'JSON',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.md': 'Markdown',
  '.mdx': 'MDX',
  '.html': 'HTML',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.sh': 'Shell',
  '.prisma': 'Prisma',
  '.svg': 'SVG',
};
export const isSecret = (name: string) => name === '.env' || name.startsWith('.env.');
// O_NOFOLLOW prevents a final-path symlink swap; never follow repository symlinks.
async function readText(file: string): Promise<{ text: string; size: number } | undefined> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 1024 * 1024) return;
    const buffer = Buffer.alloc(1024 * 1024 + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const bytes = buffer.subarray(0, bytesRead);
    if (bytesRead > 1024 * 1024 || bytes.includes(0)) return;
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), size: bytesRead };
    } catch {
      return;
    }
  } finally {
    await handle.close();
  }
}
export async function scanRepository(
  directory: string,
  excludedPaths: string[] = [],
): Promise<ScanResult> {
  const root = await realpath(path.resolve(directory));
  if (!(await stat(root)).isDirectory()) throw new Error('Project path must be a directory.');
  const result: ScanResult = { root, files: [], contents: new Map(), warnings: [], skipped: 0 };
  const omitted = new Set(excludedPaths.map((p) => path.resolve(p)));
  async function walk(relative: string, parents: { base: string; rules: Ignore }[]) {
    const absolute = path.join(root, relative);
    let entries;
    try {
      entries = await readdir(absolute, { withFileTypes: true });
    } catch {
      result.warnings.push({
        parser: 'scanner',
        path: relative || '.',
        message: 'Directory could not be read.',
      });
      return;
    }
    const rules = [...parents];
    if (entries.some((e) => e.name === '.gitignore' && e.isFile())) {
      try {
        const content = await readText(path.join(absolute, '.gitignore'));
        if (content) rules.push({ base: relative, rules: ignore().add(content.text) });
      } catch {
        result.warnings.push({
          parser: 'scanner',
          path: path.posix.join(relative, '.gitignore'),
          message: 'Ignore rules could not be read.',
        });
      }
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = path.posix.join(relative, entry.name),
        full = path.join(root, rel);
      if (
        entry.isSymbolicLink() ||
        isSecret(entry.name) ||
        excluded.has(entry.name) ||
        omitted.has(full) ||
        entry.name === 'devlens.json'
      ) {
        result.skipped++;
        continue;
      }
      let ignored = false;
      for (const rule of rules) {
        const local = path.posix.relative(rule.base || '.', rel) + (entry.isDirectory() ? '/' : '');
        const test = rule.rules.test(local);
        if (test.ignored) ignored = true;
        if (test.unignored) ignored = false;
      }
      if (ignored) {
        result.skipped++;
        continue;
      }
      if (entry.isDirectory()) {
        await walk(rel, rules);
        continue;
      }
      if (!entry.isFile()) {
        result.skipped++;
        continue;
      }
      try {
        const content = await readText(full);
        if (!content) {
          result.skipped++;
          continue;
        }
        const extension = path.extname(entry.name).toLowerCase();
        result.files.push({
          path: rel,
          name: entry.name,
          extension,
          size: content.size,
          directory: path.posix.dirname(rel),
          language: languages[extension] ?? 'Other',
        });
        result.contents.set(rel, content.text);
      } catch {
        result.warnings.push({ parser: 'scanner', path: rel, message: 'File could not be read.' });
      }
    }
  }
  await walk('', []);
  return result;
}
export function detectLanguages(files: ScannedFile[]) {
  const counts = new Map<string, number>();
  for (const f of files) counts.set(f.language, (counts.get(f.language) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / files.length) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
