import { expect, it } from 'vitest';
import { TerminalDashboard, terminalText } from '../cli/src/tui.js';
import type { Analysis } from '../packages/core/src/index.js';

function dashboard() {
  const data: Analysis = {
    schemaVersion: '1',
    project: { name: 'terminal-demo' },
    summary: {
      files: 2,
      skipped: 0,
      languages: [{ name: 'TypeScript', count: 2, percentage: 100 }],
      frameworks: ['React'],
      dependencies: 2,
      uniqueDependencies: 2,
      imports: 1,
    },
    warnings: [],
    dependencies: [
      {
        name: 'react',
        version: '19',
        category: 'frontend',
        section: 'dependencies',
        manifest: 'package.json',
      },
      {
        name: 'vitest',
        version: '5',
        category: 'testing',
        section: 'devDependencies',
        manifest: 'package.json',
      },
    ],
    graph: {
      nodes: ['src/app.ts', 'src/util.ts'].map((p) => ({
        id: `file:${p}`,
        label: p,
        type: 'file',
        metadata: { path: p },
      })),
      edges: [
        { id: 'import', source: 'file:src/app.ts', target: 'file:src/util.ts', type: 'imports' },
      ],
    },
  };
  return new TerminalDashboard(data);
}

it('expands folders, inspects imports, and follows relationships', () => {
  const ui = dashboard();
  ui.key('3', {});
  expect(ui.rows()).toHaveLength(1);
  ui.key('', { name: 'return' });
  expect(ui.rows()).toHaveLength(3);
  ui.key('', { name: 'down' });
  ui.key('', { name: 'return' });
  expect(ui.focus).toBe('file:src/app.ts');
  ui.cursor = ui.rows().findIndex((row) => row.id === 'file:src/util.ts');
  ui.key('', { name: 'return' });
  expect(ui.focus).toBe('file:src/util.ts');
  expect(ui.rows().some((row) => row.id === 'file:src/app.ts')).toBe(true);
  ui.key('', { name: 'escape' });
  expect(ui.focus).toBeUndefined();
});

it('filters search without interpreting typed navigation keys and opens the selected file', () => {
  const ui = dashboard();
  ui.key('4', {});
  ui.key('/', {});
  ui.key('util', {});
  expect(ui.rows()).toHaveLength(1);
  ui.key('', { name: 'return' });
  ui.key('', { name: 'return' });
  expect(ui.page).toBe(2);
  expect(ui.focus).toBe('file:src/util.ts');
  ui.key('4', {});
  ui.key('/', {});
  ui.key('q', {});
  expect(ui.query).toBe('q');
  expect(ui.key('', { name: 'c', ctrl: true })).toBe(false);
});

it('filters categories and changes dependency sort direction', () => {
  const ui = dashboard();
  ui.key('2', {});
  ui.key('r', {});
  expect(ui.rows()[0]?.text).toContain('vitest');
  ui.key('c', {});
  expect(ui.rows()).toHaveLength(1);
  expect(ui.rows()[0]?.text).toContain('react');
  ui.key('s', {});
  expect(ui.sort).toBe('version');
});

it('bounds scrolling and rendering, handles small terminals, and escapes repository text', () => {
  const ui = dashboard();
  ui.key('', { name: 'end' });
  ui.key('', { name: 'down' });
  expect(ui.cursor).toBe(ui.rows().length - 1);
  const plain = ui.render(80, 24).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  expect(plain.split('\r\n')).toHaveLength(24);
  expect(plain.split('\r\n').every((line) => line.length <= 79)).toBe(true);
  expect(ui.render(30, 8)).toContain('resize terminal');
  expect(terminalText('file\x1b[2J\nname\x07')).not.toMatch(/[\x00-\x1f]/);
  expect(ui.key('q', {})).toBe(false);
});

it('renders all four options as bounded tables with persistent column headers', () => {
  const ui = dashboard();
  for (const [option, headers] of [
    ['1', ['Metric', 'Value']],
    ['2', ['Name', 'Version', 'Category', 'Manifest / section']],
    ['3', ['Folder / file', 'Type / state']],
    ['4', ['File path', 'Imports', 'Imported by']],
  ] as const) {
    ui.key(option, {});
    for (const width of [60, 80, 120]) {
      const lines = ui
        .render(width, 24)
        .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
        .split('\r\n');
      expect(lines).toHaveLength(24);
      expect(lines.every((line) => line.length === width - 1)).toBe(true);
      expect(lines[5]).toMatch(/^  \+-+\+/);
      expect(lines[6]).toContain('|');
      if (width === 120) for (const header of headers) expect(lines[6]).toContain(header);
      expect(lines[8]).toMatch(/^> \|/);
    }
  }
  ui.key('/', {});
  ui.key('missing-file', {});
  expect(ui.render(80, 24)).toContain('No matching results.');
});

it('keeps table columns aligned for long names and control characters', () => {
  const ui = dashboard();
  ui.data.dependencies[0]!.name = 'long-name'.repeat(20) + '\x1b[2J';
  ui.key('2', {});
  const lines = ui
    .render(80, 24)
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .split('\r\n');
  const separators = (line: string) => [...line.matchAll(/\|/g)].map((match) => match.index);
  expect(separators(lines[8]!)).toEqual(separators(lines[6]!));
  expect(lines[8]).toContain('~');
});
