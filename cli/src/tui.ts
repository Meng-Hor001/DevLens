import { emitKeypressEvents } from 'node:readline';
import type { Analysis, GraphNode } from '../../packages/core/src/index.js';

const pages = ['Overview', 'Dependencies', 'Graph', 'Search'] as const;
type Row = { text: string; cells?: string[]; id?: string; folder?: string };
export type TerminalKey = { name?: string; ctrl?: boolean; shift?: boolean };
// Repository names and parser warnings must never be interpreted as terminal escape codes.
export const terminalText = (text: string) =>
  text.replace(/[\x00-\x1f\x7f-\x9f]/g, '').replace(/[^\x20-\x7e]/g, '?');

export class TerminalDashboard {
  page = 0;
  cursor = 0;
  query = '';
  editing = false;
  category = 0;
  descending = false;
  sort: 'name' | 'version' | 'category' = 'name';
  expanded = new Set<string>();
  focus?: string;
  private files: GraphNode[];
  private names: Map<string, string>;
  private outgoing = new Map<string, string[]>();
  private incoming = new Map<string, string[]>();
  readonly categories: string[];

  constructor(readonly data: Analysis) {
    this.files = data.graph.nodes
      .filter((n) => n.type === 'file')
      .sort((a, b) => String(a.metadata.path).localeCompare(String(b.metadata.path)));
    this.names = new Map(data.graph.nodes.map((n) => [n.id, String(n.metadata.path ?? n.label)]));
    this.categories = ['all', ...new Set(data.dependencies.map((d) => d.category).sort())];
    for (const edge of data.graph.edges) {
      if (edge.type !== 'imports' && edge.type !== 'depends_on') continue;
      this.outgoing.set(edge.source, [...(this.outgoing.get(edge.source) ?? []), edge.target]);
      if (edge.type === 'imports')
        this.incoming.set(edge.target, [...(this.incoming.get(edge.target) ?? []), edge.source]);
    }
  }

  rows(): Row[] {
    const d = this.data;
    if (this.page === 0) {
      const entries = [
        ['Project', d.project.name],
        ['Files', String(d.summary.files)],
        ['Dependencies', String(d.summary.dependencies)],
        ['Unique libraries', String(d.summary.uniqueDependencies)],
        ['Imports', String(d.summary.imports)],
        ['Warnings', String(d.warnings.length)],
        ['Skipped', String(d.summary.skipped)],
        ...d.summary.languages.map((l) => [l.name, `${l.percentage}% (${l.count} files)`]),
        ['Frameworks', d.summary.frameworks.join(', ') || 'None detected'],
        ...(d.warnings.length
          ? d.warnings.map((w) => ['Warning', `${w.path}: ${w.message}`])
          : [['Parser warnings', 'No parser warnings.']]),
      ];
      return entries.map((cells) => ({ text: cells.join(': '), cells }));
    }
    if (this.page === 1)
      return d.dependencies
        .filter(
          (dep) =>
            (this.category === 0 || dep.category === this.categories[this.category]) &&
            dep.name.toLowerCase().includes(this.query.toLowerCase()),
        )
        .sort(
          (a, b) =>
            (this.descending ? -1 : 1) *
            a[this.sort].localeCompare(b[this.sort], undefined, { numeric: true }),
        )
        .map((dep) => ({
          text: `${dep.name} ${dep.version} ${dep.category} ${dep.manifest} (${dep.section})`,
          cells: [dep.name, dep.version, dep.category, `${dep.manifest} (${dep.section})`],
        }));
    if (this.page === 3)
      return this.files
        .filter((n) => this.names.get(n.id)!.toLowerCase().includes(this.query.toLowerCase()))
        .map((n) => ({
          id: n.id,
          text: this.names.get(n.id)!,
          cells: [
            this.names.get(n.id)!,
            String(this.outgoing.get(n.id)?.length ?? 0),
            String(this.incoming.get(n.id)?.length ?? 0),
          ],
        }));
    if (this.focus) {
      const relationships: Row[] = [
        {
          text: `FILE: ${this.names.get(this.focus) ?? this.focus}`,
          cells: ['Selected', this.names.get(this.focus) ?? this.focus],
        },
        ...(this.outgoing.get(this.focus) ?? []).map((id) => ({
          id: id.startsWith('file:') ? id : undefined,
          text: `Imports: ${this.names.get(id) ?? id}`,
          cells: [id.startsWith('file:') ? 'Imports' : 'External', this.names.get(id) ?? id],
        })),
        ...(this.incoming.get(this.focus) ?? []).map((id) => ({
          id,
          text: `Imported by: ${this.names.get(id) ?? id}`,
          cells: ['Imported by', this.names.get(id) ?? id],
        })),
      ];
      if (relationships.length === 1)
        relationships.push({
          text: 'No relationships.',
          cells: ['Connections', 'No relationships.'],
        });
      return relationships;
    }

    const rows: Row[] = [];
    const folders = new Set<string>();
    for (const file of this.files) {
      const parts = this.names.get(file.id)!.split('/');
      let hidden = false;
      for (let i = 0; i < parts.length - 1; i++) {
        const folder = parts.slice(0, i + 1).join('/');
        if (!folders.has(folder)) {
          folders.add(folder);
          rows.push({
            folder,
            text: `${'  '.repeat(i)}${this.expanded.has(folder) ? '[-]' : '[+]'} ${parts[i]}/`,
          });
        }
        if (!this.expanded.has(folder)) {
          hidden = true;
          break;
        }
      }
      if (!hidden)
        rows.push({ id: file.id, text: `${'  '.repeat(parts.length - 1)}    ${parts.at(-1)}` });
    }
    return rows.map((row) => ({
      ...row,
      cells: [
        row.text,
        row.folder ? (this.expanded.has(row.folder) ? 'Expanded' : 'Collapsed') : 'File',
      ],
    }));
  }

  key(text: string, key: TerminalKey): boolean {
    if (key.ctrl && key.name === 'c') return false;
    if (this.editing) {
      if (key.name === 'escape' || key.name === 'return') this.editing = false;
      else if (key.name === 'backspace') this.query = this.query.slice(0, -1);
      else if (text && !key.ctrl && !/[\x00-\x1f\x7f]/.test(text)) this.query += text;
      this.cursor = 0;
      return true;
    }
    if (text === 'q') return false;
    if (key.name === 'tab' || ['1', '2', '3', '4'].includes(text)) {
      this.page = key.name === 'tab' ? (this.page + (key.shift ? 3 : 1)) % 4 : Number(text) - 1;
      this.cursor = 0;
      this.query = '';
      this.focus = undefined;
    } else if (text === '/' && (this.page === 1 || this.page === 3)) this.editing = true;
    else if (key.name === 'escape' || key.name === 'backspace') {
      this.focus = undefined;
      this.query = '';
      this.cursor = 0;
    } else if (text === 'c' && this.page === 1) {
      this.category = (this.category + 1) % this.categories.length;
      this.cursor = 0;
    } else if (text === 's' && this.page === 1) {
      const keys = ['name', 'version', 'category'] as const;
      this.sort = keys[(keys.indexOf(this.sort) + 1) % 3]!;
      this.cursor = 0;
    } else if (text === 'r' && this.page === 1) {
      this.descending = !this.descending;
      this.cursor = 0;
    } else if (key.name === 'down' || text === 'j') this.cursor++;
    else if (key.name === 'up' || text === 'k') this.cursor--;
    else if (key.name === 'pagedown') this.cursor += 10;
    else if (key.name === 'pageup') this.cursor -= 10;
    else if (key.name === 'home') this.cursor = 0;
    else if (key.name === 'end') this.cursor = this.rows().length - 1;
    else if (key.name === 'return') {
      const row = this.rows()[this.cursor];
      if (row?.folder) {
        if (this.expanded.has(row.folder)) this.expanded.delete(row.folder);
        else this.expanded.add(row.folder);
      } else if (row?.id) {
        this.focus = row.id;
        this.page = 2;
        this.cursor = 0;
        this.query = '';
      }
    }
    this.cursor = Math.max(0, Math.min(this.cursor, this.rows().length - 1));
    return true;
  }

  render(columns = 80, height = 24): string {
    const width = Math.max(1, columns - 1);
    const line = (s: string) => terminalText(s).slice(0, width).padEnd(width);
    if (columns < 60 || height < 16)
      return '\x1b[H\x1b[2J' + line('DevLens: resize terminal to at least 60 x 16.');
    const rows = this.rows();
    const count = height - 12;
    const labels =
      this.page === 0
        ? ['Metric', 'Value']
        : this.page === 1
          ? ['Name', 'Version', 'Category', 'Manifest / section']
          : this.page === 3
            ? ['File path', 'Imports', 'Imported by']
            : this.focus
              ? ['Relationship', 'File / library']
              : ['Folder / file', 'Type / state'];
    const weights =
      this.page === 1
        ? [0.3, 0.15, 0.2, 0.35]
        : this.page === 3
          ? [0.66, 0.14, 0.2]
          : this.page === 0 || this.focus
            ? [0.3, 0.7]
            : [0.75, 0.25];
    const available = width - 2 - labels.length * 3 - 1;
    const widths = weights.map((weight) => Math.floor(available * weight));
    widths[0]! += available - widths.reduce((sum, value) => sum + value, 0);
    const cell = (value: string, size: number) => {
      const safe = terminalText(value);
      return (safe.length > size ? safe.slice(0, size - 1) + '~' : safe).padEnd(size);
    };
    const tableRow = (cells: string[], marker = '  ') =>
      marker + '| ' + widths.map((size, i) => cell(cells[i] ?? '', size)).join(' | ') + ' |';
    const border = '  +' + widths.map((size) => '-'.repeat(size + 2)).join('+') + '+';
    const offset = Math.floor(this.cursor / count) * count;
    const header = [
      ` DevLens  /  ${this.data.project.name}  /  LOCAL SNAPSHOT`,
      pages
        .map((p, i) => `${i === this.page ? '[' : ' '}${i + 1} ${p}${i === this.page ? ']' : ' '}`)
        .join('  '),
      '-'.repeat(width),
      this.page === 1
        ? `Category: ${this.categories[this.category]} | Sort: ${this.sort} ${this.descending ? 'descending' : 'ascending'}`
        : this.focus
          ? 'Import graph / file relationships | Esc returns to folders'
          : `${pages[this.page]} | ${rows.length} rows`,
      this.page === 1 || this.page === 3
        ? `Filter: ${this.query}${this.editing ? '_' : '  (/ to edit)'}`
        : 'Up/Down to explore; Enter to expand a folder or follow a file',
    ];
    const body = Array.from({ length: count }, (_, i) => {
      const row = rows[offset + i];
      const content = line(
        row
          ? tableRow(row.cells ?? [row.text], offset + i === this.cursor ? '> ' : '  ')
          : i === 0
            ? tableRow(['No matching results.'])
            : tableRow([]),
      );
      return row && offset + i === this.cursor ? `\x1b[7m${content}\x1b[0m` : content;
    });
    return (
      '\x1b[H' +
      [
        ...header.map((s, i) => (i === 0 ? `\x1b[1;32m${line(s)}\x1b[0m` : line(s))),
        line(border),
        line(tableRow(labels)),
        line(border),
        ...body,
        line(border),
        line('-'.repeat(width)),
        line(
          this.editing
            ? 'Type to filter | Enter finish | Esc finish | Ctrl+C quit'
            : '1-4/Tab pages | arrows/j/k move | Enter open | Esc back | q quit',
        ),
        line(
          this.page === 1
            ? 'c category | s sort column | r reverse | / filter'
            : `Rows ${rows.length ? offset + 1 : 0}-${Math.min(offset + count, rows.length)} of ${rows.length} | PgUp/PgDn scroll`,
        ),
      ].join('\r\n')
    );
  }
}

export async function startTerminalDashboard(data: Analysis): Promise<void> {
  const input = process.stdin;
  const output = process.stdout;
  if (!input.isTTY || !output.isTTY) return;
  const dashboard = new TerminalDashboard(data);
  const wasRaw = input.isRaw;
  emitKeypressEvents(input);
  await new Promise<void>((resolve, reject) => {
    const draw = () => {
      try {
        output.write(dashboard.render(output.columns, output.rows));
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    const cleanup = () => {
      input.removeListener('keypress', press);
      output.removeListener('resize', draw);
      process.removeListener('SIGINT', quit);
      process.removeListener('SIGTERM', quit);
      input.setRawMode(wasRaw);
      input.pause();
      output.write('\x1b[0m\x1b[?25h\x1b[?1049l');
    };
    const quit = () => {
      cleanup();
      resolve();
    };
    const press = (text: string | undefined, key: TerminalKey) => {
      if (dashboard.key(text ?? '', key)) draw();
      else quit();
    };
    input.setRawMode(true);
    input.resume();
    input.on('keypress', press);
    output.on('resize', draw);
    process.once('SIGINT', quit);
    process.once('SIGTERM', quit);
    output.write('\x1b[?1049h\x1b[2J\x1b[?25l');
    draw();
  });
}
