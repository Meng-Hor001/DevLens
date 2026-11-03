import path from 'node:path';
import { isBuiltin } from 'node:module';
import { Node, Project, SyntaxKind, ts } from 'ts-morph';
import type { ScanResult } from '../../scanner/src/index.js';
import type { Warning } from '../../core/src/index.js';

export interface Dependency { name: string; version: string; section: string; manifest: string; category: string }
export interface ImportRelation { source: string; target: string; external: boolean }
export function dependencyCategory(name: string): string {
  if (/prisma|drizzle|mongoose|sequelize|typeorm|^pg$|mysql|redis|sqlite|mongodb/.test(name)) return 'database';
  if (/(?:^|[@/-])(?:auth|bcrypt|bcryptjs|argon2|jsonwebtoken|jose|helmet|cors|keycloak|dompurify)(?:$|[-/])/.test(name)) return 'security';
  if (/jest|vitest|testing|playwright|cypress|mocha|chai|supertest/.test(name)) return 'testing';
  if (/typescript|eslint|prettier|webpack|vite|tsup|rollup|babel|postcss|^@types\/|^tsx$|turbo|swc/.test(name)) return 'build tools';
  if (/express|nestjs|fastify|koa|hono|socket.io/.test(name)) return 'backend';
  if (/react|next|vue|angular|svelte|tailwind|redux|radix|lucide|motion|^class-variance-authority$/.test(name)) return 'frontend';
  return 'other';
}
export function parseManifests(scan: ScanResult) {
  const dependencies: Dependency[] = [], frameworks = new Set<string>(), warnings: Warning[] = [];
  const known: Record<string, string> = { next: 'Next.js', react: 'React', express: 'Express', '@nestjs/core': 'NestJS', tailwindcss: 'Tailwind CSS', redux: 'Redux', '@reduxjs/toolkit': 'Redux', prisma: 'Prisma', '@prisma/client': 'Prisma' };
  for (const file of scan.files) {
    if (/^next\.config\./.test(file.name)) frameworks.add('Next.js');
    if (/^tailwind\.config\./.test(file.name)) frameworks.add('Tailwind CSS');
    if (file.path.endsWith('prisma/schema.prisma')) frameworks.add('Prisma');
    if (/^Dockerfile(?:\.|$)/.test(file.name) || /^(docker-compose|compose)(\.[\w-]+)?\.ya?ml$/.test(file.name)) frameworks.add('Docker');
    if (file.name !== 'package.json') continue;
    try {
      const json: unknown = JSON.parse(scan.contents.get(file.path)!);
      if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error();
      const manifest = json as Record<string, unknown>;
      for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
        const entries = manifest[section];
        if (entries === undefined) continue;
        if (!entries || typeof entries !== 'object' || Array.isArray(entries)) { warnings.push({ parser: 'manifest', path: file.path, message: `Invalid ${section} map.` }); continue; }
        for (const [name, version] of Object.entries(entries)) {
          if (typeof version !== 'string') { warnings.push({ parser: 'manifest', path: file.path, message: 'Dependency version must be a string.' }); continue; }
          dependencies.push({ name, version, section, manifest: file.path, category: dependencyCategory(name) });
          if (known[name]) frameworks.add(known[name]);
        }
      }
    } catch { warnings.push({ parser: 'manifest', path: file.path, message: 'Invalid package.json; dependency parsing skipped.' }); }
  }
  return { dependencies, frameworks: [...frameworks].sort(), warnings };
}
export function analyzeImports(scan: ScanResult) {
  const warnings: Warning[] = [], relations: ImportRelation[] = [];
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true, compilerOptions: { allowJs: true, target: ts.ScriptTarget.Latest } });
  const contents = new Map([...scan.contents].map(([p, text]) => ['/' + p, text]));
  const host: ts.ParseConfigHost & ts.ModuleResolutionHost = {
    useCaseSensitiveFileNames: true, readDirectory: () => [],
    fileExists: p => contents.has(path.posix.normalize(p)),
    readFile: p => contents.get(path.posix.normalize(p)),
  };
  const configs = new Map<string, ts.CompilerOptions>();
  for (const file of scan.files.filter(f => /^(tsconfig|jsconfig)\.json$/.test(f.name))) {
    try {
      const input = ts.parseConfigFileTextToJson('/' + file.path, scan.contents.get(file.path)!);
      if (input.error) throw new Error();
      const config = ts.parseJsonConfigFileContent(input.config, host, '/' + (file.directory === '.' ? '' : file.directory), undefined, '/' + file.path);
      const errors = config.errors.filter(e => e.code !== 18003);
      if (errors.length) warnings.push({ parser: 'config', path: file.path, message: 'Some compiler configuration options could not be loaded; available options will be used.' });
      // All resolution uses the scanned in-memory snapshot, never arbitrary disk files.
      configs.set(file.directory, config.options);
    } catch { warnings.push({ parser: 'config', path: file.path, message: 'Invalid compiler configuration; using relative import resolution.' }); }
  }
  const optionsFor = (file: string): ts.CompilerOptions => {
    let dir = path.posix.dirname(file);
    while (true) {
      const options = configs.get(dir);
      if (options) return { ...options, moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true, resolveJsonModule: true };
      if (dir === '.') break;
      dir = path.posix.dirname(dir);
    }
    return { moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true, resolveJsonModule: true };
  };
  for (const file of scan.files.filter(f => /\.[cm]?[jt]sx?$/.test(f.path))) {
    try {
      const source = project.createSourceFile('/' + file.path, scan.contents.get(file.path)!);
      const syntax = (source.compilerNode as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics;
      if (syntax?.length) warnings.push({ parser: 'imports', path: file.path, message: `Source has ${syntax.length} syntax error(s); imports recovered where possible.` });
      const specifiers = new Set<string>();
      for (const item of source.getImportDeclarations()) specifiers.add(item.getModuleSpecifierValue());
      for (const item of source.getExportDeclarations()) { const value = item.getModuleSpecifierValue(); if (value) specifiers.add(value); }
      for (const item of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const expression = item.getExpression();
        if (expression.getKind() !== SyntaxKind.ImportKeyword && !(Node.isIdentifier(expression) && expression.getText() === 'require')) continue;
        const arg = item.getArguments()[0];
        if (arg && (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg))) specifiers.add(arg.getLiteralText());
      }
      for (const item of source.getDescendantsOfKind(SyntaxKind.ExternalModuleReference)) {
        const arg = item.getExpression(); if (arg && Node.isStringLiteral(arg)) specifiers.add(arg.getLiteralText());
      }
      const options = optionsFor(file.path);
      for (const specifier of specifiers) {
        if (isBuiltin(specifier)) continue;
        const resolved = ts.resolveModuleName(specifier, '/' + file.path, options, host).resolvedModule;
        // TypeScript does not resolve all asset imports (CSS, SVG, etc.).
        const asset = specifier.startsWith('.') ? path.posix.normalize(path.posix.join(file.directory, specifier)) : undefined;
        const target = resolved?.resolvedFileName.slice(1) ?? (asset && scan.contents.has(asset) ? asset : undefined);
        if (target && scan.contents.has(target)) { relations.push({ source: file.path, target, external: false }); continue; }
        const alias = Object.keys(options.paths ?? {}).some(pattern => {
          const [prefix, suffix] = pattern.split('*');
          return pattern.includes('*') ? specifier.startsWith(prefix!) && specifier.endsWith(suffix ?? '') : specifier === pattern;
        });
        if (specifier.startsWith('.') || specifier.startsWith('/') || alias || specifier.startsWith('#')) {
          warnings.push({ parser: 'imports', path: file.path, message: 'A local import could not be resolved within scanned files.' });
        } else if (/^(?:@[^/]+\/)?[^./][^/]*\b/.test(specifier) && !specifier.includes(':')) {
          const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
          relations.push({ source: file.path, target: name, external: true });
        }
      }
      source.forget();
    } catch { warnings.push({ parser: 'imports', path: file.path, message: 'Import parser failed for this file.' }); }
  }
  return { relations, warnings };
}
