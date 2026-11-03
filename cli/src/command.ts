import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { analyze } from './analyze.js';
import { isSecret } from '../../packages/scanner/src/index.js';
import { startDashboard } from './server.js';
import open from 'open';
import { startTerminalDashboard } from './tui.js';

const help = `DevLens 0.2.0 — local repository dashboard

Usage: devlens [directory] [options]

Options:
  -o, --output <file>  Write JSON graph (new file only; no source overwrites)
  --web               Open the optional browser dashboard instead of the terminal UI
  --port <number>     Web dashboard port (default: 4545; requires --web)
  --no-browser       With --web, skip opening a browser
  -h, --help         Show help
  -v, --version      Show version

Examples:
  devlens .
  devlens ./my-app --output ./devlens.json

No external network calls. Environment files and symlinks are excluded.
Interactive terminals open a keyboard-driven dashboard. Press q to quit.
Piped output prints the summary and exits. --web listens only on 127.0.0.1.
Without --output, no files are written.`;
const safeTerminal = (value: string) => value.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
export async function runCli(
  args: string[],
  log: (message: string) => void = console.log,
  services = { startDashboard, open, startTerminalDashboard },
) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      port: { type: 'string' },
      web: { type: 'boolean' },
      'no-browser': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
  if (values.help) {
    log(help);
    return;
  }
  if (values.version) {
    log('0.2.0');
    return;
  }
  if (positionals.length > 1)
    throw new Error('Expected one project directory. Run devlens --help.');
  if (
    values.port !== undefined &&
    (!/^\d+$/.test(values.port) || Number(values.port) < 1 || Number(values.port) > 65535)
  )
    throw new Error('--port must be an integer between 1 and 65535.');
  if (values.port !== undefined && !values.web)
    throw new Error('--port requires --web. The terminal UI does not use a server.');
  const output = values.output === undefined ? undefined : path.resolve(values.output);
  if (output && (path.extname(output) !== '.json' || output.split(path.sep).some(isSecret)))
    throw new Error('--output must be a .json file outside environment-file paths.');
  log('\nDevLens\n\nScanning project...\n');
  const result = await analyze(positionals[0] ?? '.', output ? [output] : []);
  log(`✓ ${result.summary.files} files scanned`);
  log(`✓ ${result.summary.languages.map((l) => `${l.name} ${l.percentage}%`).join(', ')}`);
  log(`✓ ${result.summary.frameworks.join(', ') || 'No supported frameworks'} detected`);
  log(`✓ ${result.summary.dependencies} dependencies detected`);
  log(`✓ ${result.summary.imports} import relationships found`);
  for (const category of [...new Set(result.dependencies.map((d) => d.category))].sort()) {
    log(`\n${category}:`);
    for (const dep of result.dependencies.filter((d) => d.category === category))
      log(safeTerminal(`  ${dep.name} ${dep.version} (${dep.section}, ${dep.manifest})`));
  }
  if (result.warnings.length) {
    log(`\nWarnings (${result.warnings.length}):`);
    for (const warning of result.warnings)
      log(safeTerminal(`⚠ ${warning.path}: ${warning.message}`));
  }
  if (output) {
    // Exclusive creation protects source, existing reports, and symlink targets.
    await writeFile(output, JSON.stringify(result, null, 2) + '\n', {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    log(safeTerminal(`\nSaved: ${output}`));
  }
  if (!values.web) {
    await services.startTerminalDashboard(result);
    return;
  }
  const port = Number(values.port ?? 4545);
  const server = await services.startDashboard(result, port);
  const url = `http://127.0.0.1:${port}`;
  log(`\nDashboard: ${url}\nPress Ctrl+C to stop.`);
  if (!values['no-browser']) {
    try {
      await services.open(url);
    } catch {
      log(`Could not open a browser. Open ${url} manually.`);
    }
  }
  return server;
}
